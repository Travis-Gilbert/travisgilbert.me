/**
 * CommonPlace v2 GraphQL client: the single Theorem front door.
 *
 * v2 connects the consumer surfaces to Theorem's `commonplace-api` GraphQL
 * (apps/commonplace-api/src/schema.rs) instead of the (now-disconnected) Django
 * REST. Theorem is the browser-facing GraphQL edge; Theseus is reached behind it
 * over gRPC (the epistemic surfaces grow into that contract later). The frontend
 * therefore talks to exactly ONE GraphQL endpoint.
 *
 * Architecture: this module speaks the commonplace-api `Item`/`Collection` model
 * and ADAPTS each result into the existing, backend-agnostic frontend shapes
 * (MockNode, ObjectListItem, ApiObjectDetail, ObjectSearchResult, ApiCaptureResponse)
 * so the ~70 view components consume GraphQL through the unchanged `commonplace-api.ts`
 * mapper seam. The switch is `NEXT_PUBLIC_COMMONPLACE_BACKEND` (default `graphql`;
 * set `rest` to fall back to the Django client).
 *
 * Field/arg names track the Rust schema exactly:
 *   items(kind) item(id) collections collectionItems(id) search(query,k)
 *   ingest(input) putNote(title,text,tags) editItem(id,title) createCollection(name)
 *   addToCollection(itemId,collectionId)
 */

import {
  getObjectTypeIdentity,
  type MockNode,
  type ApiObjectDetail,
  type ApiCaptureResponse,
  type ObjectListItem,
  type ApiNotebookListItem,
  type ApiNotebookDetail,
  type ApiNotebookHealth,
  type ApiProjectListItem,
  type ApiProjectDetail,
  type ApiDailyLog,
  type NotebookObjectCompact,
  type GraphNode,
  type GraphLink,
  type ApiResurfaceResponse,
  type ApiArtifactListItem,
} from '@/lib/commonplace';
import type { ObjectSearchResult } from '@/lib/commonplace-api';
import { commonPlaceInstanceProxyHeaders } from '@/lib/commonplace-instance';

/* ─────────────────────────────────────────────────
   Endpoint, auth, backend switch
   ───────────────────────────────────────────────── */

/**
 * Transport: the browser posts to a SAME-ORIGIN proxy route
 * (src/app/api/theorem/graphql/route.ts), which forwards to Theorem with a
 * server-side key. This avoids CORS and keeps the key out of the client bundle.
 * Server-side callers (SSR) hit Theorem directly with the server env.
 */
const PROXY_PATH = '/api/theorem/graphql';
const SERVER_GQL_URL = (
  process.env.THEOREM_GRAPHQL_URL ?? 'http://localhost:50090'
).replace(/\/+$/, '');
const SERVER_API_KEY = process.env.THEOREM_API_KEY ?? 'dev-key';

// Desktop (Tauri) mode: the app ships as a static export with no Next server, so
// the same-origin proxy route does not exist. The client calls the local
// commonplace-api the desktop shell spawns in-process, directly, with the local
// dev key (the node is loopback-only, so the key is not a secret).
// ponytail: this port must match COMMONPLACE_NODE_PORT in
// apps/desktop/src-tauri/src/lib.rs (the Theorem repo).
const DESKTOP_GQL_URL = (
  process.env.NEXT_PUBLIC_COMMONPLACE_DESKTOP_URL ?? 'http://127.0.0.1:17890'
).replace(/\/+$/, '');
const DESKTOP_API_KEY = process.env.NEXT_PUBLIC_COMMONPLACE_DESKTOP_KEY ?? 'dev-key';

/** True inside the Tauri desktop runtime (vs. a browser tab or SSR). */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Which backend the consumer surfaces read/write. Default GraphQL (the v2 spine). */
const BACKEND = process.env.NEXT_PUBLIC_COMMONPLACE_BACKEND ?? 'graphql';
export const THEOREM_GRAPHQL = BACKEND === 'graphql';

/* ─────────────────────────────────────────────────
   commonplace-api wire shapes
   ───────────────────────────────────────────────── */

export interface ItemGql {
  id: string;
  kind: string;
  title: string;
  bodyText: string | null;
  blobHash: string | null;
  mime: string | null;
  source: string | null;
  residency: string;
  tags: string[];
  collections: string[];
  classification: string | null;
  status: string | null;
  priority: string | null;
  dueAtMs: number | null;
  path: string | null;
  extra: Record<string, unknown>;
  createdAtMs: number;
  updatedAtMs: number;
  validFromMs?: number | null;
  validToMs?: number | null;
}

export interface EdgeGql {
  id: string;
  fromId: string;
  toId: string;
  edgeType: string;
  confidence: number;
  status: 'asserted' | 'inferred' | 'contradicted' | string;
  provenance: string | null;
  properties: Record<string, unknown>;
}

export interface CollectionGql {
  id: string;
  name: string;
  kind: string;
  identifier: string | null;
  description: string | null;
  startAtMs: number | null;
  endAtMs: number | null;
  color: string | null;
  sortOrder: number | null;
  featureFlags: Record<string, boolean>;
  createdAtMs: number;
}

export interface EmbeddingSpaceRowGql {
  identifier: string;
  x: number;
  y: number;
  category: number;
  categoryLabel: string;
  text: string;
  createdMs: number;
  communityId: string;
  epistemicStatus: string;
}

export interface EmbeddingSpaceGql {
  table: string;
  projection: string;
  total: number;
  rows: EmbeddingSpaceRowGql[];
}

export interface VectorNeighborGql {
  row: EmbeddingSpaceRowGql;
  score: number;
}

const ITEM_FIELDS = `
  id kind title bodyText blobHash mime source residency
  tags collections classification status priority dueAtMs path extra createdAtMs updatedAtMs
`;

