# Spacetime Atlas — backend design

**Date:** 2026-04-25
**Status:** approved
**Predecessor:** `~/.claude/plans/adaptive-zooming-hammock.md` (frontend implementation, shipped)
**Successor:** `2026-04-25-spacetime-backend-implementation-plan.md` (to be written by plan-pro:write-plan)

---

## Context

The `/spacetime` page now ships at `travisgilbert.me/spacetime` with a finished
frontend: a sketched orthographic globe, info cards, a search row, a timeline
scrubber, and a clean data seam at `src/lib/spacetime/use-topic.ts`. Behind
the `?mock=1` flag it renders six seeded topics from the Claude Design
handoff bundle.

The data seam is a single function that today returns demo objects from
`DEMO_TOPICS`. This design replaces its body with a call to a new backend
endpoint that produces the same `SpacetimeTopic` shape — drawing on the
existing Theseus knowledge graph, the Spacetime DyGFormer GNN
(`Index-API/modal_app/spacetime_model.py`), the Firecrawl web-acquisition
pipeline, and the external 26B Gemma 4 MoE LLM dispatched at
`SPEAKING_26B_URL`.

The design is the answer to four user-confirmed architectural choices made in
brainstorming:

1. **Hybrid coverage**: cached topic pages for known queries; on-demand
   cold-start for unknown ones.
2. **Search grows the graph**: every cold-start auto-saves its retrieved
   sources as `provisional` Objects, so the same query is faster next time
   AND the graph self-feeds.
3. **Extracted notes, generated chrome**: hover-note text comes verbatim
   from extracted claims. The 26B writes only the topic title, sub-line,
   and era band.
4. **External 26B**: not the local Railway 4B; the Modal-hosted GGUF that
   already serves `/ask`.

## Outcome

A working backend that turns any topic string into a `SpacetimeTopic`
streamed (or returned synchronously, on cache hit) to the existing
frontend, with no schema changes to the page itself. Cached topics resolve
in <500ms; cold-start in ~15s p50 / 30s p95. Every cold-start contributes
provisional Objects to the graph, scoped by `geom_source` so they are
recoverable in a single SQL filter.

## Decisions log

| # | Question | Choice | Why |
|---|---|---|---|
| 1 | Coverage model | Hybrid: cache + cold-start | Curated quality for hot topics, long-tail coverage for everything else |
| 2 | Cluster note authorship | Extract verbatim claims; 26B for chrome only | Notes are ground truth; chrome can be synthesized |
| 3 | Delivery mode | Hybrid endpoint (sync OR SSE envelope) | Reuses `/ask/async` infra; keeps cached path fast |
| 4 | Cold-start candidate handling | Auto-save as `provisional` Object | Self-organize pipeline already promotes/demotes |

## Endpoint contract

### `POST /api/v2/theseus/spacetime/topic/`

```
Body:    { query: string, mode?: "modern" | "prehistory" | "auto" }
Cache hit (200):
  → SpacetimeTopic JSON
Cache miss (202):
  → { job_id, stream_url, status_url }
```

### `GET /api/v2/theseus/spacetime/stream/<job_id>/`

Server-Sent Events, mirroring the `/ask/stream/` pattern in
`apps/notebook/api/intelligence.py:267`. Events:

| Event | Payload | When |
|---|---|---|
| `stage` | `{name}` (one of: graph_search, web_acquisition, engine_pass, cluster_bucket, gnn_inflection, llm_chrome, complete) | Each pipeline stage start |
| `cluster` | `{id, city, lat, lon, year, papers, note, source_object_ids}` | One per resolved dot, front-loaded by GNN attention magnitude |
| `chrome` | `{title, sub, era_band, mode}` | After 26B JSON-mode call |
| `complete` | full `SpacetimeTopic` payload | Terminal success |
| `error` | `{message}` | Terminal failure |

The stream replays a stored result if the subscriber connects late
(same Redis pub/sub mechanics; channel `theseus:spacetime:<job_id>`).

### `GET /api/v2/theseus/spacetime/status/<job_id>/`

Polling fallback for non-SSE clients. Returns
`{status, stages_completed, error?}`.

## Resolver

`resolve_topic_query(query)` is a pure-Python function executed inside the
`POST /spacetime/topic/` view. Must complete in <50ms. The 26B is
explicitly NOT in this path — it is too slow.

The ladder, executed in order, returns the first match:

1. Slug exact match (`slugify(query)` against `SpacetimeTopicCache.canonical_key`).
2. Title case-insensitive exact match.
3. Substring (slug ⊆ q OR q ⊆ slug).
4. SBERT cosine ≥ 0.7 against `SpacetimeTopicCache.title_embedding`. Reuses
   the existing SBERT pipeline (`apps.notebook.embeddings`).
