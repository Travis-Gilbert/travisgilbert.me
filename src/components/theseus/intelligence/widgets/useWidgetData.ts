'use client';

import { useEffect, useState } from 'react';

export type WidgetState = 'loading' | 'empty' | 'error' | 'ready';

export interface WidgetDataResult<T> {
  data: T | null;
  state: WidgetState;
  error?: string;
}

/**
 * Minimal fetch hook for Intelligence widgets. Hits a Theseus API
 * endpoint, expects a JSON body, and resolves to one of four states:
 * loading, empty (endpoint returned 404 or empty payload), error, ready.
 *
 * This deliberately returns an honest empty state when the endpoint is
 * not yet implemented server-side: no fallback mock data (per CLAUDE.md
 * "no fake UI in shipped surfaces").
 */
export function useWidgetData<T>(url: string): WidgetDataResult<T> {
  const [result, setResult] = useState<WidgetDataResult<T>>({
    data: null,
    state: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (cancelled) return;
        if (res.status === 404) {
          setResult({ data: null, state: 'empty' });
          return;
        }
        if (!res.ok) {
          setResult({ data: null, state: 'error', error: `HTTP ${res.status}` });
          return;
        }
        const body = (await res.json()) as T;
        if (cancelled) return;
        const isEmpty = Array.isArray(body) && body.length === 0;
        setResult({ data: body, state: isEmpty ? 'empty' : 'ready' });
      } catch (err) {
        if (cancelled) return;
        setResult({
          data: null,
          state: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return result;
}