const EDGE_FIELDS = `
  id fromId toId edgeType confidence status provenance properties
`;

const ITEM_FIELDS_WITH_VALID = `
  ${ITEM_FIELDS}
  validFromMs validToMs
`;

const COLLECTION_FIELDS = `
  id name kind identifier description startAtMs endAtMs color sortOrder featureFlags createdAtMs
`;

const EMBEDDING_SPACE_ROW_FIELDS = `
  identifier x y category categoryLabel text createdMs communityId epistemicStatus
`;

/* ─────────────────────────────────────────────────
   Transport
   ───────────────────────────────────────────────── */

class GraphqlError extends Error {}

/** Execute an operation. Throws on transport/GraphQL error (used for writes). */
export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { signal?: AbortSignal } = {},
): Promise<T> {
  const onServer = typeof window === 'undefined';
  const desktop = !onServer && isTauri();
  const url = onServer
    ? `${SERVER_GQL_URL}/graphql`
    : desktop
      ? `${DESKTOP_GQL_URL}/graphql`
      : PROXY_PATH;
  const clientInstanceHeaders =
    !onServer && !desktop ? commonPlaceInstanceProxyHeaders() : {};
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(onServer ? { 'x-api-key': SERVER_API_KEY } : {}),
      ...(desktop ? { 'x-api-key': DESKTOP_API_KEY } : {}),
      ...clientInstanceHeaders,
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
    signal: options.signal,
  });
  if (!res.ok) throw new GraphqlError(`commonplace-api ${res.status}`);
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) throw new GraphqlError(json.errors[0].message);
  return json.data as T;
}

/** Read variant: resolves to `fallback` on any error so a down backend shows an
 *  honest empty state rather than crashing the surface (mirrors the REST client). */
async function gqlRead<T>(
  query: string,
  variables: Record<string, unknown>,
  fallback: T,
): Promise<T> {
  try {
    return await gql<T>(query, variables);
  } catch {
    return fallback;
  }
}

/* ─────────────────────────────────────────────────
   Kind <-> object-type mapping + id helpers
   ───────────────────────────────────────────────── */

/** commonplace-api ItemKind -> frontend object-type slug (visual identity). */
export function kindToTypeSlug(kind: string): string {
  switch (kind) {
    case 'link':
      return 'source';
    case 'doc':
      return 'note';
    case 'image':
      return 'note';
    case 'file':
      return 'source';
    case 'note':
      return 'note';
    default:
      return kind || 'note';
  }
}

/** Frontend capture hint (object-type slug) -> commonplace-api ItemKind. */
export function typeSlugToKind(slug?: string): string {
  switch (slug) {
    case 'source':
      return 'link';
    case 'script':
      return 'doc';
    case 'image':
      return 'image';
    case undefined:
    case '':
      return 'note';
    default:
      return 'note';
  }
}

/** Stable positive 31-bit hash of a string id -> the numeric id the Django-shaped
 *  views expect. Used only as a React key / detail-ref; the real string id rides
 *  in `slug`, which is what navigation/detail lookups use. */
export function stableNumId(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 1) || 1;
}

function iso(ms: number): string {
  return new Date(ms || Date.now()).toISOString();
}

function preview(text: string | null, n = 200): string {
  const t = (text ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}...` : t;
}

const CAPTURE_TAG_PREFIX = 'capture:';

function captureMethodFromTags(tags: string[]): string {
  return tags.find((tag) => tag.startsWith(CAPTURE_TAG_PREFIX))?.slice(CAPTURE_TAG_PREFIX.length) ?? 'typed';
}

function captureTags(method: string | undefined, tags: string[] = []): string[] {
  const cleanMethod = method?.trim() || 'typed';
  return Array.from(new Set([
    ...tags.filter((tag) => !tag.startsWith(CAPTURE_TAG_PREFIX)),
    `${CAPTURE_TAG_PREFIX}${cleanMethod}`,
  ]));
}

/* ─────────────────────────────────────────────────
   Adapters: Item -> existing frontend shapes
   ───────────────────────────────────────────────── */

export function itemToMockNode(item: ItemGql): MockNode {
  return {
    id: item.id,
    objectRef: stableNumId(item.id),
    objectSlug: item.id,
    objectType: kindToTypeSlug(item.kind),
    title: item.title || 'Untitled',
    summary: preview(item.bodyText),
    capturedAt: iso(item.createdAtMs),
    url: item.source ?? undefined,
    captureMethod: captureMethodFromTags(item.tags),
    edgeCount: 0,
    edges: [],
  };
}

export function itemToObjectListItem(item: ItemGql): ObjectListItem {
  const ident = getObjectTypeIdentity(kindToTypeSlug(item.kind));
  const captureMethod = captureMethodFromTags(item.tags);
  return {
    id: stableNumId(item.id),
    title: item.title || 'Untitled',
    display_title: item.title || 'Untitled',
    slug: item.id,
    object_type: 0,
    object_type_name: ident.label,
    object_type_slug: ident.slug,
    object_type_icon: ident.icon,
    object_type_color: ident.color,
    url: item.source ?? `#/object/${item.id}`,
    status: item.residency === 'archived' ? 'archived' : 'active',
    is_pinned: false,
    is_starred: false,
    captured_at: iso(item.createdAtMs),
    capture_method: captureMethod,
    edge_count: 0,
  };
}

