/**
 * CommonPlace API client: typed fetch wrapper, response mappers,
 * error handling, and the useApiData hook.
 *
 * Single source of truth for CommonPlace communication. The current public
 * panes read from the Theorem/CommonPlace GraphQL consumer contract and map
 * that shape to
 * existing frontend types (MockNode, GraphNode, GraphLink) so
 * components don't need to change their rendering logic.
 *
 * Legacy helpers still use optional Bearer token auth via
 * NEXT_PUBLIC_COMMONPLACE_API_TOKEN. GraphQL calls go through the server-side
 * proxy route so API keys stay outside browser code.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  MockNode,
  GraphNode,
  GraphLink,
  ApiFeedNode,
  ApiFeedResponse,
  ApiGraphResponse,
  ApiGraphObject,
  ApiEdgeCompact,
  ApiObjectDetail,
  ApiCaptureResponse,
  ApiComposeResponse,
  ApiComposeObject,
  ApiComposePassState,
  ApiCanvasSuggestion,
  ApiEngineJobStatus,
  ComposePassId,
  ComposeResultSignal,
  ApiResurfaceResponse,
  ApiNotebookListItem,
  ApiNotebookDetail,
  NotebookObjectCompact,
  ApiProjectListItem,
  ApiProjectDetail,
  ApiDailyLog,
  CapturedObject,
  ObjectListItem,
  ClusterResponse,
  LineageResponse,
  ApiSelfOrganizePreview,
  ApiPromotionItem,
  ApiEmergentTypeSuggestion,
  ApiArtifactListItem,
  ApiNotebookHealth,
  ApiTemporalEvolution,
  EngineConfig,
  NavigationTarget,
} from '@/lib/commonplace';
import { API_BASE, EPISTEMIC_BASE, getObjectTypeIdentity } from '@/lib/commonplace';

/* ─────────────────────────────────────────────────
   Error class
   ───────────────────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public isNetworkError = false,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ─────────────────────────────────────────────────
   Auth header
   ───────────────────────────────────────────────── */

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_COMMONPLACE_API_TOKEN
      : undefined;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/* ─────────────────────────────────────────────────
   Base fetch wrapper
   ───────────────────────────────────────────────── */

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  return _doFetch<T>(url, options);
}

/** Legacy-only fetch for epistemic REST helpers that do not yet have a GraphQL contract. */
export async function epistemicFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${EPISTEMIC_BASE}${path}`;
  return _doFetch<T>(url, options);
}

async function _doFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { ...getAuthHeaders(), ...options?.headers },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        body.detail ?? body.error ?? `API error ${res.status}`,
      );
    }
    return res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      0,
      'Network error: could not reach CommonPlace API',
      true,
    );
  }
}

/* ─────────────────────────────────────────────────
   Theorem/CommonPlace GraphQL consumer contract
   ───────────────────────────────────────────────── */

const COMMONPLACE_GRAPHQL_ENDPOINT = '/api/commonplace/graphql';

const COMMONPLACE_ITEM_FIELDS = `
  id
  kind
  title
  bodyText
  blobHash
  mime
  source
  residency
  tags
  collections
  classification
  path
  createdAtMs
  updatedAtMs
