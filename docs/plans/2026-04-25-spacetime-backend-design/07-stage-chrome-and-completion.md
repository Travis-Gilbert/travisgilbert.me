# Stage 6: 26B JSON-mode chrome, completion, cache write, telemetry

_Part of multi-file plan. See [implementation-plan.md](implementation-plan.md) for the index._

## Overview

Stage 6 finishes the seven-stage pipeline. Two pipeline stages register here:

| Stage | Action | Bounded budget |
|---|---|---|
| `llm_chrome` | One JSON-mode call to `SPEAKING_26B_URL` via `call_speaking_service('26b', ...)`. Receives `{title, sub, era_band, mode}`. Falls back to a deterministic chrome derived from the year-span on failure. Emits a `chrome` SSE event. | 5 s |
| `complete` | Assemble the full `SpacetimeTopic` payload, write to `SpacetimeTopicCache`, log to `SpacetimeQueryLog`, populate the SBERT title embedding for future resolver step-4 hits. | 100 ms |

After this stage the pipeline is complete: every `STAGES` slot is filled and `run_pipeline` returns a real `SpacetimeTopic`.

## Prerequisites

- Stages 0-5 complete.
- `apps.notebook.speaking_dispatch.call_speaking_service('26b', ...)` exists and accepts `prompt`, `max_tokens`, `temperature`, `timeout`, `stop`.
- `apps.notebook.embedding_service.get_embedding_for_text(...)` exists.
- `apps.notebook.models.SpacetimeTopicCache` and `SpacetimeQueryLog` migrated.

## Files this stage touches

```
Index-API/
├── apps/notebook/services/spacetime_clusters.py       # MOD: 26B chrome helper
├── apps/notebook/services/spacetime_pipeline.py       # MOD: register llm_chrome + complete stages
├── apps/notebook/tests/test_spacetime_clusters.py     # MOD: chrome tests
└── apps/notebook/tests/test_spacetime_pipeline.py     # MOD: assemble + cache write tests
```

## Tasks

### Task 6.1: 26B JSON-mode chrome helper

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_clusters.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_clusters.py`

**Test first**: append to `test_spacetime_clusters.py`:

```python
class GenerateChromeTest(TestCase):
    @patch('apps.notebook.speaking_dispatch.call_speaking_service')
    def test_chrome_parses_clean_json(self, mock_call):
        mock_call.return_value = {
            'text': '{"title": "Sickle cell anemia", "sub": "A genetic blood disorder", "era_band": "modern", "mode": "modern"}',
            'tokens_generated': 32,
            'elapsed_seconds': 1.2,
            'stop_reason': 'stop',
        }
        from apps.notebook.services.spacetime_clusters import generate_chrome
        chrome = generate_chrome(
            query='sickle cell anemia',
            clusters=[
                {'id': 1, 'city': 'Cairo', 'year': 1910, 'note': '...'},
            ],
            year_span=(1910, 2024),
        )
        self.assertEqual(chrome['title'], 'Sickle cell anemia')
        self.assertEqual(chrome['mode'], 'modern')
        self.assertEqual(chrome['era_band'], 'modern')

    @patch('apps.notebook.speaking_dispatch.call_speaking_service')
    def test_chrome_strips_markdown_fence(self, mock_call):
        # The 26B sometimes wraps JSON in a code fence even under "json mode".
        mock_call.return_value = {
            'text': '```json\n{"title": "T", "sub": "S", "era_band": "modern", "mode": "modern"}\n```',
            'tokens_generated': 32,
            'elapsed_seconds': 1.2,
            'stop_reason': 'stop',
        }
        from apps.notebook.services.spacetime_clusters import generate_chrome
        chrome = generate_chrome(
            query='q', clusters=[], year_span=(1900, 2000),
        )
        self.assertEqual(chrome['title'], 'T')

    @patch('apps.notebook.speaking_dispatch.call_speaking_service')
    def test_chrome_falls_back_when_26b_returns_none(self, mock_call):
        mock_call.return_value = None
        from apps.notebook.services.spacetime_clusters import generate_chrome
        chrome = generate_chrome(
            query='paleolithic europe', clusters=[],
            year_span=(-30000, -10000),
        )
        self.assertEqual(chrome['title'], 'paleolithic europe')
        self.assertEqual(chrome['mode'], 'prehistory')
        self.assertEqual(chrome['era_band'], 'prehistory')

    @patch('apps.notebook.speaking_dispatch.call_speaking_service')
    def test_chrome_falls_back_on_invalid_json(self, mock_call):
        mock_call.return_value = {
            'text': 'this is definitely not json',
            'tokens_generated': 8, 'elapsed_seconds': 0.5,
            'stop_reason': 'stop',
        }
        from apps.notebook.services.spacetime_clusters import generate_chrome
        chrome = generate_chrome(
            query='topic', clusters=[], year_span=(1900, 2024),
        )
        self.assertEqual(chrome['title'], 'topic')
        self.assertEqual(chrome['mode'], 'modern')
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_clusters.GenerateChromeTest -v 2
```

Expected: 4 FAIL with `ImportError`.

**Implementation**:

Append to `apps/notebook/services/spacetime_clusters.py`:

```python
import json
import re

