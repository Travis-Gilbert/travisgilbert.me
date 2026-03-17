/**
 * CommonPlace API client: typed fetch wrapper, response mappers,
 * error handling, and the useApiData hook.
 *
 * Single source of truth for all communication with the Django
 * research_api notebook endpoints. Maps API response shapes to
 * existing frontend types (MockNode, GraphNode, GraphLink) so
 * components don't need to change their rendering logic.
 *
 * Auth: optional Bearer token via NEXT_PUBLIC_COMMONPLACE_API_TOKEN.
 * With AllowAny on Django, the header is simply omitted.
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
  ApiProjectListItem,
  ApiProjectDetail,
  ApiDailyLog,
  CapturedObject,
  ObjectListItem,
  ClusterResponse,
  LineageResponse,
  ApiSelfOrganizePreview,
  ApiPromotionItem,
} from '@/lib/commonplace';
import { API_BASE, EPISTEMIC_BASE } from '@/lib/commonplace';

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

/** Fetch from the top-level epistemic API (/api/v1/) instead of /api/v1/notebook/. */
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
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.per_page) search.set('per_page', String(params.per_page));
  if (params?.object_type) search.set('object_type', params.object_type);
  if (params?.notebook) search.set('notebook', params.notebook);
  if (params?.project) search.set('project', params.project);

  const qs = search.toString();
  const path = `/feed/${qs ? `?${qs}` : ''}`;

  const data = await apiFetch<ApiFeedResponse>(path);
  // Flatten day-grouped response into a flat node array
  const items: ApiFeedNode[] = data.days.flatMap((day) => day.nodes);
  return items.map(mapFeedNodeToMockNode);
}

/** Fetch graph data (objects + edges), mapped to D3 format */
export async function fetchGraph(params?: {
  object_type?: string;
  notebook?: string;
}): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const search = new URLSearchParams();
  if (params?.object_type) search.set('object_type', params.object_type);
  if (params?.notebook) search.set('notebook', params.notebook);

  const qs = search.toString();
  const path = `/graph/${qs ? `?${qs}` : ''}`;

  const resp = await apiFetch<ApiGraphResponse>(path);
  return mapGraphResponseToD3(resp);
}

/** Fetch single object detail by slug */
export async function fetchObjectDetail(
  slug: string,
): Promise<ApiObjectDetail> {
  return apiFetch<ApiObjectDetail>(`/objects/${slug}/`);
}

/** Fetch single object detail by numeric ID */
export async function fetchObjectById(
  id: number,
): Promise<ApiObjectDetail> {
  return apiFetch<ApiObjectDetail>(`/objects/${id}/`);
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
  const search = new URLSearchParams();
  if (params?.count) search.set('count', String(params.count));
  if (params?.notebook) search.set('notebook', params.notebook);
  if (params?.project) search.set('project', params.project);
  if (params?.exclude?.length) search.set('exclude', params.exclude.join(','));

  const qs = search.toString();
  const path = `/resurface/${qs ? `?${qs}` : ''}`;
  return apiFetch<ApiResurfaceResponse>(path);
}

/* ─────────────────────────────────────────────────
   Notebook + Project endpoint functions
   ───────────────────────────────────────────────── */

/** Fetch all notebooks. Handles both flat array and paginated envelope. */
export async function fetchNotebooks(): Promise<ApiNotebookListItem[]> {
  const data = await apiFetch<
    { results: ApiNotebookListItem[] } | ApiNotebookListItem[]
  >('/notebooks/');
  return Array.isArray(data) ? data : data.results;
}

/** Fetch a single notebook by slug */
export async function fetchNotebookBySlug(
  slug: string,
): Promise<ApiNotebookDetail> {
  return apiFetch<ApiNotebookDetail>(`/notebooks/${slug}/`);
}

/** Fetch all projects, optionally filtered by notebook or status. Handles both flat array and paginated envelope. */
export async function fetchProjects(params?: {
  notebook?: string;
  status?: string;
}): Promise<ApiProjectListItem[]> {
  const search = new URLSearchParams();
  if (params?.notebook) search.set('notebook', params.notebook);
  if (params?.status) search.set('status', params.status);
  const qs = search.toString();
  const data = await apiFetch<
    { results: ApiProjectListItem[] } | ApiProjectListItem[]
  >(`/projects/${qs ? `?${qs}` : ''}`);
  return Array.isArray(data) ? data : data.results;
}

/** Fetch a single project by slug */
export async function fetchProjectBySlug(
  slug: string,
): Promise<ApiProjectDetail> {
  return apiFetch<ApiProjectDetail>(`/projects/${slug}/`);
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
  fetcherRef.current = fetcher;

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcherRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const apiErr =
            err instanceof ApiError
              ? err
              : new ApiError(0, err?.message ?? 'Unknown error', true);
          setError(apiErr);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

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
