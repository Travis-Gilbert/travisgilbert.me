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
  ApiResurfaceResponse,
  ApiNotebookListItem,
  ApiNotebookDetail,
  ApiProjectListItem,
  ApiProjectDetail,
  ApiDailyLog,
  CapturedObject,
} from '@/lib/commonplace';
import { API_BASE } from '@/lib/commonplace';

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
  return {
    id: node.id,
    objectRef: extractNumericId(node.object_id ?? '0'),
    objectSlug: '',
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
    objectType: o.object_type,
    title: o.title,
    edgeCount: o.edge_count,
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