CHROME_TIMEOUT_S = 5.0
CHROME_MAX_TOKENS = 200
CHROME_TEMPERATURE = 0.4

_JSON_FENCE_RE = re.compile(r'^```(?:json)?\s*|\s*```$', re.MULTILINE)


def _build_chrome_prompt(
    query: str,
    clusters: list[dict[str, Any]],
    year_span: tuple[int, int],
) -> str:
    """Build the chrome-only prompt for the 26B.

    Notes are NOT in this prompt; the 26B never sees individual claim
    text. We give it (a) the user's query, (b) at most the first three
    cluster summaries (city, year, papers), and (c) the year-span. The
    response must be one JSON object with title, sub, era_band, mode.
    """
    cluster_summary_lines = []
    for c in clusters[:3]:
        cluster_summary_lines.append(
            f'- {c.get("city","?")} ({c.get("year","?")}): '
            f'{c.get("papers","?")} sources'
        )
    cluster_summary = '\n'.join(cluster_summary_lines) or '(none)'

    return (
        'You are writing chrome metadata for a research-atlas page about '
        'a topic. Reply with one JSON object only. No prose, no markdown '
        'fence. Schema:\n'
        '  {"title": <60-char title>, "sub": <short tagline up to 120 chars>, '
        '"era_band": "modern"|"prehistory"|"medieval"|"ancient", '
        '"mode": "modern"|"prehistory"}\n\n'
        f'User query: {query}\n'
        f'Year span: {year_span[0]} to {year_span[1]}\n'
        f'Top clusters:\n{cluster_summary}\n\n'
        'Reply with the JSON object only.'
    )


def _strip_json_fence(text: str) -> str:
    text = text.strip()
    if text.startswith('```'):
        text = _JSON_FENCE_RE.sub('', text).strip()
    return text


def _heuristic_chrome(
    query: str, year_span: tuple[int, int],
) -> dict[str, Any]:
    """Deterministic chrome for when the 26B is unavailable / broken.

    `mode` is `prehistory` if both span endpoints are negative (BCE);
    `era_band` mirrors `mode` for V1.
    """
    is_pre = year_span[0] < 0 and year_span[1] <= 0
    return {
        'title': query.strip() or 'untitled topic',
        'sub': '',
        'era_band': 'prehistory' if is_pre else 'modern',
        'mode': 'prehistory' if is_pre else 'modern',
    }


