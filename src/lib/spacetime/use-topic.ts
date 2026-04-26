'use client';

/**
 * Spacetime data seam.
 *
 * `useIsMockMode()` reads the `?mock=1` URL flag.
 * `useTopic(key)` returns a `SpacetimeTopic` by topic key. With `?mock=1`
 * it returns demo data; otherwise it posts to the new backend endpoint
 * at `/api/v2/theseus/spacetime/topic/`. On cache hit the full topic
 * arrives in the POST response. On cold-start the response is an
 * envelope with a stream URL; we open an EventSource and accumulate
 * `cluster` + `chrome` events until `complete`.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DEMO_TOPICS } from './demo-data';
import type { SpacetimeTopic } from './types';

export function useIsMockMode(): boolean {
  const params = useSearchParams();
  return params.get('mock') === '1';
}

export interface UseTopicResult {
  topic: SpacetimeTopic | null;
  loading: boolean;
  error: Error | null;
}

interface ColdStartEnvelope {
  job_id: string;
  stream_url: string;
  status_url: string;
}

function isEnvelope(v: unknown): v is ColdStartEnvelope {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.job_id === 'string' && typeof o.stream_url === 'string';
}

function isTopic(v: unknown): v is SpacetimeTopic {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.key === 'string' && Array.isArray(o.events);
}

const EMPTY_TOPIC = (key: string): SpacetimeTopic => ({
  key,
  title: key,
  sub: '',
  sources: 0,
  span: [0, 0],
  events: [],
  trace: [],
  mode: 'modern',
});

export function useTopic(key: string | null): UseTopicResult {
  const isMock = useIsMockMode();
  const [topic, setTopic] = useState<SpacetimeTopic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!key) {
      setTopic(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (isMock) {
      setTopic(DEMO_TOPICS[key] ?? null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let eventSource: EventSource | null = null;

    setLoading(true);
    setError(null);
    setTopic(null);

    fetch('/api/v2/theseus/spacetime/topic/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: key }),
    })
      .then(async (resp) => {
        const data = await resp.json();
        if (cancelled) return;

        if (resp.status === 200 && isTopic(data)) {
          setTopic(data);
          setLoading(false);
          return;
        }

        if (resp.status === 202 && isEnvelope(data)) {
          const partial: SpacetimeTopic = EMPTY_TOPIC(key);

          const es = new EventSource(data.stream_url);
          eventSource = es;

          es.addEventListener('cluster', (e) => {
            if (cancelled) return;
            try {
              const c = JSON.parse((e as MessageEvent).data);
              partial.events = [...partial.events, c];
              partial.trace = [...partial.trace, c.id];
              setTopic({ ...partial });
            } catch (parseErr) {
              setError(new Error(`bad cluster payload: ${String(parseErr)}`));
            }
          });

          es.addEventListener('chrome', (e) => {
            if (cancelled) return;
            try {
              const ch = JSON.parse((e as MessageEvent).data);
              if (typeof ch.title === 'string') partial.title = ch.title;
              if (typeof ch.sub === 'string') partial.sub = ch.sub;
              if (ch.mode === 'modern' || ch.mode === 'prehistory') {
                partial.mode = ch.mode;
              }
              setTopic({ ...partial });
            } catch (parseErr) {
              setError(new Error(`bad chrome payload: ${String(parseErr)}`));
            }
          });

          es.addEventListener('complete', (e) => {
            if (cancelled) return;
            try {
              const final = JSON.parse((e as MessageEvent).data);
              if (isTopic(final)) {
                setTopic(final);
              }
            } catch (parseErr) {
              setError(new Error(`bad complete payload: ${String(parseErr)}`));
            }
            setLoading(false);
            es.close();
            eventSource = null;
          });

          es.addEventListener('error', (e) => {
            if (cancelled) return;
            const messageEvent = e as MessageEvent;
            let message = 'spacetime stream failed';
            if (typeof messageEvent.data === 'string' && messageEvent.data) {
              try {
                const parsed = JSON.parse(messageEvent.data);
                if (typeof parsed.error === 'string') message = parsed.error;
                else if (typeof parsed.message === 'string') message = parsed.message;
              } catch {
                /* keep default */
              }
            }
            setError(new Error(message));
            setLoading(false);
            es.close();
            eventSource = null;
          });

          return;
        }

        setError(new Error(`unexpected response (status=${resp.status})`));
        setLoading(false);
      })
      .catch((fetchErr: unknown) => {
        if (cancelled) return;
        setError(
          fetchErr instanceof Error
            ? fetchErr
            : new Error(String(fetchErr)),
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [key, isMock]);

  return { topic, loading, error };
}