5. None → `canonical_key = slugify(query)` and the cold-start pipeline
   runs.

## Cold-start pipeline

A single RQ task, `apps.notebook.tasks.spacetime_cold_start_task`, runs on
the existing `worker` dyno. The task is enqueued by the cache-miss branch
of `POST /spacetime/topic/` and publishes events to
`theseus:spacetime:<job_id>` for the SSE relay.

Stages, in order:

| Stage | Action | Bounded budget |
|---|---|---|
| `graph_search` | `unified_retrieve(query, top_k=200)`; filter to objects with non-null `centroid_lat/lon` AND a usable temporal field (published_year, event_year, or `captured_at` fallback) | 2s |
| `web_acquisition` | Skip if graph_search returned ≥30 objects. Else dispatch Firecrawl over 5–10 derived search queries. Save extracted documents as Objects with `status='provisional'`, `geom_source='spacetime_cold_start'`, `geom_confidence=0.3` | 8s |
| `engine_pass` | Wait (bounded) for `run_connection_engine` to extract Place mentions and date metadata for the new objects. Proceed with what's resolved at deadline | 8s |
| `cluster_bucket` | Group all resolved objects by `(canonical_city, year_decade)`. Each bucket is a candidate cluster; `papers` field is bucket size | 500ms |
| `gnn_inflection` | Spacetime GNN scores each bucket via the existing `theseus-spacetime-infer` Modal app. Keep the top 8–12 buckets by attention-spike magnitude. **Emit `cluster` SSE events as buckets resolve, front-loaded by score.** | ~3s (parallel: 12 inferences × ~200ms each on H100 with `max_containers=4`) |
| `llm_chrome` | One JSON-mode call to `SPEAKING_26B_URL` with the topic + cluster summaries; receive `{title, sub, era_band, mode}`. Emit `chrome` event | 5s |
| `complete` | Assemble `SpacetimeTopic`, write to `SpacetimeTopicCache`, emit terminal event | 100ms |

Cluster `note` text is the highest-NLI-score extracted claim from the
bucket's representative Object (via `apps.notebook.models.epistemic.Claim`).
Falls back to `Object.title` if no claim has been extracted yet. Notes are
**always extracted, never generated**.

Total cold-start budget: **15s p50, 30s p95**. The page renders dots
progressively as `cluster` events arrive.

## Cache layer

New Django model in `apps/notebook/models/spacetime.py`:

```python
class SpacetimeTopicCache(TimeStampedModel):
    canonical_key = models.SlugField(max_length=200, unique=True, db_index=True)

    title = models.CharField(max_length=200)
    sub = models.CharField(max_length=300)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES)
    sources = models.IntegerField()
    span_min = models.FloatField()
    span_max = models.FloatField()

    payload_json = models.JSONField()
    title_embedding = pgvector.django.VectorField(dimensions=384)

    object_ids = ArrayField(models.IntegerField())  # for re-bake on Object change
    last_baked_at = models.DateTimeField()
    bake_duration_ms = models.IntegerField()
    bake_count = models.IntegerField(default=1)
```

- Sync hit: return `payload_json` directly. <500ms guaranteed.
- 7-day staleness TTL. Stale-but-extant returns the stale payload AND
  fires a background re-bake on the worker.
- Force re-bake via `?nocache=1` query param on `POST /topic/`.
- `post_delete` signal on `Object`: invalidates any cache entry whose
  `object_ids` includes the deleted PK.

## Auto-save data model

No new "candidate" or "review" model. Cold-start Objects use the existing
`Object` model with these fields fixed:

| Field | Value | Purpose |
|---|---|---|
| `status` | `'provisional'` | Distinguishes from curated content |
| `geom_source` | `'spacetime_cold_start'` | Single filter for cleanup or audit |
| `geom_confidence` | `0.3` | Below default promotion threshold |
| `notebook` | "Spacetime Inbox" (fixed Notebook, created on first use) | Easy human inspection |

These objects flow through the standard self-organize pipeline:
- `evolve_edges` may promote them when they accumulate engagement
- `web_validation` may cross-check or evict them
- `decay` reduces edge weights for un-engaged stale ones

Recovery path for a bad batch:
```
Object.objects.filter(geom_source='spacetime_cold_start').delete()
```

## Frontend wiring

`src/lib/spacetime/use-topic.ts` body changes from the demo-data lookup to:

