# Stage 7: Frontend wire-up + cache invalidation signal + verification

_Part of multi-file plan. See [implementation-plan.md](implementation-plan.md) for the index._

## Overview

Stage 7 lands the only frontend change: replacing the body of `useTopic()` so it talks to the new backend. The `?mock=1` flag still bypasses the API and renders demo data (a developer override). All other behavior comes from the real endpoint.

Then we run the four end-to-end verification scenarios from the design doc against a local backend.

## Prerequisites

- Stages 0-6 complete; backend ready on `http://localhost:8000`.
- The Next.js dev server can be started in the Website repo via `npm run dev`.
- The Next.js rewrite proxy at `/api/*` already forwards to the Index-API backend (see `next.config.ts`).

## Files this stage touches

```
Website/
└── src/lib/spacetime/use-topic.ts                # MOD: full body replacement

Index-API/
└── (no further changes; verification only)
```

## Tasks

### Task 7.1: Replace `useTopic()` body to talk to the backend

**Files**:
- Modify: `/Users/travisgilbert/Tech Dev Local/Creative/Website/src/lib/spacetime/use-topic.ts`

**Test first**: there is no Jest harness for this hook in the Website repo (per the broader project conventions: TypeScript files lean on type checking + manual end-to-end). Use `npm run lint` and `tsc --noEmit` as the typecheck. The behavioral verification lives in Task 7.4 (`/spacetime?q=...` against the local backend).

Run pre-change typecheck:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website && \
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -5
```

Expected: 0 errors related to `src/lib/spacetime/`.

**Implementation**:

Overwrite `src/lib/spacetime/use-topic.ts` with the new body. Keep the file's existing `useIsMockMode()` export intact and replace `useTopic()` end-to-end:

```typescript
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
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website && \
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -10
```

Expected: 0 errors related to `src/lib/spacetime/use-topic.ts`. If `useEffect` complains about `useSearchParams` rules (it should not; `useIsMockMode` already uses it the same way), verify the existing `useIsMockMode` import path.

Then run the project lint:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website && npm run lint 2>&1 | tail -20
```

Expected: no new errors in `src/lib/spacetime/use-topic.ts`.

**Commit**: `feat(spacetime): wire useTopic to /api/v2/theseus/spacetime/topic/`

**Delegate to**: next-pro

---

### Task 7.2: Cache-hit verification (warm topic)

**Files**:
- None. This task runs the verification scenarios from the design doc against a live local backend.

**Test first**: prerequisite setup. Start the backend in one terminal:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py runserver 8000
```

In a second terminal, prepopulate one cache row so we can confirm the sub-500ms path:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py shell -c "
from apps.notebook.models import SpacetimeTopicCache
SpacetimeTopicCache.objects.update_or_create(
    canonical_key='sickle-cell-anemia',
    defaults={
        'title': 'Sickle cell anemia',
        'sub': 'A genetic blood disorder.',
        'mode': 'modern',
        'sources': 12,
        'span_min': 1910,
        'span_max': 2024,
        'payload_json': {
            'key': 'sickle-cell-anemia',
            'title': 'Sickle cell anemia',
            'sub': 'A genetic blood disorder.',
            'sources': 12,
            'span': [1910, 2024],
            'events': [
                {'id': 1, 'city': 'Cairo', 'lat': 30.0, 'lon': 31.2,
                 'year': 1910, 'papers': 4, 'note': 'sample note',
                 'accent': 'terracotta'},
            ],
            'trace': [1],
            'mode': 'modern',
        },
        'object_ids': [],
    },
)
print('seeded cache')
"
```

Then time the request:

```bash
time curl -sf -X POST http://localhost:8000/api/v2/theseus/spacetime/topic/ \
  -H 'Content-Type: application/json' \
  -d '{"query": "sickle cell anemia"}' | python3 -m json.tool | head -30
```

**Implementation**: confirm the response is a 200 with the SpacetimeTopic JSON (not the envelope), and the wall-clock time is under 500 ms. If timing exceeds 500 ms, flag the resolver step and add an index. The most likely culprit is the SBERT step pulling weights on the first call: move the encoder warm-up to gunicorn startup if needed.