export function itemToObjectDetail(item: ItemGql): ApiObjectDetail {
  const ident = getObjectTypeIdentity(kindToTypeSlug(item.kind));
  const captureMethod = captureMethodFromTags(item.tags);
  return {
    id: stableNumId(item.id),
    title: item.title || 'Untitled',
    display_title: item.title || 'Untitled',
    slug: item.id,
    object_type: 0,
    object_type_data: {
      slug: ident.slug,
      name: ident.label,
      icon: ident.icon,
      color: ident.color,
    },
    body: item.bodyText ?? '',
    url: item.source ?? `#/object/${item.id}`,
    og_title: null,
    og_description: null,
    status: item.residency === 'archived' ? 'archived' : 'active',
    captured_at: iso(item.createdAtMs),
    capture_method: captureMethod,
    edges: [],
    components: [],
    recent_nodes: [],
  };
}

export function itemToSearchResult(item: ItemGql): ObjectSearchResult {
  const ident = getObjectTypeIdentity(kindToTypeSlug(item.kind));
  return {
    id: stableNumId(item.id),
    title: item.title || 'Untitled',
    display_title: item.title || 'Untitled',
    slug: item.id,
    object_type_name: ident.label,
    object_type_color: ident.color,
    status: item.residency === 'archived' ? 'archived' : 'active',
    captured_at: iso(item.createdAtMs),
  };
}

/* ─────────────────────────────────────────────────
   Raw operations (commonplace-api model)
   ───────────────────────────────────────────────── */