`;

const COLLECTION_COLORS = ['#2D5F6B', '#8B6FA0', '#B45A2D', '#5A7A4A', '#C49A4A'];

interface CommonplaceGraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

interface CommonplaceItemGql {
  id: string;
  kind: string;
  title: string;
  bodyText?: string | null;
  blobHash?: string | null;
  mime?: string | null;
  source?: string | null;
  residency: string;
  tags: string[];
  collections: string[];
  classification?: string | null;
  path?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

interface CommonplaceCollectionGql {
  id: string;
  name: string;
  kind: string;
  createdAtMs: number;
}

interface CommonplaceConnectedItemGql {
  item: CommonplaceItemGql;
  connections: number;
  related: CommonplaceItemGql[];
}

interface CommonplaceBriefingGql {
  recent: CommonplaceItemGql[];
  newlyConnected: CommonplaceConnectedItemGql[];
  openThreads: CommonplaceItemGql[];
}

interface CommonplaceCandidateLinkGql {
  a: { id: string };
  b: { id: string };
  similarity: number;
  reason: string;
}

type HomeActivityType = 'connection' | 'tension' | 'cluster' | 'enrichment';

interface CommonplaceHomeData {
  hero_question: {
    text: string;
    evidence: { entities: number; bridges: number; holes: number };
    evidence_score: number;
    tension_score: number;
    target?: NavigationTarget;
  };
  activity: Array<{
    id: number;
    type: HomeActivityType;
    time: string;
    text: string;
    strength: number | null;
    is_new: boolean;
    target?: NavigationTarget;
  }>;
  threads: Array<{
    id: number;
    object_type: string;
    title: string;
    heat: number;
    objects: number;
    metadata: Record<string, unknown>;
    color?: string;
    target?: NavigationTarget;
  }>;
  pending_reviews: number;
  pending_reviews_target?: NavigationTarget;
}

const commonplaceIdByNumericRef = new Map<number, string>();
const numericRefByCommonplaceId = new Map<string, number>();

async function commonplaceGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(COMMONPLACE_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: variables ?? {} }),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(
      0,
      'Network error: could not reach Theorem CommonPlace GraphQL',
      true,
    );
  }

  let payload: CommonplaceGraphqlResponse<T>;
  try {
    payload = await res.json() as CommonplaceGraphqlResponse<T>;
  } catch {
    throw new ApiError(
      res.status,
      `Theorem CommonPlace GraphQL returned HTTP ${res.status}`,
    );
  }

  if (!res.ok) {
    const message = payload.errors?.map((err) => err.message).filter(Boolean).join('; ');
    throw new ApiError(res.status, message || `Theorem CommonPlace GraphQL error ${res.status}`);
  }

  if (payload.errors?.length) {
    const message = payload.errors.map((err) => err.message).filter(Boolean).join('; ');
    throw new ApiError(res.status, message || 'Theorem CommonPlace GraphQL returned errors');
  }

  if (!payload.data) {
    throw new ApiError(res.status, 'Theorem CommonPlace GraphQL returned no data');
  }

  return payload.data;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function stablePositiveId(value: string): number {
  const numeric = extractNumericId(value);
  if (numeric > 0) return numeric;

  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483646 + 1;
}

function registerCommonplaceItem(item: CommonplaceItemGql): number {
  const existing = numericRefByCommonplaceId.get(item.id);
  if (existing) return existing;

  let ref = stablePositiveId(item.id);
  while (commonplaceIdByNumericRef.has(ref) && commonplaceIdByNumericRef.get(ref) !== item.id) {
    ref += 1;
  }

  commonplaceIdByNumericRef.set(ref, item.id);
  numericRefByCommonplaceId.set(item.id, ref);
  return ref;
}

function toIso(ms?: number): string {
  return new Date(ms || Date.now()).toISOString();
}

function previewText(text?: string | null, maxLength = 180): string {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function titleOrUntitled(item: CommonplaceItemGql): string {
  return item.title?.trim() || 'Untitled';
}

function labelFromKind(kind: string): string {
  return kind
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Collection';
}

function relativeTimeFromMs(ms: number): string {
  const diffMs = Date.now() - ms;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return toIso(ms).slice(0, 10);
}

function itemTarget(item: CommonplaceItemGql): NavigationTarget {
  return {
    kind: 'object',
    object: { id: registerCommonplaceItem(item), slug: item.id },
  };
}

function mapCommonplaceItemToMockNode(item: CommonplaceItemGql): MockNode {
  const objectRef = registerCommonplaceItem(item);
  return {
    id: item.id,
    objectRef,
    objectSlug: item.id,
    objectType: item.kind || 'note',
    title: titleOrUntitled(item),
    summary: previewText(item.bodyText, 240),
    capturedAt: toIso(item.createdAtMs),
    edgeCount: item.collections.length,
    edges: [],
  };
}

function mapCommonplaceItemToObjectDetail(
  item: CommonplaceItemGql,
  edges: ApiEdgeCompact[] = [],
): ApiObjectDetail {
  const objectRef = registerCommonplaceItem(item);
  const identity = getObjectTypeIdentity(item.kind || 'note');
  const title = titleOrUntitled(item);
  return {
    id: objectRef,
    title,
    display_title: title,
    slug: item.id,
    object_type: stablePositiveId(`type:${item.kind || 'note'}`),
    object_type_data: {
      slug: item.kind || 'note',
      name: identity.label,
      icon: identity.icon,
      color: identity.color,
    },
    body: item.bodyText ?? '',
    url: item.source ?? '',
    og_title: null,
    og_description: item.classification ?? null,
    status: item.residency || 'active',
    captured_at: toIso(item.createdAtMs),
    capture_method: item.source ? 'url' : 'text',
    edges,
    components: item.tags.map((tag, index) => ({
      id: stablePositiveId(`${item.id}:tag:${tag}`),
      component_type: 0,
      component_type_name: 'Tag',
      data_type: 'tag',
      key: `tag:${index}`,
      value: tag,
      sort_order: index,
    })),
    recent_nodes: [{
      id: stablePositiveId(`${item.id}:node`),
      sha_hash: item.blobHash ?? item.id,
      node_type: 'capture',
      occurred_at: toIso(item.updatedAtMs || item.createdAtMs),
      title,
      object_ref: objectRef,
      object_title: title,
      object_type: item.kind || 'note',
      object_slug: item.id,
    }],
    object_claims: [],
  };
}

function mapCommonplaceItemToNotebookObject(item: CommonplaceItemGql): NotebookObjectCompact {
  return {
    id: registerCommonplaceItem(item),
    title: titleOrUntitled(item),
    object_type: item.kind || 'note',
    body_preview: previewText(item.bodyText, 180),
    edge_count: item.collections.length,
    captured_at: toIso(item.createdAtMs),
    url: item.source ?? '',
    is_starred: false,
    is_pinned: false,
    status: item.residency || 'active',
  };
}

function mapCollectionToNotebook(
  collection: CommonplaceCollectionGql,
  objectCount: number,
  index: number,
): ApiNotebookListItem {
  return {
    id: stablePositiveId(`collection:${collection.id}`),
    name: collection.name,
    slug: collection.id,
    description: `${labelFromKind(collection.kind)} collection`,
    color: COLLECTION_COLORS[index % COLLECTION_COLORS.length],
    icon: 'book',
    is_active: true,
    sort_order: index,
    object_count: objectCount,
  };
}

function mapCollectionToProject(
  collection: CommonplaceCollectionGql,
): ApiProjectListItem {
  return {
    id: stablePositiveId(`project:${collection.id}`),
    name: collection.name,
    slug: collection.id,
    mode: collection.kind === 'manual' ? 'collect' : collection.kind,
    status: 'active',
    notebook: null,
    notebook_name: null,
    is_template: false,
    reminder_at: null,
  };
}

function mapItemToArtifact(item: CommonplaceItemGql): ApiArtifactListItem {
  const hasUrl = Boolean(item.source?.startsWith('http://') || item.source?.startsWith('https://'));
  const captureKind: ApiArtifactListItem['capture_kind'] = hasUrl
    ? 'url'
    : item.mime || item.blobHash
      ? 'file'
      : 'text';
  const ingestionStatus: ApiArtifactListItem['ingestion_status'] = item.bodyText || item.classification
    ? 'extracted'
    : 'captured';

  return {
    id: registerCommonplaceItem(item),
    sha_hash: item.id,
    title: titleOrUntitled(item),
    capture_kind: captureKind,
    source_url: item.source ?? '',
    parser_type: item.mime ?? item.kind ?? '',
    ingestion_status: ingestionStatus,
    epistemic_status: item.classification ?? item.residency ?? 'active',
    notebook_slug: item.collections[0] ?? null,
    project_slug: null,
    projection_count: item.collections.length,
    raw_text_preview: previewText(item.bodyText, 240),
    extraction_summary: item.tags.length > 0
      ? { claims: 0, entities: item.tags.length, questions: 0, rules: 0, methods: 0 }
      : undefined,
    created_at: toIso(item.createdAtMs),
  };
}

async function fetchCommonplaceItems(kind?: string): Promise<CommonplaceItemGql[]> {
  const data = await commonplaceGraphql<{ items: CommonplaceItemGql[] }>(
    `query CommonplaceItems($kind: String) {
      items(kind: $kind) { ${COMMONPLACE_ITEM_FIELDS} }
    }`,
    { kind: kind || null },
  );
  return data.items ?? [];
}

async function fetchCommonplaceItem(id: string): Promise<CommonplaceItemGql> {
  const data = await commonplaceGraphql<{ item: CommonplaceItemGql | null }>(
    `query CommonplaceItem($id: String!) {
      item(id: $id) { ${COMMONPLACE_ITEM_FIELDS} }
    }`,
    { id },
  );
  if (!data.item) {
    throw new ApiError(404, 'CommonPlace item not found');
  }
  registerCommonplaceItem(data.item);
  return data.item;
}

async function fetchCommonplaceItemByNumericRef(id: number): Promise<CommonplaceItemGql> {
  const knownId = commonplaceIdByNumericRef.get(id);
  if (knownId) return fetchCommonplaceItem(knownId);

  const items = await fetchCommonplaceItems();
  const match = items.find((item) => registerCommonplaceItem(item) === id);
  if (!match) {
    throw new ApiError(404, 'CommonPlace item not found');
  }
  return match;
}

async function fetchCommonplaceCollectionsWithItems(): Promise<{
  collections: CommonplaceCollectionGql[];
  items: CommonplaceItemGql[];
}> {
  const data = await commonplaceGraphql<{
    collections: CommonplaceCollectionGql[];
    items: CommonplaceItemGql[];
  }>(
    `query CommonplaceCollections {
      collections { id name kind createdAtMs }
      items { id collections }
    }`,
  );
  return {
    collections: data.collections ?? [],
    items: data.items ?? [],
  };
}

function countItemsByCollection(items: Pick<CommonplaceItemGql, 'collections'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const collectionId of item.collections) {
      counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
    }
  }
  return counts;
}

function mapBriefingToHome(briefing: CommonplaceBriefingGql): CommonplaceHomeData {
  const recent = briefing.recent ?? [];
  const connected = briefing.newlyConnected ?? [];
  const openThreads = briefing.openThreads ?? [];
  const heroItem = openThreads[0] ?? connected[0]?.item ?? recent[0];
  const bridgeCount = connected[0]?.connections ?? connected.length;
  const evidenceEntities = heroItem ? new Set([...heroItem.tags, ...heroItem.collections]).size : 0;

  const activity = [
    ...connected.slice(0, 5).map((entry) => ({
      id: registerCommonplaceItem(entry.item),
      type: 'connection' as HomeActivityType,
      time: relativeTimeFromMs(entry.item.updatedAtMs || entry.item.createdAtMs),
      text: `${titleOrUntitled(entry.item)} has ${entry.connections} live connection${entry.connections === 1 ? '' : 's'}.`,
      strength: clamp(Math.round(entry.connections * 14), 20, 100),
      is_new: true,
      target: itemTarget(entry.item),
    })),
    ...recent.slice(0, 5).map((item) => ({
      id: registerCommonplaceItem(item),
      type: 'enrichment' as HomeActivityType,
      time: relativeTimeFromMs(item.updatedAtMs || item.createdAtMs),
      text: `Captured ${titleOrUntitled(item)}.`,
      strength: null,
      is_new: false,
      target: itemTarget(item),
    })),
  ].slice(0, 8);

  const threads = (openThreads.length > 0 ? openThreads : recent).slice(0, 6).map((item) => {
    const identity = getObjectTypeIdentity(item.kind || 'note');
    const threadType = item.kind === 'task' || item.kind === 'event'
      ? item.kind
      : ['paper', 'source', 'doc', 'file', 'link'].includes(item.kind)
        ? 'research'
        : 'concept';
    const created = new Date(toIso(item.createdAtMs));
    return {
      id: registerCommonplaceItem(item),
      object_type: threadType,
      title: titleOrUntitled(item),
      heat: clamp(0.25 + item.tags.length * 0.08 + item.collections.length * 0.05, 0.25, 1),
      objects: Math.max(1, item.tags.length + item.collections.length),
      color: identity.color,
      target: itemTarget(item),
      metadata: {
        snippet: previewText(item.bodyText, 120),
        connections: item.collections.length,
        clusters: item.tags.slice(0, 4),
        project: item.collections[0],
        month: created.toLocaleString('en-US', { month: 'short' }),
        day: String(created.getDate()),
        status: item.residency,
      },
    };
  });

  return {
    hero_question: {
      text: heroItem
        ? `What should connect next around ${titleOrUntitled(heroItem)}?`
        : '',
      evidence: {
        entities: evidenceEntities,
        bridges: bridgeCount,
        holes: openThreads.length,
      },
      evidence_score: clamp(bridgeCount * 12, 0, 100),
      tension_score: clamp(openThreads.length * 10, 0, 100),
      target: heroItem ? itemTarget(heroItem) : undefined,
    },
    activity,
    threads,
    pending_reviews: connected.length,
    pending_reviews_target: {
      kind: 'view',
      view: { type: 'connection-review' },
    },
  };
}

/* ─────────────────────────────────────────────────
   Mapping: /feed/ → MockNode[]
   ───────────────────────────────────────────────── */

/** Extract numeric ID from prefixed string ("node:4" -> 4, "object:7" -> 7) */
function extractNumericId(prefixed: string): number {
  const parts = prefixed.split(':');
  return parseInt(parts[parts.length - 1], 10) || 0;
}

function mapFeedNodeToMockNode(node: ApiFeedNode): MockNode {
  const objectRef = extractNumericId(node.object_id ?? '0');
  return {
    id: node.id,
    objectRef,
    // Feed may omit slug; ObjectDrawer accepts numeric IDs too.
    objectSlug: node.object_slug || (objectRef > 0 ? String(objectRef) : ''),
    objectType: node.object_type ?? '',
    title: node.title,
    summary: node.body ?? '',
    capturedAt: node.timestamp,
    edgeCount: 0,
    edges: [],
  };
}

/* ─────────────────────────────────────────────────
   Mapping: /graph/ → { nodes: GraphNode[], links: GraphLink[] }
   ───────────────────────────────────────────────── */

function mapGraphResponseToD3(resp: ApiGraphResponse): {
  nodes: GraphNode[];
  links: GraphLink[];
} {
  const nodes: GraphNode[] = resp.nodes.map((o: ApiGraphObject) => ({
    id: o.id,
    objectRef: extractNumericId(o.id),
    objectSlug: o.slug,
    objectType: o.object_type,
    title: o.title,
    edgeCount: o.edge_count,
    bodyPreview: o.body_preview,
    status: o.status,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: GraphLink[] = resp.edges
    .filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    )
    .map((e) => ({
      source: e.source,
      target: e.target,
      reason: e.reason,
      edge_type: e.edge_type,
      strength: e.strength,
      engine: e.engine,
    }));

  return { nodes, links };
}

/* ─────────────────────────────────────────────────
   API endpoint functions
   ───────────────────────────────────────────────── */

/** Fetch timeline feed, mapped to MockNode[] */
export async function fetchFeed(params?: {
  page?: number;
  per_page?: number;
  object_type?: string;
  notebook?: string;
  project?: string;
}): Promise<MockNode[]> {
  const page = Math.max(1, params?.page ?? 1);
  const perPage = params?.per_page ?? 100;
  const items = await fetchCommonplaceItems(params?.object_type);
  const filtered = items
    .filter((item) => {
      if (params?.notebook && !item.collections.includes(params.notebook)) return false;
      if (params?.project && !item.collections.includes(params.project)) return false;
      return true;
    })
    .sort((a, b) => b.createdAtMs - a.createdAtMs);

  return filtered
    .slice((page - 1) * perPage, page * perPage)
    .map(mapCommonplaceItemToMockNode);
}

/** Fetch graph data (objects + edges), mapped to D3 format */
export async function fetchGraph(params?: {
  object_type?: string;
  notebook?: string;
}): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const data = await commonplaceGraphql<{
    items: CommonplaceItemGql[];
    discover: CommonplaceCandidateLinkGql[];
  }>(
    `query CommonplaceGraph($kind: String, $maxResults: Int) {
      items(kind: $kind) { ${COMMONPLACE_ITEM_FIELDS} }
      discover(minSimilarity: 0.45, maxResults: $maxResults) {
        a { id }
        b { id }
        similarity
        reason
      }
    }`,
    { kind: params?.object_type ?? null, maxResults: 80 },
  );

  const items = (data.items ?? []).filter((item) => (
    params?.notebook ? item.collections.includes(params.notebook) : true
  ));
  const itemIds = new Set(items.map((item) => item.id));
  const links: GraphLink[] = (data.discover ?? [])
    .filter((link) => itemIds.has(link.a.id) && itemIds.has(link.b.id))
    .map((link) => ({
      source: link.a.id,
      target: link.b.id,
      reason: link.reason,
      edge_type: 'similar_to',
      strength: link.similarity,
      engine: 'theorem-commonplace-discover',
    }));

  const edgeCounts = new Map<string, number>();
  for (const link of links) {
    const source = typeof link.source === 'string' ? link.source : link.source.id;
    const target = typeof link.target === 'string' ? link.target : link.target.id;
    edgeCounts.set(source, (edgeCounts.get(source) ?? 0) + 1);
    edgeCounts.set(target, (edgeCounts.get(target) ?? 0) + 1);
  }

  const nodes: GraphNode[] = items.map((item) => ({
    id: item.id,
    objectRef: registerCommonplaceItem(item),
    objectSlug: item.id,
    objectType: item.kind || 'note',
    title: titleOrUntitled(item),
    edgeCount: edgeCounts.get(item.id) ?? item.collections.length,
    bodyPreview: previewText(item.bodyText, 160),
    status: item.residency,
  }));

  return { nodes, links };
}

/** Fetch single object detail by slug */
export async function fetchObjectDetail(
  slug: string,
): Promise<ApiObjectDetail> {
  const item = await fetchCommonplaceItem(slug);
  return mapCommonplaceItemToObjectDetail(item);
}

/** Fetch single object detail by numeric ID */
export async function fetchObjectById(
  id: number,
): Promise<ApiObjectDetail> {
  const item = await fetchCommonplaceItemByNumericRef(id);
  return mapCommonplaceItemToObjectDetail(item);
}

export async function postObjectConnection(
  slug: string,
  payload: {
    target_slug: string;
    edge_type?: string;
    reason?: string;
  },
) {
  return apiFetch(`/objects/${slug}/connect/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Search objects by title / search_text via GET /objects/?q=... */
