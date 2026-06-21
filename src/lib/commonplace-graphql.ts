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
} from '@/lib/commonplace';
import type { ObjectSearchResult } from '@/lib/commonplace-api';

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
  path: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CollectionGql {
  id: string;
  name: string;
  kind: string;
  createdAtMs: number;
}

const ITEM_FIELDS = `
  id kind title bodyText blobHash mime source residency
  tags collections classification path createdAtMs updatedAtMs
`;

/* ─────────────────────────────────────────────────
   Transport
   ───────────────────────────────────────────────── */

class GraphqlError extends Error {}

/** Execute an operation. Throws on transport/GraphQL error (used for writes). */
export async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const onServer = typeof window === 'undefined';
  const url = onServer ? `${SERVER_GQL_URL}/graphql` : PROXY_PATH;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(onServer ? { 'x-api-key': SERVER_API_KEY } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
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
    edgeCount: 0,
    edges: [],
  };
}

export function itemToObjectListItem(item: ItemGql): ObjectListItem {
  const ident = getObjectTypeIdentity(kindToTypeSlug(item.kind));
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
    capture_method: 'typed',
    edge_count: 0,
  };
}

export function itemToObjectDetail(item: ItemGql): ApiObjectDetail {
  const ident = getObjectTypeIdentity(kindToTypeSlug(item.kind));
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
    capture_method: 'typed',
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
    `{ collections { id name kind createdAtMs } }`,
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
  source?: string;
  residency?: string;
}

export async function gqlIngest(input: IngestArgs): Promise<ItemGql> {
  const data = await gql<{ ingest: ItemGql }>(
    `mutation($input:IngestInputGql!){ ingest(input:$input){ ${ITEM_FIELDS} } }`,
    {
      input: {
        title: input.title ?? '',
        text: input.text,
        kind: input.kind ?? 'note',
        tags: input.tags ?? [],
        source: input.source ?? null,
        residency: input.residency ?? null,
      },
    },
  );
  return data.ingest;
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
    `mutation($name:String!){ createCollection(name:$name){ id name kind createdAtMs } }`,
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

/** Capture write -> ingest -> ApiCaptureResponse (mirrors POST /capture/). */
export async function gqlCapture(data: {
  content: string;
  hint_type?: string;
  title?: string;
}): Promise<ApiCaptureResponse> {
  const item = await gqlIngest({
    title: data.title,
    text: data.content,
    kind: typeSlugToKind(data.hint_type),
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

/* ─────────────────────────────────────────────────
   Notebooks <- collections (a notebook is a collection of items).
   ───────────────────────────────────────────────── */

const NOTEBOOK_COLORS = ['#2D5F6B', '#C49A4A', '#5A7A4A', '#8B6FA0', '#4A7A9A', '#B06080', '#C47A3A'];

export async function gqlNotebooks(): Promise<ApiNotebookListItem[]> {
  const cols = await gqlCollections();
  return cols.map((c, i) => ({
    id: stableNumId(c.id),
    name: c.name,
    slug: c.id,
    description: '',
    color: NOTEBOOK_COLORS[i % NOTEBOOK_COLORS.length],
    icon: 'book',
    is_active: true,
    sort_order: i,
    object_count: 0,
  }));
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