**Verify**:
- `curl` returns HTTP 200.
- The body has `events` array with at least one element.
- `time` reports total elapsed < 0.5 s (the 50 ms resolver budget plus serialisation).

**Commit**: this task does not produce code; commit any minor adjustments needed to keep the cache hit fast under one tag:
`perf(spacetime): cache hit returns under 500ms` (only if changes made; otherwise skip the commit).

**Delegate to**: django-engine-pro

---

### Task 7.3: Cold-start verification (long-tail topic)

**Files**:
- None. Live verification.

**Test first**: with the backend running, fire a query that has no matching cache row:

```bash
curl -i -X POST http://localhost:8000/api/v2/theseus/spacetime/topic/ \
  -H 'Content-Type: application/json' \
  -d '{"query": "carthaginian salt trade"}' 2>&1 | head -25
```

Expected response: HTTP 202 with body shape `{"job_id": "...", "stream_url": "/api/v2/theseus/spacetime/stream/...", "status_url": "/api/v2/theseus/spacetime/status/..."}`. Capture the `job_id` from the response.

Then open the stream:

```bash
curl -N http://localhost:8000<STREAM_URL>
```

Within ~30 seconds the stream should emit:
- one or more `event: stage` events for graph_search, web_acquisition, engine_pass, cluster_bucket, gnn_inflection, llm_chrome, complete.
- at least three `event: cluster` events (per design-doc verification scenario 2) each with a JSON payload containing `id`, `city`, `lat`, `lon`, `year`, `papers`, `note`. If fewer than three arrive, that is a stage-budget or retrieval-quality issue: file a follow-up rather than relaxing this assertion.
- one `event: chrome` with `{title, sub, era_band, mode}`.
- one `event: complete` with the full SpacetimeTopic payload.
- finally `event: done`.

Confirm provisional ingestion happened:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py shell -c "
from apps.notebook.models import Object
n = Object.objects.filter(geom_source='spacetime_cold_start').count()
print(f'provisional spacetime objects: {n}')
"
```

Expected: a non-zero count proportional to the search results that admitted through `provisional_ingest.ingest_provisional_page`.

**Implementation**: if cold-start fails or stalls, look at:
1. RQ worker is running locally (Stage 4 dispatches the task to RQ; without a worker, no events fire).
2. Tavily/Firecrawl env vars are set (`TAVILY_API_KEY` or equivalent).
3. The Modal `theseus-spacetime-infer` is reachable (otherwise the GNN stage falls back to papers-count ranking, which is fine but slower under load).
4. `SPEAKING_26B_URL` is reachable (otherwise chrome falls back to heuristic, which still emits the event).

If a stage stalls past its bounded budget, the orchestrator currently does not enforce a hard kill (only the per-stage budget is documented). Add `time.monotonic() > deadline` checks to whichever stage is hanging and either short-circuit or `raise TimeoutError(...)` so the task shell publishes `error`. Note that as a follow-up.

**Verify**:
- 202 envelope returned.
- SSE stream emits `cluster`, `chrome`, `complete` within 30 seconds.
- `Object.objects.filter(geom_source='spacetime_cold_start').count()` increased.

**Commit**: skip unless code changes were needed. Any tightening of stage budgets goes in `pkg(spacetime): tighten <stage> budget enforcement`.

**Delegate to**: django-engine-pro

---

### Task 7.4: Frontend end-to-end verification

**Files**:
- None. Live verification.

**Test first**: with the backend running, start the Next.js dev server:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website && \
npm run dev
```

Visit the four URLs and confirm each:

1. `http://localhost:3000/spacetime?mock=1`: the demo data still renders.
2. `http://localhost:3000/spacetime?q=sickle-cell-anemia` (with the cache row from Task 7.2 still present): the topic renders instantly with no flicker. The card shows "Sickle cell anemia". Cluster dots render.
3. `http://localhost:3000/spacetime?q=carthaginian-salt-trade` (cold-start): the page enters a loading state, then progressively renders cluster dots and updates the card title once the chrome event arrives.
4. After step 3 completes, refresh the page on the same URL: the topic now renders instantly (cache hit on the freshly baked row).