```ts
export function useTopic(key: string | null): UseTopicResult {
  const [topic, setTopic] = useState<SpacetimeTopic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!key) { setTopic(null); return; }
    setLoading(true);

    fetch('/api/v2/theseus/spacetime/topic/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: key }),
    })
      .then(r => r.json())
      .then(data => {
        if ('events' in data) {
          // Cache hit — full payload
          setTopic(data);
          setLoading(false);
        } else if (data.stream_url) {
          // Cold-start — open SSE, accumulate progressively
          const es = new EventSource(data.stream_url);
          const partial: Partial<SpacetimeTopic> = { events: [], trace: [] };
          es.addEventListener('cluster', (e) => {
            const c = JSON.parse((e as MessageEvent).data);
            partial.events!.push(c);
            partial.trace!.push(c.id);
            setTopic({ ...partial } as SpacetimeTopic);
          });
          es.addEventListener('chrome', (e) => {
            const ch = JSON.parse((e as MessageEvent).data);
            Object.assign(partial, ch);
            setTopic({ ...partial } as SpacetimeTopic);
          });
          es.addEventListener('complete', (e) => {
            setTopic(JSON.parse((e as MessageEvent).data));
            setLoading(false);
            es.close();
          });
          es.addEventListener('error', () => {
            setError(new Error('Stream failed'));
            setLoading(false);
            es.close();
          });
        }
      })
      .catch(e => { setError(e); setLoading(false); });
  }, [key]);

  return { topic, loading, error };
}
```

The Globe component already filters events by `event.year <= yearMax`, so
progressive cluster arrival is a no-op visually until each event's year
catches up to the playhead. The dotted geodesic trace recomputes every
render so traces extend organically as the trace array grows.

The `?mock=1` gate disappears. The empty state remains for "no query".

## Telemetry — `SpacetimeQueryLog`

```python
class SpacetimeQueryLog(TimeStampedModel):
    query = models.CharField(max_length=500)
    canonical_key = models.SlugField(max_length=200, db_index=True)
    resolver_step = models.CharField(max_length=20)  # slug/title/substring/sbert/cold_start
    cache_hit = models.BooleanField(db_index=True)
    stages_completed = ArrayField(models.CharField(max_length=30))
    duration_ms_per_stage = models.JSONField()
    cluster_count = models.IntegerField(null=True)
    web_objects_added = models.IntegerField(default=0)
    error = models.TextField(blank=True)
```

Powers:
- "What's been searched but never re-searched?"
- "Where do cold-starts get stuck?" (look at terminal stage in `stages_completed`)
- p50/p95 latency over time
- New IQ axis: `spacetime_coverage = cache_hits / total_queries`

## Out of scope (V1)

- Admin review queue
- Separate `SpacetimeCandidate` model
- 26B-generated cluster notes
- Multi-user concurrency / per-user caching
- Cluster feedback / thumbs up-down
- API-layer cross-topic linkage computation (frontend handles in-memory)
- Multi-language topic resolution

## Risk register

| Risk | Mitigation |
|---|---|
| Firecrawl returns nothing for a long-tail query | `engine_pass` proceeds with whatever graph_search returned; cold-start cluster count may be < 8. Page handles 0 events as the empty state. |
| 26B unavailable / slow | `llm_chrome` stage has a 5s timeout. On failure, `chrome` event still fires with `{title: query, sub: '', era_band: derived from year-span, mode: 'modern' if span endpoints are positive else 'prehistory'}`. |
| Bad query nukes the graph with garbage Objects | One-line filter recovery: `Object.objects.filter(geom_source='spacetime_cold_start').delete()`. Plus the standard self-organize decay loops will down-weight low-engagement objects over time. |
| Cache table grows unbounded | TTL eviction job runs nightly; entries with no read in 90d are deleted along with their `object_ids` references (not the Objects themselves). |
| Cold-start latency exceeds 30s | Hard timeout at 45s; emit `error` event. Frontend shows a polite "couldn't reach a result for this query" state. |
| Spacetime Inbox notebook fills with noise | Owner can purge with the recovery query above. The Inbox is a curatorial surface, not a permanent home. |

## Verification (when implemented)

1. `POST /api/v2/theseus/spacetime/topic/ {"query": "sickle cell anemia"}` returns SpacetimeTopic JSON in <500ms after the first cold-start populates the cache.
2. `POST {"query": "carthaginian salt trade"}` returns `{job_id, stream_url}` envelope; SSE stream produces ≥3 `cluster` events and a `chrome` event within 30s; resulting Objects are queryable by `geom_source='spacetime_cold_start'`.
3. Frontend `/spacetime?mock=1` continues to work (mock path falls back to demo data; the `?mock=1` flag becomes a dev override that bypasses the API).
4. Frontend `/spacetime` (no flag) renders progressive clusters during cold-start; cached re-query shows instantly.
5. `Object.objects.filter(geom_source='spacetime_cold_start').delete()` cleans the slate without touching curated content.
6. `SpacetimeQueryLog` rows accumulate; p50/p95 query duration computable.