def generate_chrome(
    *,
    query: str,
    clusters: list[dict[str, Any]],
    year_span: tuple[int, int],
) -> dict[str, Any]:
    """Generate {title, sub, era_band, mode} for the topic.

    Calls the 26B once with a 5-second timeout. On any failure path
    (None response, non-JSON text, missing keys), falls back to a
    deterministic chrome derived from the year span.
    """
    from apps.notebook.speaking_dispatch import call_speaking_service

    prompt = _build_chrome_prompt(query, clusters, year_span)
    try:
        result = call_speaking_service(
            '26b',
            prompt=prompt,
            max_tokens=CHROME_MAX_TOKENS,
            temperature=CHROME_TEMPERATURE,
            timeout=CHROME_TIMEOUT_S,
        )
    except Exception as exc:
        logger.warning('spacetime_clusters: 26B chrome call raised: %s', exc)
        return _heuristic_chrome(query, year_span)

    if result is None:
        return _heuristic_chrome(query, year_span)

    text = (result.get('text') or '').strip()
    if not text:
        return _heuristic_chrome(query, year_span)

    text = _strip_json_fence(text)
    try:
        parsed = json.loads(text)
    except Exception:
        return _heuristic_chrome(query, year_span)

    if not isinstance(parsed, dict):
        return _heuristic_chrome(query, year_span)

    title = (parsed.get('title') or '').strip() or query.strip()
    sub = (parsed.get('sub') or '').strip()
    mode = parsed.get('mode')
    era_band = parsed.get('era_band')
    if mode not in ('modern', 'prehistory'):
        mode = 'prehistory' if year_span[0] < 0 and year_span[1] <= 0 else 'modern'
    if era_band not in ('modern', 'prehistory', 'medieval', 'ancient'):
        era_band = mode

    return {
        'title': title[:200],
        'sub': sub[:300],
        'era_band': era_band,
        'mode': mode,
    }
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_clusters.GenerateChromeTest -v 2
```

Expected: 4 PASS.

**Commit**: `feat(spacetime): generate_chrome helper with 26B + heuristic fallback`

**Delegate to**: django-engine-pro

---

### Task 6.2: `llm_chrome` and `complete` pipeline stages

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_pipeline.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: append to `test_spacetime_pipeline.py`:

```python
class LlmChromeStageTest(TestCase):
    @patch('apps.notebook.services.spacetime_pipeline.generate_chrome')
    @patch('apps.notebook.services.spacetime_jobs.publish_event')
    def test_publishes_chrome_event(self, mock_publish, mock_gen):
        mock_gen.return_value = {
            'title': 'T', 'sub': 'S', 'era_band': 'modern', 'mode': 'modern',
        }
        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        ctx = PipelineContext(
            spacetime_job_id='j', query='q', canonical_key='q',
            mode=None, force=False,
        )
        ctx.clusters = [
            {'id': 1, 'city': 'Cairo', 'year': 1900, 'papers': 3, 'note': '...',
             'lat': 30.0, 'lon': 31.0, 'source_object_ids': [1, 2, 3],
             'accent': 'terracotta'},
        ]
        patch_dict = STAGES['llm_chrome'](ctx)
        self.assertEqual(patch_dict['chrome']['title'], 'T')
        events = [c.args[1] for c in mock_publish.call_args_list]
        self.assertIn('chrome', events)