export async function gqlItems(kind?: string): Promise<ItemGql[]> {
  const data = await gqlRead<{ items: ItemGql[] }>(
    `query($kind:String){ items(kind:$kind){ ${ITEM_FIELDS} } }`,
    { kind },
    { items: [] },
  );
  return [...data.items].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export async function gqlItem(id: string): Promise<ItemGql | null> {
  const data = await gqlRead<{ item: ItemGql | null }>(
    `query($id:String!){ item(id:$id){ ${ITEM_FIELDS} } }`,
    { id },
    { item: null },
  );
  return data.item;
}

export async function gqlCollections(): Promise<CollectionGql[]> {
  const data = await gqlRead<{ collections: CollectionGql[] }>(
    `{ collections { ${COLLECTION_FIELDS} } }`,
    {},
    { collections: [] },
  );
  return data.collections;
}

export async function gqlCollectionItems(id: string): Promise<ItemGql[]> {
  const data = await gqlRead<{ collectionItems: ItemGql[] }>(
    `query($id:String!){ collectionItems(id:$id){ ${ITEM_FIELDS} } }`,
    { id },
    { collectionItems: [] },
  );
  return data.collectionItems;
}

export interface IngestArgs {
  title?: string;
  text: string;
  kind?: string;
  tags?: string[];
  captureMethod?: string;
  source?: string;
  residency?: string;
  validFromMs?: number | null;
  validToMs?: number | null;
}

export async function gqlIngest(input: IngestArgs): Promise<ItemGql> {
  const payload: Record<string, unknown> = {
    title: input.title ?? '',
    text: input.text,
    kind: input.kind ?? 'note',
    tags: input.captureMethod ? captureTags(input.captureMethod, input.tags) : input.tags ?? [],
    source: input.source ?? null,
    residency: input.residency ?? null,
  };
  if (input.validFromMs != null) payload.validFromMs = input.validFromMs;
  if (input.validToMs != null) payload.validToMs = input.validToMs;
  const data = await gql<{ ingest: ItemGql }>(
    `mutation($input:IngestInputGql!){ ingest(input:$input){ ${ITEM_FIELDS} } }`,
    { input: payload },
  );
  return data.ingest;
}

export async function gqlItemsAsOf(input: {
  validAtMs?: number | null;
  transactionAtMs?: number | null;
  kind?: string | null;
}): Promise<ItemGql[]> {
  const data = await gqlRead<{ itemsAsOf: ItemGql[] }>(
    `query($validAtMs:Long,$transactionAtMs:Long,$kind:String){ itemsAsOf(validAtMs:$validAtMs,transactionAtMs:$transactionAtMs,kind:$kind){ ${ITEM_FIELDS_WITH_VALID} } }`,
    {
      validAtMs: input.validAtMs ?? null,
      transactionAtMs: input.transactionAtMs ?? null,
      kind: input.kind ?? null,
    },
    { itemsAsOf: [] },
  );
  return [...data.itemsAsOf].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export async function gqlItemEdges(
  id: string,
  input: { direction?: 'in' | 'out' | 'both'; edgeType?: string | null } = {},
): Promise<EdgeGql[]> {
  const data = await gqlRead<{ itemEdges: EdgeGql[] }>(
    `query($id:String!,$direction:String,$edgeType:String){ itemEdges(id:$id,direction:$direction,edgeType:$edgeType){ ${EDGE_FIELDS} } }`,
    {
      id,
      direction: input.direction ?? 'both',
      edgeType: input.edgeType ?? null,
    },
    { itemEdges: [] },
  );
  return data.itemEdges;
}

export async function gqlEditItem(input: {
  id: string;
  title?: string | null;
  tags?: string[] | null;
  residency?: string | null;
  validFromMs?: number | null;
  validToMs?: number | null;
}): Promise<ItemGql> {
  const editsValidTime = input.validFromMs != null || input.validToMs != null;
  const data = editsValidTime
    ? await gql<{ editItem: ItemGql }>(
      `mutation($id:String!,$title:String,$tags:[String!],$residency:String,$validFromMs:Long,$validToMs:Long){ editItem(id:$id,title:$title,tags:$tags,residency:$residency,validFromMs:$validFromMs,validToMs:$validToMs){ ${ITEM_FIELDS_WITH_VALID} } }`,
      {
        id: input.id,
        title: input.title ?? null,
        tags: input.tags ?? null,
        residency: input.residency ?? null,
        validFromMs: input.validFromMs ?? null,
        validToMs: input.validToMs ?? null,
      },
    )
    : await gql<{ editItem: ItemGql }>(
      `mutation($id:String!,$title:String,$tags:[String!],$residency:String){ editItem(id:$id,title:$title,tags:$tags,residency:$residency){ ${ITEM_FIELDS} } }`,
      {
        id: input.id,
        title: input.title ?? null,
        tags: input.tags ?? null,
        residency: input.residency ?? null,
      },
    );
  return data.editItem;
}

export async function gqlPutNote(
  title: string,
  text: string,
  tags: string[] = [],
): Promise<ItemGql> {
  const data = await gql<{ putNote: ItemGql }>(
    `mutation($title:String!,$text:String!,$tags:[String!]){ putNote(title:$title,text:$text,tags:$tags){ ${ITEM_FIELDS} } }`,
    { title, text, tags },
  );
  return data.putNote;
}

export async function gqlCreateCollection(name: string): Promise<CollectionGql> {
  const data = await gql<{ createCollection: CollectionGql }>(
    `mutation($name:String!){ createCollection(name:$name){ ${COLLECTION_FIELDS} } }`,
    { name },
  );
  return data.createCollection;
}

export async function gqlAddToCollection(
  itemId: string,
  collectionId: string,
): Promise<void> {
  await gql(
    `mutation($i:String!,$c:String!){ addToCollection(itemId:$i,collectionId:$c) }`,
    { i: itemId, c: collectionId },
  );
}

export interface PmLabelGql {
  id: string;
  name: string;
  color: string | null;
}

export interface PmStateGql {
  id: string;
  name: string;
  group: string;
  sortOrder: number;
}

export interface PmWorkItemGql {
  item: ItemGql;
  sequenceId: string | null;
  state: PmStateGql | null;
  estimatePoint: number | null;
  projectIds: string[];
  cycleIds: string[];
  moduleIds: string[];
  aboutIds: string[];
  commentCount: number;
  worklogCount: number;
  totalWorklogDurationMs: number;
}

export interface PmProjectGql {
  collection: CollectionGql;
  states: PmStateGql[];
  cycles: CollectionGql[];
  modules: CollectionGql[];
  labels: PmLabelGql[];
  workItemCount: number;
  openItemCount: number;
}

export interface PmOverviewGql {
  projects: PmProjectGql[];
  workItems: PmWorkItemGql[];
  stickies: ItemGql[];
  pages: ItemGql[];
}

const PM_STATE_FIELDS = 'id name group sortOrder';
const PM_LABEL_FIELDS = 'id name color';
const PM_WORK_ITEM_FIELDS = `
  item { ${ITEM_FIELDS} }
  sequenceId
  state { ${PM_STATE_FIELDS} }
  estimatePoint
  projectIds
  cycleIds
  moduleIds
  aboutIds
  commentCount
  worklogCount
  totalWorklogDurationMs
`;
const PM_PROJECT_FIELDS = `
  collection { ${COLLECTION_FIELDS} }
  states { ${PM_STATE_FIELDS} }
  cycles { ${COLLECTION_FIELDS} }
  modules { ${COLLECTION_FIELDS} }
  labels { ${PM_LABEL_FIELDS} }
  workItemCount
  openItemCount
`;
const PM_OVERVIEW_FIELDS = `
  projects { ${PM_PROJECT_FIELDS} }
  workItems { ${PM_WORK_ITEM_FIELDS} }
  stickies { ${ITEM_FIELDS} }
  pages { ${ITEM_FIELDS} }
`;

export async function gqlPmOverview(projectId?: string): Promise<PmOverviewGql> {
  const data = await gqlRead<{ pmOverview: PmOverviewGql }>(
    `query($projectId:String){ pmOverview(projectId:$projectId){ ${PM_OVERVIEW_FIELDS} } }`,
    { projectId: projectId ?? null },
    { pmOverview: { projects: [], workItems: [], stickies: [], pages: [] } },
  );
  return data.pmOverview;
}

export async function gqlCreatePmProject(input: {
  name: string;
  identifier: string;
  description?: string;
  color?: string;
  defaultStates?: boolean;
}): Promise<PmProjectGql> {
  const data = await gql<{ createPmProject: PmProjectGql }>(
    `mutation($input:CreateProjectInputGql!){ createPmProject(input:$input){ ${PM_PROJECT_FIELDS} } }`,
    { input },
  );
  return data.createPmProject;
}

export async function gqlCreateWorkItem(input: {
  title: string;
  description?: string;
  projectId?: string;
  stateId?: string;
  priority?: string;
  dueAtMs?: number;
  estimatePoint?: number;
  sequenceId?: string;
  kind?: string;
}): Promise<PmWorkItemGql> {
  const data = await gql<{ createWorkItem: PmWorkItemGql }>(
    `mutation($input:CreateWorkItemInputGql!){ createWorkItem(input:$input){ ${PM_WORK_ITEM_FIELDS} } }`,
    { input },
  );
  return data.createWorkItem;
}

export async function gqlSetWorkItemState(
  itemId: string,
  stateId: string,
): Promise<PmWorkItemGql> {
  const data = await gql<{ setWorkItemState: PmWorkItemGql }>(
    `mutation($itemId:String!,$stateId:String!){ setWorkItemState(itemId:$itemId,stateId:$stateId){ ${PM_WORK_ITEM_FIELDS} } }`,
    { itemId, stateId },
  );
  return data.setWorkItemState;
}

export async function gqlCreatePmCycle(input: {
  projectId: string;
  name: string;
  startAtMs: number;
  endAtMs: number;
}): Promise<CollectionGql> {
  const data = await gql<{ createPmCycle: CollectionGql }>(
    `mutation($input:CreateCycleInputGql!){ createPmCycle(input:$input){ ${COLLECTION_FIELDS} } }`,
    { input },
  );
  return data.createPmCycle;
}

export async function gqlCreatePmModule(input: {
  projectId: string;
  name: string;
}): Promise<CollectionGql> {
  const data = await gql<{ createPmModule: CollectionGql }>(
    `mutation($input:CreateModuleInputGql!){ createPmModule(input:$input){ ${COLLECTION_FIELDS} } }`,
    { input },
  );
  return data.createPmModule;
}

export async function gqlScopeProjectLabel(input: {
  projectId: string;
  name: string;
  color?: string;
}): Promise<PmLabelGql> {
  const data = await gql<{ scopeProjectLabel: PmLabelGql }>(
    `mutation($projectId:String!,$name:String!,$color:String){ scopeProjectLabel(projectId:$projectId,name:$name,color:$color){ ${PM_LABEL_FIELDS} } }`,
    { projectId: input.projectId, name: input.name, color: input.color ?? null },
  );
  return data.scopeProjectLabel;
}

export async function gqlAddWorkItemToCycle(
  itemId: string,
  cycleId: string,
): Promise<PmWorkItemGql> {
  const data = await gql<{ addWorkItemToCycle: PmWorkItemGql }>(
    `mutation($itemId:String!,$cycleId:String!){ addWorkItemToCycle(itemId:$itemId,cycleId:$cycleId){ ${PM_WORK_ITEM_FIELDS} } }`,
    { itemId, cycleId },
  );
  return data.addWorkItemToCycle;
}

export async function gqlAddWorkItemToModule(
  itemId: string,
  moduleId: string,
): Promise<PmWorkItemGql> {
  const data = await gql<{ addWorkItemToModule: PmWorkItemGql }>(
    `mutation($itemId:String!,$moduleId:String!){ addWorkItemToModule(itemId:$itemId,moduleId:$moduleId){ ${PM_WORK_ITEM_FIELDS} } }`,
    { itemId, moduleId },
  );
  return data.addWorkItemToModule;
}

export async function gqlCreateWorkItemComment(input: {
  itemId: string;
  body: string;
  authorId?: string;
}): Promise<ItemGql> {
  const data = await gql<{ createWorkItemComment: ItemGql }>(
    `mutation($input:CreateCommentInputGql!){ createWorkItemComment(input:$input){ ${ITEM_FIELDS} } }`,
    { input },
  );
  return data.createWorkItemComment;
}

export async function gqlLogWork(input: {
  taskId: string;
  durationMs: number;
  loggedBy?: string;
  description?: string;
}): Promise<ItemGql> {
  const data = await gql<{ logWork: ItemGql }>(
    `mutation($input:LogWorkInputGql!){ logWork(input:$input){ ${ITEM_FIELDS} } }`,
    { input },
  );
  return data.logWork;
}

export async function gqlCreateSticky(input: {
  ownerId?: string;
  title: string;
  description?: string;
  color?: string;
  backgroundColor?: string;
  sortOrder?: number;
}): Promise<ItemGql> {
  const data = await gql<{ createSticky: ItemGql }>(
    `mutation($input:CreateStickyInputGql!){ createSticky(input:$input){ ${ITEM_FIELDS} } }`,
    { input },
  );
  return data.createSticky;
}

export async function gqlCreatePage(input: {
  projectId?: string;
  aboutItemId?: string;
  title: string;
  body?: string;
  tags?: string[];
}): Promise<ItemGql> {
  const data = await gql<{ createPage: ItemGql }>(
    `mutation($input:CreatePageInputGql!){ createPage(input:$input){ ${ITEM_FIELDS} } }`,
    { input },
  );
  return data.createPage;
}

export async function gqlSavePage(input: {
  id: string;
  title?: string;
  body?: string;
  tags?: string[];
}): Promise<ItemGql> {
  const data = await gql<{ savePage: ItemGql }>(
    `mutation($input:SavePageInputGql!){ savePage(input:$input){ ${ITEM_FIELDS} } }`,
    { input },
  );
  return data.savePage;
}

/* ─────────────────────────────────────────────────
   Consumer functions (return existing frontend shapes).
   These are the GraphQL twins of the commonplace-api.ts REST functions;
   commonplace-api.ts routes to them when THEOREM_GRAPHQL is on.
   ───────────────────────────────────────────────── */

/** Timeline feed -> MockNode[] (items most-recently-updated first). */
export async function gqlFetchFeed(params?: {
  object_type?: string;
}): Promise<MockNode[]> {
  const items = await gqlItems();
  const filtered = params?.object_type
    ? items.filter((i) => kindToTypeSlug(i.kind) === params.object_type)
    : items;
  return filtered.map(itemToMockNode);
}

/** Library / grid -> ObjectListItem[]. */
export async function gqlFetchObjects(params?: {
  q?: string;
  object_type?: string;
}): Promise<ObjectListItem[]> {
  let items = await gqlItems();
  if (params?.object_type) {
    items = items.filter((i) => kindToTypeSlug(i.kind) === params.object_type);
  }
  if (params?.q?.trim()) {
    const q = params.q.toLowerCase();
    items = items.filter((i) =>
      `${i.title} ${i.bodyText ?? ''}`.toLowerCase().includes(q),
    );
  }
  return items.map(itemToObjectListItem);
}

/** Object detail (drawer / reader) -> ApiObjectDetail | null. */
export async function gqlFetchObjectDetail(
  slug: string,
): Promise<ApiObjectDetail | null> {
  const item = await gqlItem(slug);
  return item ? itemToObjectDetail(item) : null;
}

/** Command-palette / search -> ObjectSearchResult[]. */
export async function gqlSearchObjects(
  query: string,
  limit = 10,
): Promise<ObjectSearchResult[]> {
  if (!query.trim()) return [];
  const data = await gqlRead<{ search: { item: ItemGql; score: number }[] }>(
    `query($q:String!,$k:Int){ search(query:$q,k:$k){ item{ ${ITEM_FIELDS} } score } }`,
    { q: query, k: limit },
    { search: [] },
  );
  return data.search.map((h) => itemToSearchResult(h.item));
}

export async function gqlEmbeddingSpace(options: {
  kind?: string;
  limit?: number;
} = {}): Promise<EmbeddingSpaceGql> {
  const data = await gqlRead<{ embeddingSpace: EmbeddingSpaceGql }>(
    `query($kind:String,$limit:Int){
      embeddingSpace(kind:$kind,limit:$limit){
        table
        projection
        total
        rows { ${EMBEDDING_SPACE_ROW_FIELDS} }
      }
    }`,
    {
      kind: options.kind ?? null,
      limit: options.limit ?? null,
    },
    {
      embeddingSpace: {
        table: 'embedding_space',
        projection: 'unavailable',
        total: 0,
        rows: [],
      },
    },
  );
  return data.embeddingSpace;
}

export async function gqlVectorNeighbors(
  itemId: string,
  k = 12,
): Promise<VectorNeighborGql[]> {
  if (!itemId.trim()) return [];
  const data = await gqlRead<{ vectorNeighbors: VectorNeighborGql[] }>(
    `query($itemId:String!,$k:Int){
      vectorNeighbors(itemId:$itemId,k:$k){
        row { ${EMBEDDING_SPACE_ROW_FIELDS} }
        score
      }
    }`,
    { itemId, k },
    { vectorNeighbors: [] },
  );
  return data.vectorNeighbors;
}

/** Capture write -> ingest -> ApiCaptureResponse (mirrors POST /capture/). */
export async function gqlCapture(data: {
  content: string;
  body?: string;
  hint_type?: string;
  title?: string;
  capture_method?: string;
  source_url?: string;
  local_id?: string;
  captured_at?: string;
  status?: string;
  properties?: Record<string, unknown>;
}): Promise<ApiCaptureResponse> {
  const captureMethod = data.capture_method ?? 'typed';
  const propertyTags = data.properties ? ['has:properties'] : [];
  const item = await gqlIngest({
    title: data.title,
    text: data.body ?? data.content,
    kind: typeSlugToKind(data.hint_type),
    source: data.source_url,
    captureMethod,
    tags: propertyTags,
  });
  return {
    object: itemToObjectDetail(item),
    inferred_type: kindToTypeSlug(item.kind),
    creation_node: null,
  };
}

/* ─────────────────────────────────────────────────
   Ask: grounded retrieval + answer over the store
   (the agent reading the graph). The caller persists the answer.
   ───────────────────────────────────────────────── */

export type AskAnswerKind = 'MODEL' | 'EXTRACTIVE' | 'EMPTY';

export interface AskProvenanceGql {
  item: ItemGql;
  score: number;
  arms: string[];
}

export interface AskResultGql {
  answer: string;
  answerKind: AskAnswerKind;
  provenance: AskProvenanceGql[];
}

export async function gqlAsk(question: string, k = 8): Promise<AskResultGql> {
  const data = await gqlRead<{ ask: AskResultGql }>(
    `query($q:String!,$k:Int){ ask(question:$q,k:$k){ answer answerKind provenance{ item{ ${ITEM_FIELDS} } score arms } } }`,
    { q: question, k },
    { ask: { answer: '', answerKind: 'EMPTY' as AskAnswerKind, provenance: [] } },
  );
  return data.ask;
}

export interface TheoremAgentClaimGql {
  text: string;
  provenance: string;
}

export interface TheoremAgentRunGql {
  answer: string;
  answerKind: AskAnswerKind;
  bindingId: string;
  runId?: string;
  heads: string[];
  claims: TheoremAgentClaimGql[];
  alignmentVerdict?: unknown;
  evidenceCount: number;
}

export async function gqlTheoremAgent(
  input: {
    task: string;
    mode?: string;
    bindingId?: string;
    tenant?: string;
    claims?: TheoremAgentClaimGql[];
  },
  signal?: AbortSignal,
): Promise<TheoremAgentRunGql> {
  const data = await gql<{ theoremAgent: TheoremAgentRunGql }>(
    `query($task:String!,$mode:String,$bindingId:String,$tenant:String,$claims:[TheoremAgentClaimInput!]) {
      theoremAgent(task:$task, mode:$mode, bindingId:$bindingId, tenant:$tenant, claims:$claims) {
        answer
        answerKind
        bindingId
        runId
        heads
        claims { text provenance }
        alignmentVerdict
        evidenceCount
      }
    }`,
    input,
    { signal },
  );
  return data.theoremAgent;
}

/* ─────────────────────────────────────────────────
   Notebooks <- collections (a notebook is a collection of items).
   ───────────────────────────────────────────────── */

const NOTEBOOK_COLORS = ['#2D5F6B', '#C49A4A', '#5A7A4A', '#8B6FA0', '#4A7A9A', '#B06080', '#C47A3A'];

export async function gqlNotebooks(): Promise<ApiNotebookListItem[]> {
  const cols = (await gqlCollections()).filter((collection) =>
    collection.kind === 'manual' || collection.kind === 'auto',
  );
  const counts = await Promise.all(
    cols.map(async (collection) => ({
      id: collection.id,
      count: (await gqlCollectionItems(collection.id)).length,
    })),
  );
  const countById = new Map(counts.map(({ id, count }) => [id, count]));
  return cols.map((c, i) => ({
    id: stableNumId(c.id),
    name: c.name,
    slug: c.id,
    description: c.kind === 'auto' ? 'Auto collection' : 'Manual collection',
    color: NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length],
    icon: 'book',
    is_active: true,
    sort_order: i,
    object_count: countById.get(c.id) ?? 0,
  }));
}

function itemToNotebookObject(item: ItemGql): NotebookObjectCompact {
  const ident = getObjectTypeIdentity(kindToTypeSlug(item.kind));
  return {
    id: stableNumId(item.id),
    title: item.title || 'Untitled',
    object_type: ident.slug,
    body_preview: preview(item.bodyText, 160),
    edge_count: 0,
    captured_at: iso(item.createdAtMs),
    url: item.source ?? `#/object/${item.id}`,
    is_starred: false,
    is_pinned: false,
    status: item.residency === 'archived' ? 'archived' : 'active',
  };
}

export async function gqlNotebookBySlug(slug: string): Promise<ApiNotebookDetail | null> {
  const [notebooks, items] = await Promise.all([
    gqlNotebooks(),
    gqlCollectionItems(slug),
  ]);
  const notebook = notebooks.find((nb) => nb.slug === slug);
  if (!notebook) return null;
  return {
    ...notebook,
    engine_config: {},
    available_types: Array.from(new Set(items.map((item) => kindToTypeSlug(item.kind)))),
    default_layout: null,
    theme: {},
    objects: items.map(itemToNotebookObject),
    visibility: 'private',
  };
}

export async function gqlNotebookHealth(slug: string): Promise<ApiNotebookHealth> {
  const items = await gqlCollectionItems(slug);
  return {
    object_count: items.length,
    edge_count: 0,
    density: 0,
    last_engine_run: null,
    cluster_count: new Set(items.map((item) => item.kind)).size,
  };
}

export async function gqlProjects(params?: {
  notebook?: string;
  status?: string;
}): Promise<ApiProjectListItem[]> {
  const overview = await gqlPmOverview();
  return overview.projects
    .filter((project) => !params?.notebook || project.collection.id === params.notebook)
    .map((project) => ({
      id: stableNumId(project.collection.id),
      name: project.collection.name,
      slug: project.collection.id,
      mode: 'review',
      status: project.openItemCount > 0 ? 'active' : 'paused',
      notebook: null,
      notebook_name: null,
      is_template: false,
      reminder_at: null,
    }))
    .filter((project) => !params?.status || project.status === params.status);
}

export async function gqlProjectBySlug(slug: string): Promise<ApiProjectDetail | null> {
  const [projects, overview] = await Promise.all([gqlProjects(), gqlPmOverview(slug)]);
  const project = projects.find((p) => p.slug === slug);
  if (!project) return null;
  return {
    ...project,
    sha_hash: '',
    description: overview.projects[0]?.collection.description ?? '',
    template_from: null,
    settings_override: {},
    objects: overview.workItems.map((workItem) => ({
      id: stableNumId(workItem.item.id),
      title: workItem.item.title || 'Untitled',
      object_type: kindToTypeSlug(workItem.item.kind),
    })),
  };
}

export async function gqlDailyLogs(): Promise<ApiDailyLog[]> {
  const items = await gqlItems();
  const groups = new Map<string, ItemGql[]>();
  for (const item of items) {
    const date = iso(item.createdAtMs).slice(0, 10);
    const existing = groups.get(date);
    if (existing) existing.push(item);
    else groups.set(date, [item]);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, dayItems], index) => ({
      id: index + 1,
      date,
      objects_created: dayItems.map((item) => ({
        id: stableNumId(item.id),
        title: item.title || 'Untitled',
        object_type: kindToTypeSlug(item.kind),
      })),
      objects_updated: [],
      edges_created: [],
      entities_resolved: [],
      summary: `${dayItems.length} object${dayItems.length === 1 ? '' : 's'} captured.`,
    }));
}

