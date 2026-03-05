/**
 * Studio API client: typed fetch wrapper, response mappers,
 * and error handling.
 */

import {
  STUDIO_API_BASE,
  normalizeStudioContentType,
  toStudioApiContentType,
} from '@/lib/studio';
import type {
  StudioContentItem,
  StudioTimelineEntry,
  StudioDashboardStats,
} from '@/lib/studio';

interface StudioApiContentItem {
  id: string | number;
  title: string;
  slug: string;
  content_type: string;
  stage: string;
  body: string;
  excerpt: string;
  word_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface StudioApiTimelineItem {
  id: string;
  content_id: string;
  content_title: string;
  content_type: string;
  action: string;
  detail: string;
  occurred_at: string;
}

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

function mergeHeaders(
  target: Record<string, string>,
  source?: HeadersInit,
): void {
  if (!source) return;
  if (source instanceof Headers) {
    source.forEach((value, key) => {
      target[key] = value;
    });
    return;
  }
  if (Array.isArray(source)) {
    source.forEach(([key, value]) => {
      target[key] = value;
    });
    return;
  }
  Object.assign(target, source);
}

function mapApiContentItem(item: StudioApiContentItem): StudioContentItem {
  return {
    id: String(item.id),
    title: item.title,
    slug: item.slug,
    contentType: normalizeStudioContentType(item.content_type),
    stage: item.stage,
    body: item.body ?? '',
    excerpt: item.excerpt ?? '',
    wordCount: item.word_count ?? 0,
    tags: Array.isArray(item.tags) ? item.tags : [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    publishedAt: item.published_at,
  };
}

function mapApiTimelineItem(item: StudioApiTimelineItem): StudioTimelineEntry {
  return {
    id: item.id,
    contentId: item.content_id,
    contentTitle: item.content_title,
    contentType: normalizeStudioContentType(item.content_type),
    action: item.action,
    detail: item.detail,
    occurredAt: item.occurred_at,
  };
}

export async function studioFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${STUDIO_API_BASE}${path}`;
  const hasBody = options?.body !== undefined && options?.body !== null;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  mergeHeaders(headers, options?.headers);

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'omit',
      cache: 'no-store',
    });

    const text = await res.text();
    let payload: unknown = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }
    }

    if (!res.ok) {
      const body = payload as Record<string, unknown>;
      const message =
        (typeof body.detail === 'string' && body.detail) ||
        (typeof body.error === 'string' && body.error) ||
        `Studio API error ${res.status}`;
      throw new StudioApiError(res.status, message);
    }

    return payload as T;
  } catch (err) {
    if (err instanceof StudioApiError) throw err;
    throw new StudioApiError(
      0,
      'Network error: could not reach Studio API',
      true,
    );
  }
}

export async function fetchContentList(params?: {
  content_type?: string;
  stage?: string;
  q?: string;
}): Promise<StudioContentItem[]> {
  const contentType = params?.content_type
    ? normalizeStudioContentType(params.content_type)
    : null;

  const search = new URLSearchParams();
  if (params?.stage) search.set('stage', params.stage);
  if (params?.q) search.set('q', params.q);

  const qs = search.toString();
  const pathBase = contentType
    ? `/content/${toStudioApiContentType(contentType)}/`
    : '/content/';

  const data = await studioFetch<
    { results: StudioApiContentItem[] } | StudioApiContentItem[]
  >(`${pathBase}${qs ? `?${qs}` : ''}`);

  const items = Array.isArray(data) ? data : data.results ?? [];
  return items.map(mapApiContentItem);
}

export async function fetchContentItem(
  contentType: string,
  slug: string,
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/${slug}/`,
  );
  return mapApiContentItem(data);
}

export async function createContentItem(
  contentType: string,
  payload: { title?: string } = {},
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/create/`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return mapApiContentItem(data);
}

export async function saveContentItem(
  contentType: string,
  slug: string,
  payload: {
    title?: string;
    body?: string;
    excerpt?: string;
    tags?: string[];
  },
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/${slug}/update/`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return mapApiContentItem(data);
}

export async function deleteContentItem(
  contentType: string,
  slug: string,
): Promise<{ deleted: boolean }> {
  const apiType = toStudioApiContentType(contentType);
  return studioFetch<{ deleted: boolean }>(`/content/${apiType}/${slug}/delete/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function updateStage(
  contentType: string,
  slug: string,
  newStage: string,
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/${slug}/set-stage/`,
    {
      method: 'POST',
      body: JSON.stringify({ stage: newStage }),
    },
  );
  return mapApiContentItem(data);
}

export async function fetchTimeline(params?: {
  content_type?: string;
  limit?: number;
}): Promise<StudioTimelineEntry[]> {
  const search = new URLSearchParams();
  if (params?.content_type) {
    search.set('content_type', toStudioApiContentType(params.content_type));
  }
  if (params?.limit) search.set('limit', String(params.limit));

  const qs = search.toString();
  const data = await studioFetch<
    { results: StudioApiTimelineItem[] } | StudioApiTimelineItem[]
  >(`/timeline/${qs ? `?${qs}` : ''}`);

  const entries = Array.isArray(data) ? data : data.results ?? [];
  return entries.map(mapApiTimelineItem);
}

export async function fetchDashboardStats(): Promise<StudioDashboardStats> {
  const [items, recentActivity] = await Promise.all([
    fetchContentList(),
    fetchTimeline({ limit: 8 }),
  ]);

  const byStage: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalWords = 0;

  for (const item of items) {
    byStage[item.stage] = (byStage[item.stage] ?? 0) + 1;
    byType[item.contentType] = (byType[item.contentType] ?? 0) + 1;
    totalWords += item.wordCount;
  }

  return {
    totalPieces: items.length,
    totalWords,
    byStage,
    byType,
    recentActivity,
  };
}