export interface ObjectSearchResult {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  object_type_name: string;
  object_type_color: string;
  status: string;
  captured_at: string;
}

export async function searchObjects(
  query: string,
  limit = 10,
): Promise<ObjectSearchResult[]> {
  if (!query.trim()) return [];
  try {
    const qs = new URLSearchParams({
      q: query,
      page_size: String(limit),
    });
    const data = await apiFetch<{ results: ObjectSearchResult[] }>(
      `/objects/?${qs}`,
    );
    return data.results ?? [];
  } catch {
    return [];
  }
}

export async function exportNotebookZip(notebookSlug?: string): Promise<Blob> {
  const search = new URLSearchParams();
  if (notebookSlug) search.set('notebook', notebookSlug);
  const qs = search.toString();
  const url = `${API_BASE}/export/${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.detail ?? body.error ?? `API error ${res.status}`,
    );
  }
  return res.blob();
}

export interface ComposeLiveResult {
  id: string;
  objectId: number;
  slug: string;
  type: string;
  typeColor: string;
  title: string;
  bodyPreview: string;
  score: number;
  signal: ComposeResultSignal;
  explanation: string;
  supportingSignals: ComposeResultSignal[];
}

export interface ComposeLiveResponse {
  queryId: string;
  textLength: number;
  passesRun: string[];
  passStates: ApiComposePassState[];
  results: ComposeLiveResult[];
  degraded: {
    degraded: boolean;
    sbertUnavailable: boolean;
    nliUnavailable: boolean;
    kgeUnavailable: boolean;
    reasons: string[];
  };
}

function mapComposeResult(item: ApiComposeObject): ComposeLiveResult {
  return {
    id: item.id,
    objectId: extractNumericId(item.id),
    slug: item.slug,
    type: item.type,
    typeColor: item.type_color,
    title: item.title,
    bodyPreview: item.body_preview,
    score: item.score,
    signal: item.signal,
    explanation: item.explanation,
    supportingSignals: item.supporting_signals ?? [],
  };
}

export async function fetchComposeRelated(data: {
  text: string;
  notebook_slug?: string;
  limit?: number;
  min_score?: number;
  enable_nli?: boolean;
  passes?: ComposePassId[];
  signal?: AbortSignal;
}): Promise<ComposeLiveResponse> {
  const { signal, ...payload } = data;
  const resp = await apiFetch<ApiComposeResponse>('/compose/related/', {
    method: 'POST',
    signal,
    body: JSON.stringify(payload),
  });

  return {
    queryId: resp.query_id,
    textLength: resp.text_length,
    passesRun: resp.passes_run ?? [],
    passStates: resp.pass_states ?? [],
    results: (resp.objects ?? []).map(mapComposeResult),
    degraded: {
      degraded: !!resp.degraded?.degraded,
      sbertUnavailable: !!resp.degraded?.sbert_unavailable,
      nliUnavailable: !!resp.degraded?.nli_unavailable,
      kgeUnavailable: !!resp.degraded?.kge_unavailable,
      reasons: resp.degraded?.reasons ?? [],
    },
  };
}

/** Capture a new object via POST /capture/ */
export async function captureToApi(data: {
  content: string;
  hint_type?: string;
  title?: string;
  notebook_slug?: string;
  project_slug?: string;
  file?: File;
}): Promise<ApiCaptureResponse> {
  /* When a file is attached (PDF, binary), send as multipart/form-data
     so the server receives the actual bytes for extraction.
     The browser auto-sets the Content-Type boundary for FormData. */
  if (data.file) {
    const form = new FormData();
    form.append('file', data.file);
    if (data.content) form.append('content', data.content);
    if (data.hint_type) form.append('hint_type', data.hint_type);
    if (data.title) form.append('title', data.title);
    if (data.notebook_slug) form.append('notebook_slug', data.notebook_slug);
    if (data.project_slug) form.append('project_slug', data.project_slug);

    const url = `${API_BASE}/capture/`;
    const headers: HeadersInit = {};
    const token =
      typeof process !== 'undefined'
        ? process.env.NEXT_PUBLIC_COMMONPLACE_API_TOKEN
        : undefined;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: form,
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        body.detail ?? body.error ?? `API error ${res.status}`,
      );
    }
    return res.json();
  }

  return apiFetch<ApiCaptureResponse>('/capture/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchEngineJobStatus(
  jobId: string,
): Promise<ApiEngineJobStatus> {
  return apiFetch<ApiEngineJobStatus>(`/engine/jobs/${jobId}/`);
}

export async function fetchCanvasSuggestions(
  objectIds: number[],
  hint?: string,
): Promise<ApiCanvasSuggestion[]> {
  const payload: { object_ids: number[]; hint?: string } = { object_ids: objectIds };
  if (hint) payload.hint = hint;

  const resp = await apiFetch<{ specs: ApiCanvasSuggestion[] }>('/canvas/suggest/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return resp.specs ?? [];
}

/** Post a retrospective reflection on a node */
export async function postRetrospective(
  nodeId: string | number,
  text: string,
): Promise<{ ok: boolean }> {
  await apiFetch(`/nodes/${nodeId}/retrospective/`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return { ok: true };
}

/** Fetch resurface suggestions */
export async function fetchResurface(params?: {
  count?: number;
  notebook?: string;
  project?: string;
  exclude?: number[];
}): Promise<ApiResurfaceResponse> {
  const count = params?.count ?? 5;
  const excluded = new Set(params?.exclude ?? []);
  const data = await commonplaceGraphql<{ briefing: CommonplaceBriefingGql }>(
    `query CommonplaceResurface($limit: Int) {
      briefing(recentLimit: $limit, connectedLimit: $limit, openLimit: $limit) {
        recent { ${COMMONPLACE_ITEM_FIELDS} }
        newlyConnected {
          connections
          item { ${COMMONPLACE_ITEM_FIELDS} }
          related { id title kind createdAtMs updatedAtMs tags collections residency }
        }
        openThreads { ${COMMONPLACE_ITEM_FIELDS} }
      }
    }`,
    { limit: count * 2 },
  );

  const seen = new Set<string>();
  const cards: ApiResurfaceResponse['cards'] = [];
  const addCard = (
    item: CommonplaceItemGql,
    signal: string,
    signalLabel: string,
    explanation: string,
    score: number,
  ) => {
    const objectRef = registerCommonplaceItem(item);
    if (excluded.has(objectRef) || seen.has(item.id)) return;
    if (params?.notebook && !item.collections.includes(params.notebook)) return;
    if (params?.project && !item.collections.includes(params.project)) return;
    seen.add(item.id);
    cards.push({
      object: mapCommonplaceItemToObjectDetail(item),
      signal,
      signal_label: signalLabel,
      explanation,
      score,
      actions: ['Open'],
    });
  };

  for (const connected of data.briefing.newlyConnected ?? []) {
    addCard(
      connected.item,
      'connection',
      'New connection',
      `${connected.connections} related item${connected.connections === 1 ? '' : 's'} are active around this.`,
      clamp(0.45 + connected.connections * 0.08, 0.45, 1),
    );
  }
  for (const item of data.briefing.openThreads ?? []) {
    addCard(item, 'open_thread', 'Open thread', 'Theorem flagged this as an active thread.', 0.68);
  }
  for (const item of data.briefing.recent ?? []) {
    addCard(item, 'recent', 'Recently captured', 'Recent CommonPlace activity from the Theorem gateway.', 0.52);
  }

  return {
    cards: cards.slice(0, count),
    meta: { count: cards.length },
  };
}

/* ─────────────────────────────────────────────────
   Notebook + Project endpoint functions
   ───────────────────────────────────────────────── */

/** Fetch all notebooks. Handles both flat array and paginated envelope. */
export async function fetchNotebooks(): Promise<ApiNotebookListItem[]> {
  const { collections, items } = await fetchCommonplaceCollectionsWithItems();
  const counts = countItemsByCollection(items);
  return collections.map((collection, index) => (
    mapCollectionToNotebook(collection, counts.get(collection.id) ?? 0, index)
  ));
}

/** Create a new notebook */
export async function createNotebook(data: {
  name: string;
  description?: string;
  color?: string;
}): Promise<ApiNotebookListItem> {
  const result = await commonplaceGraphql<{ createCollection: CommonplaceCollectionGql }>(
    `mutation CreateCommonplaceCollection($name: String!) {
      createCollection(name: $name) { id name kind createdAtMs }
    }`,
    { name: data.name },
  );
  const notebook = mapCollectionToNotebook(result.createCollection, 0, 0);
  return {
    ...notebook,
    color: data.color || notebook.color,
    description: data.description || notebook.description,
  };
}

/** Fetch a single notebook by slug */
export async function fetchNotebookBySlug(
  slug: string,
): Promise<ApiNotebookDetail> {
  const data = await commonplaceGraphql<{
    collection: CommonplaceCollectionGql | null;
    collectionItems: CommonplaceItemGql[];
  }>(
    `query CommonplaceCollectionDetail($id: String!) {
      collection(id: $id) { id name kind createdAtMs }
      collectionItems(id: $id) { ${COMMONPLACE_ITEM_FIELDS} }
    }`,
    { id: slug },
  );
  if (!data.collection) {
    throw new ApiError(404, 'CommonPlace collection not found');
  }
  const notebook = mapCollectionToNotebook(data.collection, data.collectionItems.length, 0);
  return {
    ...notebook,
    engine_config: {},
    available_types: [],
    default_layout: null,
    theme: {},
    objects: data.collectionItems.map(mapCommonplaceItemToNotebookObject),
    visibility: 'private',
  };
}

/** GET /notebooks/<slug>/health/ */
export async function fetchNotebookHealth(
  slug: string,
): Promise<ApiNotebookHealth> {
  const data = await commonplaceGraphql<{ collectionItems: CommonplaceItemGql[] }>(
    `query CommonplaceCollectionHealth($id: String!) {
      collectionItems(id: $id) { id collections tags }
    }`,
    { id: slug },
  );
  const objectCount = data.collectionItems.length;
  const edgeCount = data.collectionItems.reduce((sum, item) => sum + item.collections.length, 0);
  return {
    object_count: objectCount,
    edge_count: edgeCount,
    density: objectCount > 1 ? edgeCount / (objectCount * (objectCount - 1)) : 0,
    last_engine_run: null,
    cluster_count: new Set(data.collectionItems.flatMap((item) => item.tags)).size,
  };
}

/** PATCH /notebooks/<slug>/engine-config/ (granular passes/modules config) */
export async function patchEngineConfig(
  slug: string,
  config: Partial<EngineConfig>,
): Promise<EngineConfig> {
  return apiFetch<EngineConfig>(`/notebooks/${slug}/engine-config/`, {
    method: 'PATCH',
    body: JSON.stringify(config),
  });
}

/** POST /notebooks/<slug>/add-objects/ (drag-drop batch assignment) */
export async function batchAddObjects(
  slug: string,
  objectIds: number[],
): Promise<{ assigned: number }> {
  return apiFetch<{ assigned: number }>(`/notebooks/${slug}/add-objects/`, {
    method: 'POST',
    body: JSON.stringify({ object_ids: objectIds }),
  });
}

/** GET /temporal/?notebook=<slug> */
export async function fetchTemporalEvolution(
  slug: string,
  windowDays?: number,
  stepDays?: number,
): Promise<ApiTemporalEvolution> {
  const search = new URLSearchParams({ notebook: slug });
  if (windowDays) search.set('window_days', String(windowDays));
  if (stepDays) search.set('step_days', String(stepDays));
  return apiFetch<ApiTemporalEvolution>(`/temporal/?${search}`);
}

/** PATCH /notebooks/<slug>/ for visibility, available_types, etc. */
export async function patchNotebook(
  slug: string,
  data: Partial<{
    visibility: string;
    available_types: string[];
    engine_config: EngineConfig;
    name: string;
    description: string;
  }>,
): Promise<ApiNotebookDetail> {
  return apiFetch<ApiNotebookDetail>(`/notebooks/${slug}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/** Fetch all projects, optionally filtered by notebook or status. Handles both flat array and paginated envelope. */
export async function fetchProjects(params?: {
  notebook?: string;
  status?: string;
}): Promise<ApiProjectListItem[]> {
  const { collections } = await fetchCommonplaceCollectionsWithItems();
  return collections
    .map(mapCollectionToProject)
    .filter((project) => {
      if (params?.status && project.status !== params.status) return false;
      if (params?.notebook && project.notebook !== params.notebook) return false;
      return true;
    });
}

/** Create a new project */
export async function createProject(data: {
  name: string;
  notebook?: string;
  mode?: string;
  description?: string;
}): Promise<ApiProjectListItem> {
  const result = await commonplaceGraphql<{ createCollection: CommonplaceCollectionGql }>(
    `mutation CreateCommonplaceProject($name: String!) {
      createCollection(name: $name) { id name kind createdAtMs }
    }`,
    { name: data.name },
  );
  return {
    ...mapCollectionToProject(result.createCollection),
    mode: data.mode || 'collect',
    notebook: data.notebook ?? null,
  };
}

/** Fetch a single project by slug */
export async function fetchProjectBySlug(
  slug: string,
): Promise<ApiProjectDetail> {
  const data = await commonplaceGraphql<{
    collection: CommonplaceCollectionGql | null;
    collectionItems: CommonplaceItemGql[];
  }>(
    `query CommonplaceProjectDetail($id: String!) {
      collection(id: $id) { id name kind createdAtMs }
      collectionItems(id: $id) { ${COMMONPLACE_ITEM_FIELDS} }
    }`,
    { id: slug },
  );
  if (!data.collection) {
    throw new ApiError(404, 'CommonPlace project collection not found');
  }
  const project = mapCollectionToProject(data.collection);
  return {
    ...project,
    sha_hash: data.collection.id,
    description: `${labelFromKind(data.collection.kind)} collection from Theorem CommonPlace.`,
    template_from: null,
    settings_override: {},
    objects: data.collectionItems.map((item) => ({
      id: registerCommonplaceItem(item),
      title: titleOrUntitled(item),
      object_type: item.kind || 'note',
    })),
  };
}

export async function fetchHome(): Promise<CommonplaceHomeData> {
  const data = await commonplaceGraphql<{ briefing: CommonplaceBriefingGql }>(
    `query CommonplaceHome {
      briefing(recentLimit: 8, connectedLimit: 8, openLimit: 8) {
        recent { ${COMMONPLACE_ITEM_FIELDS} }
        newlyConnected {
          connections
          item { ${COMMONPLACE_ITEM_FIELDS} }
          related { id title kind createdAtMs updatedAtMs tags collections residency }
        }
        openThreads { ${COMMONPLACE_ITEM_FIELDS} }
      }
    }`,
  );
  return mapBriefingToHome(data.briefing);
}

/* ─────────────────────────────────────────────────
   DailyLog endpoint functions
   ───────────────────────────────────────────────── */

/** Fetch all daily logs (newest first). Handles both flat array and paginated envelope. */
export async function fetchDailyLogs(): Promise<ApiDailyLog[]> {
  const data = await apiFetch<{ results: ApiDailyLog[] } | ApiDailyLog[]>('/daily-logs/');
  return Array.isArray(data) ? data : data.results;
}

/** Fetch a single daily log by date (YYYY-MM-DD) */
export async function fetchDailyLogByDate(date: string): Promise<ApiDailyLog> {
  return apiFetch<ApiDailyLog>(`/daily-logs/${date}/`);
}

/* ─────────────────────────────────────────────────
   Pinned objects: sidebar 2x3 grid showing recently
   resurfaced objects (full data: slug + edge count)
   ───────────────────────────────────────────────── */

export interface PinnedObject {
  id: number;
  slug: string;
  title: string;
  objectTypeName: string;
  objectTypeColor: string;
  edgeCount: number;
}

function normalizeObjectListResponse(
  data: { results: ObjectListItem[] } | ObjectListItem[],
): ObjectListItem[] {
  return Array.isArray(data) ? data : data.results;
}

/** Fetch up to 6 pinned/starred objects for the sidebar pinned grid. */
export async function fetchPinnedObjects(): Promise<PinnedObject[]> {
  const [pinnedRaw, starredRaw] = await Promise.all([
    apiFetch<{ results: ObjectListItem[] } | ObjectListItem[]>('/objects/?pinned=true&page_size=6'),
    apiFetch<{ results: ObjectListItem[] } | ObjectListItem[]>('/objects/?starred=true&page_size=6'),
  ]);

  const pinned = normalizeObjectListResponse(pinnedRaw);
  const starred = normalizeObjectListResponse(starredRaw);
  const deduped = new Map<number, ObjectListItem>();

  for (const item of [...pinned, ...starred]) {
    if (!deduped.has(item.id)) deduped.set(item.id, item);
    if (deduped.size >= 6) break;
  }

  return Array.from(deduped.values()).map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.display_title || item.title,
    objectTypeName: item.object_type_name || '',
    objectTypeColor: item.object_type_color || '',
    edgeCount: item.edge_count || 0,
  }));
}