export async function gqlDailyLogByDate(date: string): Promise<ApiDailyLog | null> {
  const logs = await gqlDailyLogs();
  return logs.find((log) => log.date === date) ?? null;
}

/* ─────────────────────────────────────────────────
   Briefing: recent / newly-connected / open-thread items (the home ambient).
   ───────────────────────────────────────────────── */

export interface BriefingGqlShape {
  recent: ItemGql[];
  newlyConnected: { item: ItemGql; connections: number }[];
  openThreads: ItemGql[];
}

export async function gqlBriefing(): Promise<BriefingGqlShape> {
  const data = await gqlRead<{ briefing: BriefingGqlShape }>(
    `{ briefing { recent{ ${ITEM_FIELDS} } newlyConnected{ item{ ${ITEM_FIELDS} } connections } openThreads{ ${ITEM_FIELDS} } } }`,
    {},
    { briefing: { recent: [], newlyConnected: [], openThreads: [] } },
  );
  return data.briefing;
}

/* ─────────────────────────────────────────────────
   Map / Resurface / Artifacts over existing commonplace-api fields
   (discover for graph edges, briefing for resurface, items for artifacts).
   Approach credited to Codex's adapter (8cfb8c4); wired through this client.
   ───────────────────────────────────────────────── */

async function gqlDiscoverLinks(): Promise<{ a: string; b: string; similarity: number; reason: string }[]> {
  const data = await gqlRead<{ discover: { a: { id: string }; b: { id: string }; similarity: number; reason: string }[] }>(
    `query($min:Float,$max:Int){ discover(minSimilarity:$min,maxResults:$max){ a{ id } b{ id } similarity reason } }`,
    { min: 0.3, max: 80 },
    { discover: [] },
  );
  return data.discover.map((d) => ({ a: d.a.id, b: d.b.id, similarity: d.similarity, reason: d.reason }));
}