class CompleteStageTest(TestCase):
    @patch('apps.notebook.embedding_service.get_embedding_for_text', return_value=[0.0] * 384)
    def test_writes_cache_and_log(self, _mock_embed):
        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        from apps.notebook.models import SpacetimeTopicCache, SpacetimeQueryLog

        ctx = PipelineContext(
            spacetime_job_id='j', query='Sickle cell anemia',
            canonical_key='sickle-cell-anemia', mode=None, force=False,
        )
        ctx.clusters = [
            {'id': 1, 'city': 'Cairo', 'lat': 30.0, 'lon': 31.0,
             'year': 1910, 'papers': 3, 'note': 'note',
             'source_object_ids': [1, 2, 3], 'accent': 'terracotta'},
        ]
        ctx.chrome = {
            'title': 'Sickle cell anemia', 'sub': 'A genetic disorder',
            'era_band': 'modern', 'mode': 'modern',
        }
        ctx.web_objects_added = 2
        ctx.duration_ms_per_stage = {'graph_search': 800}

        patch_dict = STAGES['complete'](ctx)

        self.assertIn('final_payload', patch_dict)
        payload = patch_dict['final_payload']
        self.assertEqual(payload['key'], 'sickle-cell-anemia')
        self.assertEqual(payload['title'], 'Sickle cell anemia')
        self.assertEqual(payload['span'], [1910, 1910])
        self.assertEqual(len(payload['events']), 1)
        self.assertEqual(payload['events'][0]['city'], 'Cairo')
        self.assertEqual(payload['trace'], [1])

        # Cache row written.
        cache = SpacetimeTopicCache.objects.get(canonical_key='sickle-cell-anemia')
        self.assertEqual(cache.title, 'Sickle cell anemia')
        self.assertEqual(cache.object_ids, [1, 2, 3])

        # Query log row written.
        log = SpacetimeQueryLog.objects.get(canonical_key='sickle-cell-anemia')
        self.assertFalse(log.cache_hit)
        self.assertEqual(log.resolver_step, 'cold_start')
        self.assertEqual(log.cluster_count, 1)
        self.assertEqual(log.web_objects_added, 2)
        self.assertEqual(log.duration_ms_per_stage, {'graph_search': 800})

    def test_complete_with_no_clusters_writes_empty_topic_only_to_log(self):
        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        from apps.notebook.models import SpacetimeTopicCache, SpacetimeQueryLog
        ctx = PipelineContext(
            spacetime_job_id='j', query='novel',
            canonical_key='novel', mode=None, force=False,
        )
        ctx.clusters = []
        ctx.chrome = {
            'title': 'novel', 'sub': '', 'era_band': 'modern', 'mode': 'modern',
        }
        with patch(
            'apps.notebook.embedding_service.get_embedding_for_text',
            return_value=[0.0] * 384,
        ):
            patch_dict = STAGES['complete'](ctx)
        # Empty topic still writes a log row but does NOT write the cache
        # (we don't want to lock in a "no clusters" state).
        self.assertEqual(SpacetimeQueryLog.objects.count(), 1)
        self.assertEqual(SpacetimeTopicCache.objects.count(), 0)
        self.assertEqual(patch_dict['final_payload']['events'], [])
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.LlmChromeStageTest apps.notebook.tests.test_spacetime_pipeline.CompleteStageTest -v 2
```

Expected: 3 FAIL with `KeyError`.

**Implementation**:

Append to `apps/notebook/services/spacetime_pipeline.py`:

```python
def _stage_llm_chrome(ctx: PipelineContext) -> dict[str, Any]:
    """Stage 6: 26B JSON-mode chrome generation.

    The chrome event fires before the complete event so the frontend
    can update the topic title / sub line as soon as it arrives, even
    while later cluster events continue to stream.
    """
    years = [c.get('year') for c in ctx.clusters or [] if c.get('year') is not None]
    if years:
        year_span = (int(min(years)), int(max(years)))
    else:
        year_span = (0, 0)

    chrome = generate_chrome(
        query=ctx.query,
        clusters=ctx.clusters or [],
        year_span=year_span,
    )
    spacetime_jobs.publish_event(
        ctx.spacetime_job_id, 'chrome', chrome,
    )
    return {'chrome': chrome}


def _stage_complete(ctx: PipelineContext) -> dict[str, Any]:
    """Stage 7: assemble SpacetimeTopic, write cache + log, return payload.

    Cache is only written when at least one cluster resolved. Empty
    topics are still logged for telemetry but never lock in.
    """
    from apps.notebook.embedding_service import get_embedding_for_text
    from apps.notebook.models import SpacetimeTopicCache, SpacetimeQueryLog

    clusters = list(ctx.clusters or [])
    chrome = dict(ctx.chrome or {})
    if not chrome:
        chrome = {
            'title': ctx.query,
            'sub': '',
            'era_band': 'modern',
            'mode': ctx.mode or 'modern',
        }

    if clusters:
        years = [c['year'] for c in clusters if c.get('year') is not None]
        span_min = int(min(years)) if years else 0
        span_max = int(max(years)) if years else 0
    else:
        span_min, span_max = 0, 0

    object_ids: list[int] = []
    for c in clusters:
        for pk in c.get('source_object_ids') or []:
            object_ids.append(int(pk))

    payload = {
        'key': ctx.canonical_key,
        'title': chrome.get('title') or ctx.query,
        'sub': chrome.get('sub') or '',
        'sources': len(object_ids),
        'span': [span_min, span_max],
        'events': clusters,
        'trace': [c['id'] for c in clusters],
        'mode': chrome.get('mode') or ctx.mode or 'modern',
    }

    # Embed the title for resolver step 4 future hits. Failures are
    # non-fatal: we just leave title_embedding null.
    title_embedding = None
    try:
        title_embedding = get_embedding_for_text(payload['title'])
        if title_embedding is not None:
            title_embedding = list(title_embedding)
    except Exception as exc:
        logger.warning('spacetime_pipeline: title embed failed: %s', exc)

    bake_duration_ms = sum(ctx.duration_ms_per_stage.values())

    if clusters:
        SpacetimeTopicCache.objects.update_or_create(
            canonical_key=ctx.canonical_key,
            defaults={
                'title': payload['title'][:200],
                'sub': payload['sub'][:300],
                'mode': payload['mode'],
                'sources': payload['sources'],
                'span_min': float(span_min),
                'span_max': float(span_max),
                'payload_json': payload,
                'title_embedding': title_embedding,
                'object_ids': object_ids,
                'bake_duration_ms': bake_duration_ms,
                'bake_count': 1,
            },
        )

    SpacetimeQueryLog.objects.create(
        query=(ctx.query or '')[:500],
        canonical_key=ctx.canonical_key,
        resolver_step='cold_start',
        cache_hit=False,
        stages_completed=list(ctx.duration_ms_per_stage.keys()),
        duration_ms_per_stage=ctx.duration_ms_per_stage,
        cluster_count=len(clusters),
        web_objects_added=int(ctx.web_objects_added or 0),
    )

    return {'final_payload': payload}


