/**
 * Studio API client: typed fetch wrapper, error handling,
 * and the useStudioData hook.
 *
 * Communicates with the Django publishing_api endpoints.
 * Session cookie auth with credentials: 'include' for
 * cross-origin requests to the Studio subdomain.
 *
 * When Django DRF endpoints are built, the fetch functions
 * here will map API response shapes to the StudioContentItem
 * and StudioTimelineEntry types from studio.ts.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { STUDIO_API_BASE } from '@/lib/studio';
import type {
  StudioContentItem,
  StudioTimelineEntry,
  StudioDashboardStats,
} from '@/lib/studio';

/* ─────────────────────────────────────────────────
   Error class
   ───────────────────────────────────────────────── */

export class StudioApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public isNetworkError = false,
  ) {
    super(message);
    this.name = 'StudioApiError';
  }
}

/* ─────────────────────────────────────────────────
   Base fetch wrapper
   ───────────────────────────────────────────────── */

export async function studioFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${STUDIO_API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new StudioApiError(
        res.status,
        body.detail ?? body.error ?? `Studio API error ${res.status}`,
      );
    }
    return res.json();
  } catch (err) {
    if (err instanceof StudioApiError) throw err;
    throw new StudioApiError(
      0,
      'Network error: could not reach Studio API',
      true,
    );
  }
}

/* ─────────────────────────────────────────────────
   API endpoint functions
   (Currently stubs; will map to Django DRF endpoints)
   ───────────────────────────────────────────────── */

/** Fetch all content items, optionally filtered */
export async function fetchContentList(params?: {
  content_type?: string;
  stage?: string;
  q?: string;
}): Promise<StudioContentItem[]> {
  const search = new URLSearchParams();
  if (params?.content_type) search.set('content_type', params.content_type);
  if (params?.stage) search.set('stage', params.stage);
  if (params?.q) search.set('q', params.q);

  const qs = search.toString();
  const path = `/content/${qs ? `?${qs}` : ''}`;

  const data = await studioFetch<
    { results: StudioContentItem[] } | StudioContentItem[]
  >(path);
  return Array.isArray(data) ? data : data.results;
}

/** Fetch a single content item by slug */
export async function fetchContentItem(
  contentType: string,
  slug: string,
): Promise<StudioContentItem> {
  return studioFetch<StudioContentItem>(`/content/${contentType}/${slug}/`);
}

/** Save (create or update) a content item */
export async function saveContentItem(
  item: Partial<StudioContentItem> & { id?: string },
): Promise<StudioContentItem> {
  const method = item.id ? 'PUT' : 'POST';
  const path = item.id ? `/content/${item.id}/` : '/content/';
  return studioFetch<StudioContentItem>(path, {
    method,
    body: JSON.stringify(item),
  });
}

/** Update the stage of a content item */
export async function updateStage(
  itemId: string,
  newStage: string,
): Promise<StudioContentItem> {
  return studioFetch<StudioContentItem>(`/content/${itemId}/stage/`, {
    method: 'PATCH',
    body: JSON.stringify({ stage: newStage }),
  });
}

/** Fetch timeline entries */
export async function fetchTimeline(params?: {
  content_type?: string;
  limit?: number;
}): Promise<StudioTimelineEntry[]> {
  const search = new URLSearchParams();
  if (params?.content_type) search.set('content_type', params.content_type);
  if (params?.limit) search.set('limit', String(params.limit));

  const qs = search.toString();
  const path = `/timeline/${qs ? `?${qs}` : ''}`;

  const data = await studioFetch<
    { results: StudioTimelineEntry[] } | StudioTimelineEntry[]
  >(path);
  return Array.isArray(data) ? data : data.results;
}

/** Fetch dashboard stats */
export async function fetchDashboardStats(): Promise<StudioDashboardStats> {
  return studioFetch<StudioDashboardStats>('/stats/');
}

/* ─────────────────────────────────────────────────
   useStudioData: lightweight data fetching hook
   ───────────────────────────────────────────────── */

export interface UseStudioDataResult<T> {
  data: T | null;
  loading: boolean;
  error: StudioApiError | null;
  refetch: () => void;
}

/**
 * Lightweight data fetching hook for client components.
 * Calls the fetcher on mount and whenever deps change.
 * Handles loading, error, and refetch without external deps.
 */
export function useStudioData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): UseStudioDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StudioApiError | null>(null);
  const [tick, setTick] = useState(0);

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
            err instanceof StudioApiError
              ? err
              : new StudioApiError(0, err?.message ?? 'Unknown error', true);
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
