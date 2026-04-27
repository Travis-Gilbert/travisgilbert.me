'use client';

/**
 * Spacetime data seam.
 *
 * `useTopic(key)` returns a `SpacetimeTopic` by topic key. It posts to
 * the backend at `/api/v2/theseus/spacetime/topic/`. On cache hit the
 * full topic arrives in the POST response (200). On cold-start the
 * response is a 202 envelope with a stream URL; we open an EventSource
 * and accumulate `cluster` + `chrome` events until `complete`.
 *
 * There is no mock mode and no demo allowlist: if the backend cannot
 * answer, the hook returns null + an error and the page renders an
 * honest empty state.
 */

import { useEffect, useState } from 'react';
import type { SpacetimeTopic } from './types';

/** Pipeline stage names emitted by the backend cold-start in order:
 *  graph_search (implicit before stream connects), web_acquisition,
 *  engine_pass, cluster_bucket, gnn_inflection, llm_chrome, complete.
 *  We surface these as a humanized progress hint while loading is true. */
export type SpacetimeStage =
  | 'starting'
  | 'web_acquisition'
  | 'engine_pass'
  | 'cluster_bucket'
  | 'gnn_inflection'
  | 'llm_chrome'
  | 'complete';

export interface UseTopicResult {
  topic: SpacetimeTopic | null;
  loading: boolean;
  /** Latest pipeline stage announced by the backend; null when no
   *  request is in flight (i.e. cache hit or empty key). */
  stage: SpacetimeStage | null;
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
  const [topic, setTopic] = useState<SpacetimeTopic | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<SpacetimeStage | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!key) {
      setTopic(null);
      setLoading(false);
      setStage(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let eventSource: EventSource | null = null;

    setLoading(true);
    setStage('starting');
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
          setStage('complete');
          setLoading(false);
          return;
        }

        if (resp.status === 202 && isEnvelope(data)) {
          const partial: SpacetimeTopic = EMPTY_TOPIC(key);

          const es = new EventSource(data.stream_url);
          eventSource = es;

          // Backend announces pipeline progress as `event: stage` lines.
          // We surface the latest stage to the UI so the user sees that
          // work is happening during the multi-second cold-start.
          es.addEventListener('stage', (e) => {
            if (cancelled) return;
            try {
              const s = JSON.parse((e as MessageEvent).data);
              if (typeof s.name === 'string') {
                setStage(s.name as SpacetimeStage);
              }
            } catch {
              /* ignore malformed stage payloads */
            }
          });

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
            setStage('complete');
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
  }, [key]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { topic, loading, stage, error };
}
