import type {
  TheseusResponse,
  TheseusObject,
  ClusterSummary,
  WhatIfResult,
  Hypothesis,
  GraphWeather,
  AskOptions,
} from './theseus-types';

interface ApiError {
  ok: false;
  status: number;
  message: string;
}

type ApiResult<T> = (T & { ok: true }) | ApiError;

function wrapOk<T extends object>(data: T): T & { ok: true } {
  return { ...data, ok: true as const };
}

function apiError(status: number, message: string): ApiError {
  return { ok: false, status, message };
}

async function apiFetch<T extends object>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return apiError(res.status, text);
    }
    const data: T = await res.json();
    return wrapOk(data);
  } catch (err) {
    return apiError(0, err instanceof Error ? err.message : 'Network error');
  }
}

export async function askTheseus(
  query: string,
  options?: AskOptions,
): Promise<ApiResult<TheseusResponse>> {
  return apiFetch<TheseusResponse>('/api/v2/theseus/ask/', {
    method: 'POST',
    body: JSON.stringify({
      query,
      mode: options?.mode ?? 'full',
      personal_only: options?.personal_only ?? false,
    }),
  });
}

export async function getObject(
  id: string,
): Promise<ApiResult<TheseusObject>> {
  return apiFetch<TheseusObject>(`/api/v2/theseus/objects/${id}/`);
}

export async function getClusters(): Promise<ApiResult<{ clusters: ClusterSummary[] }>> {
  return apiFetch<{ clusters: ClusterSummary[] }>('/api/v2/theseus/clusters/');
}

export async function whatIfRemove(
  objectId: string,
): Promise<ApiResult<WhatIfResult>> {
  return apiFetch<WhatIfResult>(`/api/v2/theseus/what-if-remove/${objectId}/`);
}

export async function getHypotheses(): Promise<ApiResult<{ hypotheses: Hypothesis[] }>> {
  return apiFetch<{ hypotheses: Hypothesis[] }>('/api/v2/theseus/hypotheses/');
}

export async function getGraphWeather(): Promise<ApiResult<GraphWeather>> {
  return apiFetch<GraphWeather>('/api/v2/theseus/graph-weather/');
}