# Re-export for tests.
from apps.notebook.services.spacetime_clusters import (  # noqa: E402, F401
    generate_chrome,
)


STAGES['llm_chrome'] = _stage_llm_chrome
STAGES['complete'] = _stage_complete
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.LlmChromeStageTest apps.notebook.tests.test_spacetime_pipeline.CompleteStageTest -v 2
```

Expected: 3 PASS.

**Commit**: `feat(spacetime): llm_chrome + complete stages with cache + log writes`

**Delegate to**: django-engine-pro

---

### Task 6.3: Cache-hit telemetry refinement

**Files**:
- Modify: `Index-API/apps/notebook/api/spacetime.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_api.py`

**Test first**: append:

```python
class CacheHitLogsToQueryLogTest(TestCase):
    def test_cache_hit_logs_resolver_step_correctly(self):
        from apps.notebook.models import SpacetimeQueryLog
        SpacetimeTopicCache.objects.create(
            canonical_key='topic-x',
            title='Topic X',
            sub='', sources=1, span_min=2000, span_max=2024,
            payload_json={'key': 'topic-x'},
        )
        Client().post(
            '/api/v2/theseus/spacetime/topic/',
            data=json.dumps({'query': 'topic x'}),
            content_type='application/json',
        )
        log = SpacetimeQueryLog.objects.get(canonical_key='topic-x')
        self.assertTrue(log.cache_hit)
        # The resolver returned step='slug' for 'topic-x' -> canonical_key match.
        self.assertEqual(log.resolver_step, 'slug')
        self.assertEqual(log.cluster_count, None)  # no pipeline ran
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.CacheHitLogsToQueryLogTest -v 2
```

Expected: PASS already if Task 2.2 wrote the log row. Failure mode: the existing Task 2.2 code only writes the log when `result.cache is not None`, which is what we want, so this test confirms the existing wiring. If it fails, the cache row write block in `post_topic` was incomplete; re-stamp it.

**Implementation**: none beyond confirming Task 2.2 wired the log row. If the test fails, double-check the `SpacetimeQueryLog.objects.create(...)` call inside `post_topic` and fix.

**Commit**: `test(spacetime): confirm cache hit writes resolver_step to query log`

**Delegate to**: django-engine-pro

---

### Task 6.4: Full seven-stage integration test

**Files**:
- Modify: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: append:

```python
class SevenStageIntegrationTest(TestCase):
    @patch('apps.notebook.unified_retrieval.unified_retrieve')
    @patch('apps.notebook.services.spacetime_pipeline._fetch_object_metadata')
    @patch('apps.notebook.services.spacetime_pipeline._enrich_with_place_mentions')
    @patch('apps.notebook.services.spacetime_clusters._get_infer_function')
    @patch('apps.notebook.speaking_dispatch.call_speaking_service')
    @patch('apps.notebook.services.spacetime_clusters.fetch_note_text')
    @patch('apps.notebook.embedding_service.get_embedding_for_text')
    def test_pipeline_writes_topic_payload_and_cache(
        self, mock_embed, mock_note, mock_call_26b, mock_modal,
        mock_enrich, mock_meta, mock_retrieve,
    ):
        from apps.notebook.models import SpacetimeTopicCache
        # Inputs.
        mock_retrieve.return_value = [
            {'object_pk': i, 'learned_score': 0.5} for i in range(1, 35)
        ]
        mock_meta.return_value = {
            i: {
                'pk': i, 'title': f'Obj {i}',
                'centroid_lat': 48.85, 'centroid_lon': 2.35,
                'year': 1920 + (i % 10),
                'representative_claim_id': None,
            }
            for i in range(1, 35)
        }
        mock_enrich.side_effect = lambda objs: [
            {**o, 'place_mentions': [
                {'place_type': 'city', 'preferred_name': 'Paris'},
            ]}
            for o in objs
        ]
        # Modal returns embedding magnitudes that fall back to .papers
        # ordering after _attention_magnitude reduces them; simpler to
        # disable Modal entirely so we exercise the fallback path.
        mock_modal.return_value = None
        mock_call_26b.return_value = {
            'text': '{"title": "Paris in the 1920s", "sub": "Modernism", "era_band": "modern", "mode": "modern"}',
            'tokens_generated': 32, 'elapsed_seconds': 1.0,
            'stop_reason': 'stop',
        }
        mock_note.return_value = 'a verbatim note from a Claim'
        mock_embed.return_value = [0.1] * 384

        with patch(
            'apps.notebook.services.spacetime_jobs.publish_event'
        ), patch(
            'apps.notebook.services.spacetime_jobs.record_stage'
        ):
            from apps.notebook.services.spacetime_pipeline import run_pipeline
            payload = run_pipeline(
                spacetime_job_id='full-job',
                query='Paris in the 1920s',
                canonical_key='paris-in-the-1920s',
                mode=None,
                force=False,
            )

        # Top-level shape.
        self.assertEqual(payload['key'], 'paris-in-the-1920s')
        self.assertEqual(payload['title'], 'Paris in the 1920s')
        self.assertEqual(payload['mode'], 'modern')
        self.assertGreater(len(payload['events']), 0)
        self.assertLessEqual(len(payload['events']), 12)
        # trace is the cluster ids.
        self.assertEqual(payload['trace'], [c['id'] for c in payload['events']])
        # Notes are the mocked verbatim claim text.
        for c in payload['events']:
            self.assertEqual(c['note'], 'a verbatim note from a Claim')

        # Cache row was written.
        cache = SpacetimeTopicCache.objects.get(canonical_key='paris-in-the-1920s')
        self.assertEqual(cache.title, 'Paris in the 1920s')
        self.assertGreater(len(cache.object_ids), 0)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.SevenStageIntegrationTest -v 2