Run the recovery query to confirm `geom_source` filtering works:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py shell -c "
from apps.notebook.models import Object
qs = Object.objects.filter(geom_source='spacetime_cold_start')
print(f'count: {qs.count()}')
for o in qs[:3]:
    print(f'  pk={o.pk} title={o.title[:60]!r}')
"
```

If a batch needs cleanup at any point during testing:

```bash
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py shell -c "
from apps.notebook.models import Object
n, _ = Object.objects.filter(geom_source='spacetime_cold_start').delete()
print(f'deleted {n}')
"
```

**Implementation**: investigate any flicker, missing cluster events, or layout issues. The most likely failures are:
- `EventSource.error` fires immediately because the proxy strips SSE headers. Fix: the SSE response sets `X-Accel-Buffering: no` already; if Next.js's `next.config.ts` rewrite buffers, document this gotcha.
- `setTopic({ ...partial })` in the SSE handlers references the same array each time. Fix: use immutable spreads as the implementation in Task 7.1 already does. If state updates feel sluggish, switch to `useReducer` for accumulator semantics.
- `TypeError: SpacetimeTopic.events is not iterable` on first cluster event. Fix: confirm `EMPTY_TOPIC` returns `events: []` and `trace: []`.

**Verify**: all four scenarios behave as described.

**Commit**: only if code changes are required, e.g. `fix(spacetime): preserve event ordering in EventSource handler`. Otherwise this task is verification only.

**Delegate to**: next-pro

---

## Stage exit criteria

- All 4 tasks marked `[done]`.
- Cache hit path returns SpacetimeTopic JSON in <500 ms.
- Cold-start path emits at least one `cluster` event and one `chrome` event within 30 s, and provisional Objects flow into the graph with `geom_source='spacetime_cold_start'`.
- `/spacetime?mock=1` continues to render demo data.
- `/spacetime?q=<topic>` renders progressive clusters during cold-start; cache re-query renders instantly.
- `Object.objects.filter(geom_source='spacetime_cold_start').delete()` cleans the slate without touching curated content.

## Project completion checklist

- All eight stages complete.
- Both repos have clean commits on their respective `main` branches:
  - `Index-API`: model, migration, middleware, services, tasks, signals, command, tests.
  - `Website`: `src/lib/spacetime/use-topic.ts` body replacement.
- Push order per `feedback_django_import_smoke.md`: backend first, then frontend. Run the import smoke right before each push:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 -c "import django; django.setup(); from apps.notebook import models, tasks; from apps.notebook.api import spacetime; from apps.notebook.services import spacetime_jobs, spacetime_resolver, spacetime_pipeline, spacetime_clusters"
```

- Stage files for `Index-API` to stage explicitly (per the noisy-working-tree gotcha):

```
apps/notebook/models/spacetime.py
apps/notebook/models/__init__.py
apps/notebook/migrations/0098_spacetime_cache_and_querylog.py
apps/notebook/api/spacetime.py
apps/notebook/services/spacetime_jobs.py
apps/notebook/services/spacetime_resolver.py
apps/notebook/services/spacetime_pipeline.py
apps/notebook/services/spacetime_clusters.py
apps/notebook/management/commands/seed_spacetime_inbox.py
apps/notebook/signals_spacetime.py
apps/notebook/apps.py
apps/notebook/tasks.py
apps/notebook/tests/test_spacetime_resolver.py
apps/notebook/tests/test_spacetime_pipeline.py
apps/notebook/tests/test_spacetime_clusters.py
apps/notebook/tests/test_spacetime_jobs.py
apps/notebook/tests/test_spacetime_api.py
apps/notebook/tests/test_seed_spacetime_inbox.py
apps/api/middleware.py
config/api_v2.py
```

- Never run `git add .` in `Index-API`; stage by name only.
- Run `python3 manage.py seed_spacetime_inbox` once on Railway after the backend deploys to ensure the canonical Notebook exists in production.
