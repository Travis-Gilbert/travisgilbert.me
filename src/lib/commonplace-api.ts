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
  MockEdge,
  GraphNode,
  GraphLink,
  ApiFeedNode,
  ApiGraphResponse,
  ApiGraphObject,
  ApiObjectDetail,
  ApiCaptureResponse,
  ApiResurfaceResponse,
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

function mapFeedNodeToMockNode(node: ApiFeedNode): MockNode {
  return {
    id: `node-${node.id}`,
    objectRef: node.object_ref,
    objectType: node.object_type,
    title: node.object_title,
    summary: node.title,
    capturedAt: node.occurred_at,
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
  const nodes: GraphNode[] = resp.objects.map((o: ApiGraphObject) => ({
    id: String(o.id),
    objectType: o.object_type,
    title: o.title,
    edgeCount: o.edge_count,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links: GraphLink[] = resp.edges
    .filter(
      (e) => nodeIds.has(String(e.source)) && nodeIds.has(String(e.target)),
    )
    .map((e) => ({
      source: String(e.source),
      target: String(e.target),
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
  page_size?: number;
  object_type?: string;
}): Promise<MockNode[]> {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.page_size) search.set('page_size', String(params.page_size));
  if (params?.object_type) search.set('object_type', params.object_type);

  const qs = search.toString();
  const path = `/feed/${qs ? `?${qs}` : ''}`;

  const data = await apiFetch<{ results: ApiFeedNode[] } | ApiFeedNode[]>(
    path,
  );
  const items = Array.isArray(data) ? data : data.results;
  return items.map(mapFeedNodeToMockNode);
}

/** Fetch graph data (objects + edges), mapped to D3 format */
export async function fetchGraph(params?: {
  object_type?: string;
}): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const search = new URLSearchParams();
  if (params?.object_type) search.set('object_type', params.object_type);

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

/** Capture a new object via POST /capture/ */
export async function captureToApi(data: {
  body?: string;
  url?: string;
  title?: string;
  object_type?: string;
}): Promise<ApiCaptureResponse> {
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
}): Promise<ApiResurfaceResponse> {
  const search = new URLSearchParams();
  if (params?.count) search.set('count', String(params.count));

  const qs = search.toString();
  const path = `/resurface/${qs ? `?${qs}` : ''}`;
  return apiFetch<ApiResurfaceResponse>(path);
}

/* ─────────────────────────────────────────────────
   Sync helper: maps CapturedObject to API payload
   ───────────────────────────────────────────────── */

export async function syncCapturedObject(
  obj: CapturedObject,
): Promise<ApiCaptureResponse> {
  return captureToApi({
    body: obj.body,
    url: obj.sourceUrl,
    title: obj.title,
    object_type: obj.objectType,
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