```

Expected: PASS.

**Implementation**: none beyond Tasks 6.1-6.2.

**Commit**: `test(spacetime): full seven-stage integration with cache write`

**Delegate to**: django-engine-pro

---

## Stage exit criteria

- All 4 tasks marked `[done]`.
- Stage-scoped integration:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_clusters apps.notebook.tests.test_spacetime_pipeline apps.notebook.tests.test_spacetime_api -v 2
```

Expected: every test PASS.

- Pre-push smoke is GREEN:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 -c "import django; django.setup(); from apps.notebook import models, tasks; from apps.notebook.api import spacetime; from apps.notebook.services import spacetime_jobs, spacetime_resolver, spacetime_pipeline, spacetime_clusters"
```

Expected: prints nothing, exits 0.

## Handoff to next stage

After Stage 6 the backend pipeline is complete:
- All seven stages register in `STAGES`: `graph_search`, `web_acquisition`, `engine_pass`, `cluster_bucket`, `gnn_inflection`, `llm_chrome`, `complete`.
- `run_pipeline` returns a real `SpacetimeTopic` payload.
- Cache rows accumulate in `SpacetimeTopicCache` keyed on `canonical_key`.
- Telemetry rows accumulate in `SpacetimeQueryLog`.
- 26B chrome calls go through `call_speaking_service('26b', ...)` with a 5 s budget and a deterministic fallback.