/* ─────────────────────────────────────────────────
   Lego composition: pinned edge API (v5.1)
   ───────────────────────────────────────────────── */

export interface PinEdgePayload {
  target_slug: string;
  position?: 'badge' | 'inline' | 'sidebar';
  sort_order?: number;
}

export interface PinEdgeResponse {
  edge_id: number;
  object_id: number;
  slug: string;
  title: string;
  object_type: string;
  position: 'badge' | 'inline' | 'sidebar';
  sort_order: number;
}

/** Attach (pin) a target object to a parent object. */
export async function createPin(
  parentSlug: string,
  payload: PinEdgePayload,
): Promise<PinEdgeResponse> {
  return apiFetch<PinEdgeResponse>(`/objects/${parentSlug}/pin/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/** Detach (unpin) a pinned edge from a parent object. */
export async function removePin(
  parentSlug: string,
  edgeId: number,
): Promise<void> {
  await apiFetch<void>(`/objects/${parentSlug}/pin/${edgeId}/`, {
    method: 'DELETE',
  });
}

/** Update pin position or sort order. */
export async function updatePin(
  parentSlug: string,
  edgeId: number,
  updates: Partial<Pick<PinEdgePayload, 'position' | 'sort_order'>>,
): Promise<PinEdgeResponse> {
  return apiFetch<PinEdgeResponse>(`/objects/${parentSlug}/pin/${edgeId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

/* ─────────────────────────────────────────────────
   Sync helper: maps CapturedObject to API payload
   ───────────────────────────────────────────────── */

export async function syncCapturedObject(
  obj: CapturedObject,
): Promise<ApiCaptureResponse> {
  // New capture endpoint accepts `content` (body or URL) + `hint_type`
  const content = obj.sourceUrl || obj.body || '';
  return captureToApi({
    content,
    hint_type: obj.objectType,
    title: obj.title,
    file: obj.file,
  });
}

/* ─────────────────────────────────────────────────
   Date grouping (moved from commonplace-mock-data.ts)
   ───────────────────────────────────────────────── */

export interface DateGroup {
  dateLabel: string;
  dateKey: string;
  nodes: MockNode[];
}

/**
 * Group nodes by date for timeline display.
 * Returns groups sorted newest first with relative labels.
 */
export function groupNodesByDate(nodes: MockNode[]): DateGroup[] {
  const now = new Date();
  const todayStr = toDateKey(now);
  const yesterdayStr = toDateKey(new Date(now.getTime() - 86400000));

  const groups = new Map<string, MockNode[]>();

  for (const node of nodes) {
    const key = toDateKey(new Date(node.capturedAt));
    const existing = groups.get(key);
    if (existing) existing.push(node);
    else groups.set(key, [node]);
  }

  const result: DateGroup[] = [];
  for (const [key, groupNodes] of groups) {
    let dateLabel: string;
    if (key === todayStr) dateLabel = 'Today';
    else if (key === yesterdayStr) dateLabel = 'Yesterday';
    else dateLabel = formatDateLabel(key);

    result.push({ dateLabel, dateKey: key, nodes: groupNodes });
  }

  result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return result;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/* ─────────────────────────────────────────────────
   useApiData: lightweight data fetching hook
   ───────────────────────────────────────────────── */

export interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refetch: () => void;
}

/**
 * Lightweight data fetching hook for client components.
 * Calls the fetcher on mount and whenever deps change.
 * Handles loading, error, and refetch without external deps.
 */
export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [tick, setTick] = useState(0);

  /* Stable reference to the fetcher to avoid re-triggering on every render */
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const runFetch = useCallback(async (isCancelled: () => boolean) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      if (isCancelled()) return;
      setData(result);
      setLoading(false);
    } catch (err) {
      if (isCancelled()) return;
      const apiErr =
        err instanceof ApiError
          ? err
          : new ApiError(0, err instanceof Error ? err.message : 'Unknown error', true);
      setError(apiErr);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void runFetch(() => cancelled);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runFetch, tick, ...deps]);

  return { data, loading, error, refetch };
}

/* ─────────────────────────────────────────────────
   Component CRUD (tasks + general components)
   ───────────────────────────────────────────────── */

/** PATCH a component's value and/or sort_order */
export async function patchComponent(
  componentId: number,
  updates: { value?: string; sort_order?: number },
): Promise<void> {
  await apiFetch(`/components/${componentId}/`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

/** POST a new component on an object */
export async function createObjectComponent(
  objectId: number,
  payload: { component_type_slug: string; key: string; value: string; sort_order?: number },
): Promise<{ id: number }> {
  return apiFetch<{ id: number }>(`/objects/${objectId}/components/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** DELETE a component */
export async function deleteComponent(componentId: number): Promise<void> {
  await apiFetch(`/components/${componentId}/`, { method: 'DELETE' });
}

/** GET /clusters/ - Objects grouped by object type */
export function fetchClusters(
  params?: { notebook?: string; project?: string },
): Promise<ClusterResponse[]> {
  const qs =
    params && Object.keys(params).length
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
  return apiFetch<ClusterResponse[]>(`/clusters/${qs}`);
}

/** GET /objects/<slug>/lineage/ - 1-hop Edge traversal */
export function fetchLineage(slug: string): Promise<LineageResponse> {
  return apiFetch<LineageResponse>(`/objects/${slug}/lineage/`);
}

/* ─────────────────────────────────────────────────
   Inquiry endpoints
   ───────────────────────────────────────────────── */

export interface InquirySuggestionData {
  unanswered_questions: Array<{
    id: number;
    title: string;
    claim_count: number;
    gap_count: number;
  }>;
  evidence_gaps: Array<{
    description: string;
    related_question_id?: number;
  }>;
  stale_topics: Array<{
    description: string;
    entity: string;
  }>;
  unresolved_tensions: Array<{
    id: number;
    title: string;
    severity: string;
  }>;
}

export async function fetchInquirySuggestions(): Promise<InquirySuggestionData> {
  return apiFetch<InquirySuggestionData>('/inquiry-suggestions/');
}

export interface InquiryPlanResult {
  subqueries: Array<{
    query: string;
    purpose: string;
    notes: { reason: string } | string;
  }>;
  internal_context: {
    related_object_count: number;
    existing_claim_count: number;
    known_entity_count: number;
    evidence_gaps: Array<{ description: string; priority: number }>;
  };
}

export async function fetchInquiryPlan(
  query: string,
  notebookSlug?: string,
): Promise<InquiryPlanResult> {
  return apiFetch<InquiryPlanResult>('/inquiry-plan/', {
    method: 'POST',
    body: JSON.stringify({ query, notebook_slug: notebookSlug }),
  });
}

export interface InquiryStartResponse {
  inquiry_id: number;
  status: string;
  mode: string;
}

export async function startInquiry(params: {
  query: string;
  question_id?: number;
  external_search?: boolean;
}): Promise<InquiryStartResponse> {
  return epistemicFetch<InquiryStartResponse>('/inquiries/', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface InquiryProgress {
  id: number;
  status: string;
  phase: string;
  progress: {
    subqueries: number;
    subqueries_completed: number;
    hits_total: number;
    hits_captured: number;
  };
}

export async function fetchInquiryProgress(
  id: number,
): Promise<InquiryProgress> {
  return epistemicFetch<InquiryProgress>(`/inquiries/${id}/`);
}

export interface InquiryResultData {
  inquiry: {
    id: number;
    status: string;
    mode: string;
    phase: string;
    query_text: string;
    question_id: number | null;
    degraded_mode: boolean;
    started_at: string | null;
    finished_at: string | null;
  };
  answer: {
    answer_text: string;
    answer_status: string;
    confidence: number;
  };
  supporting_evidence: Array<{
    candidate_text?: string;
    text?: string;
    confidence: number;
    review_state: string;
  }>;
  contradicting_evidence: Array<{
    candidate_text?: string;
    text?: string;
    confidence: number;
    review_state: string;
  }>;
  new_artifacts: number[];
  new_candidate_items: number[];
  open_gaps: Array<{ description: string }>;
  what_changed: {
    new_artifacts_captured: number;
    new_candidate_claims: number;
    new_proposed_contradictions?: number;
  };
}

export async function fetchInquiryResult(
  id: number,
): Promise<InquiryResultData> {
  return epistemicFetch<InquiryResultData>(`/inquiries/${id}/result/`);
}

/* ─────────────────────────────────────────────────
   Self-organize endpoints
   ───────────────────────────────────────────────── */

/** Fetch self-organize preview (notebook formation, entity promotions, edge evolution) */
export async function fetchSelfOrganizePreview(): Promise<ApiSelfOrganizePreview> {
  return apiFetch<ApiSelfOrganizePreview>('/self-organize/preview/');
}

/** Run a specific self-organize loop */
export async function runSelfOrganizeLoop(
  loop: 'form-notebooks' | 'promote-entities',
  params?: Record<string, unknown>,
): Promise<{ status: string; detail?: string }> {
  return apiFetch<{ status: string; detail?: string }>(`/self-organize/${loop}/`, {
    method: 'POST',
    body: JSON.stringify(params ?? {}),
  });
}

/* ─────────────────────────────────────────────────
   Promotion queue endpoints (epistemic API)
   ───────────────────────────────────────────────── */

/** Fetch promotion queue items */
export async function fetchPromotionQueue(params?: {
  queue_state?: string;
  item_type?: string;
  artifact?: number;
}): Promise<ApiPromotionItem[]> {
  const search = new URLSearchParams();
  if (params?.queue_state) search.set('queue_state', params.queue_state);
  if (params?.item_type) search.set('item_type', params.item_type);
  if (params?.artifact) search.set('artifact', String(params.artifact));

  const qs = search.toString();
  const path = `/promotion-items/${qs ? `?${qs}` : ''}`;
  const data = await epistemicFetch<{ results: ApiPromotionItem[] } | ApiPromotionItem[]>(path);
  return Array.isArray(data) ? data : data.results;
}

/** Submit a review action on a promotion item */
export async function submitReviewAction(data: {
  promotion_item_id: number;
  action_type: 'accept' | 'reject' | 'revise' | 'defer';
  rationale?: string;
}): Promise<{ id: number; action_type: string }> {
  return epistemicFetch<{ id: number; action_type: string }>('/review-actions/', {
    method: 'POST',
    body: JSON.stringify({ ...data, actor_label: 'user' }),
  });
}

/* ─────────────────────────────────────────────────
   Emergent type endpoints
   ───────────────────────────────────────────────── */

/** Fetch emergent type suggestions from self-organize preview */
export async function fetchEmergentTypes(): Promise<ApiEmergentTypeSuggestion[]> {
  const data = await apiFetch<ApiSelfOrganizePreview>('/self-organize/preview/');
  return data.emergent_types?.candidates ?? [];
}

/** Apply an emergent type suggestion (creates a new ObjectType) */
export async function applyEmergentType(data: {
  suggested_name: string;
  suggested_slug: string;
  member_pks: number[];
  icon?: string;
  color?: string;
}): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/self-organize/emergent-types/apply/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/* ─────────────────────────────────────────────────
   Artifact endpoints (epistemic API)
   ───────────────────────────────────────────────── */

/** Fetch artifact list with optional filters */
export async function fetchArtifacts(params?: {
  capture_kind?: string;
  ingestion_status?: string;
  notebook?: string;
}): Promise<ApiArtifactListItem[]> {
  const items = await fetchCommonplaceItems();
  return items
    .filter((item) => (params?.notebook ? item.collections.includes(params.notebook) : true))
    .map(mapItemToArtifact)
    .filter((artifact) => {
      if (params?.capture_kind && artifact.capture_kind !== params.capture_kind) return false;
      if (params?.ingestion_status && artifact.ingestion_status !== params.ingestion_status) return false;
      return true;
    });
}

/** Trigger extraction on an artifact */
export async function triggerExtraction(
  artifactId: number,
): Promise<{ extraction_run: object; promotion_items: ApiPromotionItem[] }> {
  return epistemicFetch<{ extraction_run: object; promotion_items: ApiPromotionItem[] }>(
    `/artifacts/${artifactId}/extract/`,
    { method: 'POST' },
  );
}

/* ─────────────────────────────────────────────────
   Connection Review (Level 2 feedback)
   ───────────────────────────────────────────────── */

export interface ReviewQueueEdge {
  edge_id: number;
  from_object: number;
  to_object: number;
  from_title: string;
  to_title: string;
  from_slug: string;
  to_slug: string;
  from_type: string;
  to_type: string;
  from_type_color: string;
  to_type_color: string;
  edge_type: string;
  reason: string;
  strength: number;
  engine: string;
  feature_vector: Record<string, unknown>;
  created_at: string;
  strategy?: 'uncertainty' | 'committee' | 'diversified';
  predicted_prob?: number;
  uncertainty?: number;
  disagreement?: number;
  mean_prob?: number;
  min_prob?: number;
  max_prob?: number;
  scorer_diagnostics?: {
    gbt?: number | null;
    gnn?: number | null;
    rl?: number | null;
    bp?: number | null;
    ensemble?: number | null;
  };
}

export interface FeedbackStats {
  total: number;
  training_ready: boolean;
  training_tier: 'full' | 'blended' | 'fixed_weights';
  needed_for_training: number;
  scorer_mode?: 'fixed' | 'blended' | 'learned' | 'ensemble';
}

export interface ReviewQueueResponse {
  results: ReviewQueueEdge[];
  count: number;
  feedback_stats: FeedbackStats;
  strategy?: 'uncertainty' | 'committee' | 'diversified';
  engine_distribution?: Record<string, number>;
}

export async function fetchReviewQueue(params?: {
  limit?: number;
  notebook?: string;
  engine?: string;
  min_strength?: number;
  strategy?: 'uncertainty' | 'committee' | 'diversified';
}): Promise<ReviewQueueResponse> {
  const search = new URLSearchParams();
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.notebook) search.set('notebook', params.notebook);
  if (params?.engine) search.set('engine', params.engine);
  if (params?.min_strength) search.set('min_strength', String(params.min_strength));
  if (params?.strategy) search.set('strategy', params.strategy);
  const qs = search.toString();
  return apiFetch<ReviewQueueResponse>(
    `/feedback/review-queue/${qs ? `?${qs}` : ''}`,
  );
}

export async function submitConnectionFeedback(data: {
  from_object: number;
  to_object: number;
  label: 'engaged' | 'dismissed';
  discovery_signal?: string;
  label_strength?: number;
  feature_vector?: Record<string, unknown>;
  edge?: number;
  event_type?: string;
  event_metadata?: Record<string, unknown>;
}): Promise<unknown> {
  return apiFetch('/feedback/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitStructuredConnectionFeedback(data: {
  edge: number;
  from_object: number;
  to_object: number;
  feature_vector?: Record<string, unknown>;
  label: 'engaged' | 'dismissed';
  discovery_signal?: string;
  label_strength?: number;
  event_type: 'structured_review';
  event_metadata: Record<string, unknown>;
}): Promise<unknown> {
  return apiFetch('/feedback/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchFeedbackStats(params?: {
  notebook?: string;
}): Promise<FeedbackStats> {
  const search = new URLSearchParams();
  if (params?.notebook) search.set('notebook', params.notebook);
  const qs = search.toString();
  const resp = await apiFetch<{
    total: number;
    training_ready: boolean;
    training_tier: string;
    scorer_mode?: string;
  }>(`/feedback/stats/${qs ? `?${qs}` : ''}`);
  return {
    total: resp.total,
    training_ready: resp.training_ready,
    training_tier: resp.training_tier as FeedbackStats['training_tier'],
    needed_for_training: Math.max(0, 50 - resp.total),
    scorer_mode: resp.scorer_mode as FeedbackStats['scorer_mode'] | undefined,
  };
}