function extraString(extra: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = extra[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function extraNumber(extra: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = extra[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

/** Map / Network: items as nodes, discover (similar-but-unlinked pairs) as edges. */
export async function gqlGraph(): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const [items, raw] = await Promise.all([gqlItems(), gqlDiscoverLinks()]);
  const nodes: GraphNode[] = items.map((it) => ({
    id: it.id,
    objectRef: stableNumId(it.id),
    objectSlug: it.id,
    objectType: kindToTypeSlug(it.kind),
    title: it.title || 'Untitled',
    edgeCount: 0,
    bodyPreview: preview(it.bodyText, 120),
    status: 'active',
    communityId: extraString(it.extra, ['community_id', 'communityId', 'leiden_community']) ?? it.collections[0] ?? kindToTypeSlug(it.kind),
    centrality: extraNumber(it.extra, ['centrality', 'pagerank', 'ppr', 'degree_centrality']),
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: GraphLink[] = [];
  for (const l of raw) {
    const a = byId.get(l.a);
    const b = byId.get(l.b);
    if (a && b) {
      links.push({ source: l.a, target: l.b, reason: l.reason, strength: l.similarity });
      a.edgeCount += 1;
      b.edgeCount += 1;
    }
  }
  return { nodes, links };
}

/** Resurface: recent items surfaced from the briefing. */
export async function gqlResurface(count = 6): Promise<ApiResurfaceResponse> {
  const b = await gqlBriefing();
  const cards = b.recent.slice(0, count).map((it) => ({
    object: itemToObjectDetail(it),
    signal: 'recent',
    signal_label: 'Recent',
    explanation: 'Recently active in your substrate.',
    score: 0.5,
    actions: [] as string[],
  }));
  return { cards, meta: { count: cards.length } };
}

/** Artifacts: the captured items, shaped as the artifact list. */
export async function gqlArtifacts(): Promise<ApiArtifactListItem[]> {
  const items = await gqlItems();
  return items.map((it) => ({
    id: stableNumId(it.id),
    sha_hash: it.blobHash ?? '',
    title: it.title || 'Untitled',
    capture_kind: it.kind === 'link' ? 'url' : it.kind === 'file' || it.kind === 'image' ? 'file' : 'text',
    source_url: it.source ?? '',
    parser_type: it.kind,
    ingestion_status: 'extracted',
    epistemic_status: it.classification ?? '',
    notebook_slug: it.collections[0] ?? null,
    project_slug: null,
    projection_count: 0,
    raw_text_preview: preview(it.bodyText, 160),
    created_at: new Date(it.createdAtMs).toISOString(),
  }));
}

/* ─────────────────────────────────────────────────
   Organize: the auto-organize snapshot (the inbox-replacement).

   The organizing engine (commonplace `ingest.rs` classification + the standing
   pass) partitions arriving items by classification confidence against a single
   ceiling: at/above it an item auto-files and appears only in `organizedToday`;
   below it the item lands in `needsYou` with its alternative destinations so the
   surface can ask rather than guess. Classification is computed by the engine
   server-side (cosine of the item embedding to each collection's label
   embedding) and surfaced here -- it is never computed in the client.
   ───────────────────────────────────────────────── */

export type OrganizeItemKind =
  | 'task' | 'email' | 'note' | 'file' | 'event' | 'concept';

export interface OrganizeClassificationGql {
  targetCollectionId: string | null;
  targetCollectionLabel: string | null;
  confidence: number; // 0..1
  alternatives: { collectionId: string; label: string }[];
}

export interface OrganizeSubtask {
  text: string;
  done: boolean;
}

export interface OrganizeItemGql {
  id: string;
  kind: string; // OrganizeItemKind, widened (engine may coin kinds)
  title: string;
  preview: string;
  source: string;
  arrivedAt: string; // ISO timestamp or epoch-ms string (parsed leniently)
  classification: OrganizeClassificationGql;
  timeSensitive: boolean;
  expectedAction: 'reply' | 'open' | null;
  subtasks: OrganizeSubtask[]; // checkbox subtasks (task cards); empty otherwise
  tags: string[]; // surfaced on note cards
}

export interface OrganizeSnapshotGql {
  needsYou: OrganizeItemGql[];
  organizedToday: {
    mostRecent: { item: OrganizeItemGql; filedAt: string } | null;
    groups: { collectionId: string; label: string; count: number }[];
    totalCount: number;
  };
  dailyProgress: { timeframe: 'day' | 'week' | 'month'; done: number; total: number };
  needsYouCeiling: number;
}

export type OrganizeTimeframe = 'day' | 'week' | 'month';

const ORGANIZE_ITEM_FIELDS = `
  id kind title preview source arrivedAt timeSensitive expectedAction tags
  subtasks { text done }
  classification {
    targetCollectionId targetCollectionLabel confidence
    alternatives { collectionId label }
  }
`;

const EMPTY_ORGANIZE: OrganizeSnapshotGql = {
  needsYou: [],
  organizedToday: { mostRecent: null, groups: [], totalCount: 0 },
  dailyProgress: { timeframe: 'day', done: 0, total: 0 },
  needsYouCeiling: 0.58,
};

/** The auto-organize snapshot for a timeframe. Graceful-empty on a down backend
 *  (mirrors gqlBriefing) so the surface shows the calm cleared state, not a crash. */
export async function gqlOrganize(
  timeframe: OrganizeTimeframe = 'day',
  needsYouCeiling?: number,
): Promise<OrganizeSnapshotGql> {
  const data = await gqlRead<{ organize: OrganizeSnapshotGql }>(
    `query($tf:String,$c:Float){
       organize(timeframe:$tf, needsYouCeiling:$c){
         needsYou { ${ORGANIZE_ITEM_FIELDS} }
         organizedToday {
           mostRecent { item { ${ORGANIZE_ITEM_FIELDS} } filedAt }
           groups { collectionId label count }
           totalCount
         }
         dailyProgress { timeframe done total }
         needsYouCeiling
       }
     }`,
    { tf: timeframe, c: needsYouCeiling ?? null },
    { organize: { ...EMPTY_ORGANIZE, dailyProgress: { ...EMPTY_ORGANIZE.dailyProgress, timeframe } } },
  );
  return data.organize;
}
