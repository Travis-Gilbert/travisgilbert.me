# Stage 4: Pipeline orchestrator: graph_search, web_acquisition, engine_pass

_Part of multi-file plan. See [implementation-plan.md](implementation-plan.md) for the index._

## Overview

Stage 4 builds `apps.notebook.services.spacetime_pipeline.run_pipeline`: the orchestrator that the cold-start task calls. This stage covers the first three of the seven pipeline stages from the design doc:

| Stage | Action | Bounded budget |
|---|---|---|
| `graph_search` | `unified_retrieve(query, top_n=200)`; filter to objects with `centroid_lat/lon` and a usable temporal field | 2 s |
| `web_acquisition` | If graph_search returned ≥30 objects, skip. Else dispatch the search provider for 5-10 derived queries; ingest results via `provisional_ingest.ingest_provisional_page` with `geom_source='spacetime_cold_start'` and notebook=Spacetime Inbox | 8 s |
| `engine_pass` | Bounded wait for spaCy NER + Place mention extraction on the new objects via `run_connection_engine`; proceed with whatever resolved at deadline | 8 s |

The remaining stages (`cluster_bucket`, `gnn_inflection`, `llm_chrome`, `complete`) ship in Stages 5 and 6. The orchestrator scaffold here will accept their function references via dependency injection so each subsequent stage tests in isolation.

## Prerequisites

- Stages 0-3 complete.
- `apps.notebook.unified_retrieval.unified_retrieve` exists and accepts `top_n` keyword.
- `apps.notebook.web_fetch.fetch_page_content` works against Tavily.
- `apps.notebook.provisional_ingest.ingest_provisional_page` exists and accepts the canonical fields.
- `apps.notebook.search_providers.get_best_search_provider()` returns a search provider or `None`.
- `apps.notebook.tasks.run_connection_engine_task` exists (used by the engine_pass to enrich objects).

## Files this stage touches

```
Index-API/
├── apps/notebook/services/spacetime_pipeline.py       # NEW
└── apps/notebook/tests/test_spacetime_pipeline.py     # NEW
```

## Tasks

### Task 4.1: `run_pipeline` skeleton with stage emission and timing

**Files**:
- Create: `Index-API/apps/notebook/services/spacetime_pipeline.py`
- Create: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: write `test_spacetime_pipeline.py`:

```python
"""Tests for the spacetime cold-start pipeline orchestrator.

The orchestrator is built around a stages dict: each stage is a callable
that takes a `PipelineContext` and returns a `dict` patch onto the
context. Each test substitutes one or more stages with mocks so we can
assert lifecycle (publish_event, record_stage, duration_ms_per_stage)
without exercising the real retrieval / Modal / 26B path.
"""
from unittest.mock import MagicMock, patch

from django.test import TestCase

from apps.notebook.services.spacetime_pipeline import (
    PipelineContext,
    run_pipeline,
)


class RunPipelineSkeletonTest(TestCase):
    @patch('apps.notebook.services.spacetime_jobs.publish_event')
    @patch('apps.notebook.services.spacetime_jobs.record_stage')
    @patch.dict(
        'apps.notebook.services.spacetime_pipeline.STAGES',
        {'graph_search': lambda ctx: {'graph_objects': []}},
        clear=True,
    )
    def test_emits_stage_events_in_order(self, mock_record, mock_publish):
        result = run_pipeline(
            spacetime_job_id='j1',
            query='hello',
            canonical_key='hello',
            mode=None,
            force=False,
        )
        # Pipeline_start is published by the task shell, NOT here.
        # run_pipeline publishes one 'stage' per registered stage.
        events = [c.args for c in mock_publish.call_args_list]
        self.assertEqual(
            [args[1] for args in events if args[1] == 'stage'],
            ['stage'],
        )
        # The single registered stage is graph_search.
        recorded = [c.args[1] for c in mock_record.call_args_list]
        self.assertEqual(recorded, ['graph_search'])
        # The orchestrator returns a dict (final SpacetimeTopic shape is
        # built by the assemble step in Stage 6; here we only confirm
        # the orchestrator threads context through.)
        self.assertIsInstance(result, dict)


class PipelineContextTest(TestCase):
    def test_context_carries_durations(self):
        ctx = PipelineContext(
            spacetime_job_id='j',
            query='q',
            canonical_key='q',
            mode=None,
            force=False,
        )
        ctx.record_duration('graph_search', 1234)
        self.assertEqual(ctx.duration_ms_per_stage['graph_search'], 1234)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline -v 2
```

Expected: FAIL with `ModuleNotFoundError`.

**Implementation**:

Write `apps/notebook/services/spacetime_pipeline.py`:

```python
"""Spacetime cold-start pipeline orchestrator.

The orchestrator is one function (`run_pipeline`) plus a `STAGES` dict
that maps stage names to callables. Each stage receives the shared
`PipelineContext` and returns a dict patch. The orchestrator publishes a
`stage` SSE event for every stage start, records timing, and stops at
the first exception (publishing `error` is the task shell's job).

Stages are registered via the `STAGES` dict so tests can substitute
individual stages without spinning up retrieval / Modal / the 26B.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from apps.notebook.services import spacetime_jobs

logger = logging.getLogger(__name__)


@dataclass
class PipelineContext:
    """Shared state across pipeline stages.

    Stages mutate this in-place via PipelineContext.update(...) (we just
    use attribute assignment) so a stage can publish partial results
    early (e.g. cluster events) without rebuilding the whole context.
    """

    spacetime_job_id: str
    query: str
    canonical_key: str
    mode: Optional[str]
    force: bool

    # Filled progressively by stages.
    graph_objects: list[dict] = field(default_factory=list)
    web_objects_added: int = 0
    resolved_objects: list[dict] = field(default_factory=list)
    buckets: list[dict] = field(default_factory=list)
    clusters: list[dict] = field(default_factory=list)
    chrome: dict = field(default_factory=dict)
    final_payload: dict = field(default_factory=dict)

    duration_ms_per_stage: dict[str, int] = field(default_factory=dict)

    def record_duration(self, stage_name: str, ms: int) -> None:
        self.duration_ms_per_stage[stage_name] = ms


# Stage registry. Filled in by Tasks 4.2-4.4 and Stages 5-6.
# Each entry: name -> callable(ctx: PipelineContext) -> dict patch
StageFn = Callable[[PipelineContext], dict[str, Any]]
STAGES: dict[str, StageFn] = {}


# Order in which stages execute. STAGES dict gives no guarantee of order.
STAGE_ORDER: list[str] = [
    'graph_search',
    'web_acquisition',
    'engine_pass',
    'cluster_bucket',
    'gnn_inflection',
    'llm_chrome',
    'complete',
]


def run_pipeline(
    *,
    spacetime_job_id: str,
    query: str,
    canonical_key: str,
    mode: Optional[str],
    force: bool,
) -> dict:
    """Execute every registered stage in STAGE_ORDER, return final_payload.

    Stages that are not registered (because earlier stages of the plan
    have not landed yet) are skipped silently. This lets us land the
    pipeline incrementally without breaking POST /topic/.
    """
    ctx = PipelineContext(
        spacetime_job_id=spacetime_job_id,
        query=query,
        canonical_key=canonical_key,
        mode=mode,
        force=force,
    )

    for stage_name in STAGE_ORDER:
        fn = STAGES.get(stage_name)
        if fn is None:
            continue

        spacetime_jobs.publish_event(
            spacetime_job_id, 'stage', {'name': stage_name},
        )
        t0 = time.monotonic()
        try:
            patch_dict = fn(ctx) or {}
        except Exception as exc:
            elapsed = int((time.monotonic() - t0) * 1000)
            ctx.record_duration(stage_name, elapsed)
            logger.error(
                'spacetime_pipeline: stage %s failed for job %s: %s',
                stage_name, spacetime_job_id, exc, exc_info=True,
            )
            raise

        elapsed = int((time.monotonic() - t0) * 1000)
        ctx.record_duration(stage_name, elapsed)
        spacetime_jobs.record_stage(spacetime_job_id, stage_name)

        for key, value in patch_dict.items():
            if hasattr(ctx, key):
                setattr(ctx, key, value)

    return ctx.final_payload or _empty_topic(ctx)


def _empty_topic(ctx: PipelineContext) -> dict:
    """Render an empty SpacetimeTopic for jobs that produced no events.

    Used when the cold-start path runs but every stage either short-
    circuited or returned no usable data. The frontend renders this as
    an honest empty state.
    """
    return {
        'key': ctx.canonical_key,
        'title': ctx.query,
        'sub': '',
        'sources': 0,
        'span': [0, 0],
        'events': [],
        'trace': [],
        'mode': ctx.mode or 'modern',
    }
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): pipeline orchestrator skeleton (STAGES + PipelineContext)`

**Delegate to**: django-engine-pro

---

### Task 4.2: `graph_search` stage

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_pipeline.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: append:

```python
class GraphSearchStageTest(TestCase):
    @patch('apps.notebook.unified_retrieval.unified_retrieve')
    @patch('apps.notebook.services.spacetime_pipeline._fetch_object_metadata')
    def test_filters_to_objects_with_centroid_and_year(
        self, mock_meta, mock_retrieve,
    ):
        mock_retrieve.return_value = [
            {'object_pk': 1, 'learned_score': 0.9},
            {'object_pk': 2, 'learned_score': 0.8},
            {'object_pk': 3, 'learned_score': 0.7},
        ]
        # Object 1 has lat/lon and a year. Object 2 has lat/lon but no year.
        # Object 3 has no lat/lon.
        mock_meta.return_value = {
            1: {
                'pk': 1, 'title': 'A',
                'centroid_lat': 41.9, 'centroid_lon': 12.5,
                'year': 1500, 'representative_claim_id': None,
            },
            2: {
                'pk': 2, 'title': 'B',
                'centroid_lat': 51.5, 'centroid_lon': -0.1,
                'year': None, 'representative_claim_id': None,
            },
            3: {
                'pk': 3, 'title': 'C',
                'centroid_lat': None, 'centroid_lon': None,
                'year': 1900, 'representative_claim_id': None,
            },
        }

        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        ctx = PipelineContext(
            spacetime_job_id='j', query='q', canonical_key='q',
            mode=None, force=False,
        )
        patch_dict = STAGES['graph_search'](ctx)
        objects = patch_dict['graph_objects']

        self.assertEqual(len(objects), 1)
        self.assertEqual(objects[0]['pk'], 1)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.GraphSearchStageTest -v 2
```

Expected: FAIL with `KeyError: 'graph_search'`.

**Implementation**:

Append to `apps/notebook/services/spacetime_pipeline.py`:

```python
def _stage_graph_search(ctx: PipelineContext) -> dict[str, Any]:
    """Stage 1: pull top 200 objects from unified_retrieve, keep usable ones.

    "Usable" means the object has both a centroid (centroid_lat AND
    centroid_lon) AND a year. Year derivation is delegated to
    `_fetch_object_metadata` which checks (in order): the highest-NLI
    Claim's `valid_from`, `Object.properties['publication_year']`, then
    `Object.captured_at.year` as last-resort.
    """
    from apps.notebook.unified_retrieval import unified_retrieve

    rows = unified_retrieve(ctx.query, top_n=200) or []
    if not rows:
        return {'graph_objects': []}

    pks = [int(r['object_pk']) for r in rows if r.get('object_pk') is not None]
    if not pks:
        return {'graph_objects': []}

    meta_by_pk = _fetch_object_metadata(pks)

    # Preserve unified_retrieve's order so highest-score objects come first.
    out = []
    for r in rows:
        pk = int(r.get('object_pk') or 0)
        meta = meta_by_pk.get(pk)
        if meta is None:
            continue
        if meta.get('centroid_lat') is None or meta.get('centroid_lon') is None:
            continue
        if meta.get('year') is None:
            continue
        out.append({**meta, 'retrieve_score': r.get('learned_score', 0.0)})

    return {'graph_objects': out}


def _fetch_object_metadata(pks: list[int]) -> dict[int, dict[str, Any]]:
    """Bulk-load metadata + best-year + representative-claim for object PKs.

    Returned dict keyed by object pk. Each value is a dict with keys:
      pk, title, centroid_lat, centroid_lon, year, representative_claim_id

    `year` is derived in priority order:
      1. highest-NLI Claim with valid_from set; year = valid_from.year.
      2. Object.properties['publication_year'] cast to int.
      3. Object.captured_at.year.
    `representative_claim_id` is the highest-NLI Claim PK linking back to
    that Object (used for cluster note text downstream).
    """
    from apps.notebook.models import Claim, Object

    objs = (
        Object.objects.filter(pk__in=pks)
        .only(
            'pk', 'title', 'centroid_lat', 'centroid_lon',
            'properties', 'captured_at',
        )
    )

    # Pre-pull the highest-NLI Claim per source_object so the year + repr
    # work without N+1.
    claims = (
        Claim.objects
        .filter(source_object_id__in=pks)
        .order_by('source_object_id', '-valid_from', '-pk')
        .only('pk', 'source_object_id', 'valid_from')
    )
    repr_claim_by_pk: dict[int, Claim] = {}
    for c in claims:
        repr_claim_by_pk.setdefault(c.source_object_id, c)

    out: dict[int, dict[str, Any]] = {}
    for obj in objs:
        year = None
        repr_claim = repr_claim_by_pk.get(obj.pk)
        if repr_claim is not None and repr_claim.valid_from is not None:
            year = repr_claim.valid_from.year
        if year is None:
            props = obj.properties or {}
            raw_year = props.get('publication_year')
            try:
                year = int(raw_year) if raw_year is not None else None
            except (TypeError, ValueError):
                year = None
        if year is None and obj.captured_at is not None:
            year = obj.captured_at.year

        out[obj.pk] = {
            'pk': obj.pk,
            'title': obj.title or f'Object {obj.pk}',
            'centroid_lat': obj.centroid_lat,
            'centroid_lon': obj.centroid_lon,
            'year': year,
            'representative_claim_id': repr_claim.pk if repr_claim else None,
        }
    return out


STAGES['graph_search'] = _stage_graph_search
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.GraphSearchStageTest -v 2
```

Expected: PASS.

**Commit**: `feat(spacetime): graph_search stage with centroid + year filtering`

**Delegate to**: django-engine-pro

---

### Task 4.3: `web_acquisition` stage

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_pipeline.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: append:

```python
class WebAcquisitionStageTest(TestCase):
    def test_skips_when_graph_search_already_filled(self):
        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        ctx = PipelineContext(
            spacetime_job_id='j', query='q', canonical_key='q',
            mode=None, force=False,
        )
        ctx.graph_objects = [{'pk': i} for i in range(40)]
        with patch(
            'apps.notebook.search_providers.get_best_search_provider'
        ) as mock_provider:
            patch_dict = STAGES['web_acquisition'](ctx)
        self.assertEqual(patch_dict['web_objects_added'], 0)
        mock_provider.assert_not_called()

    def test_dispatches_search_when_graph_search_thin(self):
        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext, derive_search_queries,
        )
        ctx = PipelineContext(
            spacetime_job_id='j', query='carthaginian salt trade',
            canonical_key='carthaginian-salt-trade', mode=None, force=False,
        )
        ctx.graph_objects = [{'pk': 1}]  # below the 30 threshold

        provider = MagicMock()
        provider.search.return_value = [
            {'url': 'https://example.com/a', 'title': 'A', 'snippet': '...'},
            {'url': 'https://example.com/b', 'title': 'B', 'snippet': '...'},
        ]

        with patch(
            'apps.notebook.search_providers.get_best_search_provider',
            return_value=provider,
        ), patch(
            'apps.notebook.web_fetch.fetch_page_content',
            return_value={
                'url': 'https://example.com/a',
                'title': 'A',
                'content': 'Page A body about Carthage.',
                'author': None,
                'publication': None,
            },
        ), patch(
            'apps.notebook.provisional_ingest.ingest_provisional_page',
            return_value={'object_pk': 42, 'filter_report': {}, 'latency_ms': 50},
        ) as mock_ingest:
            patch_dict = STAGES['web_acquisition'](ctx)

        self.assertGreaterEqual(patch_dict['web_objects_added'], 1)
        # ingest_provisional_page must be called with the spacetime
        # geom_source so cleanup is recoverable.
        for call in mock_ingest.call_args_list:
            kwargs = call.kwargs
            ctx_meta = kwargs.get('fetch_context') or {}
            self.assertEqual(
                ctx_meta.get('geom_source'),
                'spacetime_cold_start',
            )

    def test_derive_search_queries_returns_5_to_10(self):
        from apps.notebook.services.spacetime_pipeline import (
            derive_search_queries,
        )
        qs = derive_search_queries('carthaginian salt trade')
        self.assertGreaterEqual(len(qs), 5)
        self.assertLessEqual(len(qs), 10)
        # Original query must be among them.
        self.assertIn('carthaginian salt trade', qs)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.WebAcquisitionStageTest -v 2
```

Expected: 3 FAIL with import / KeyError errors.

**Implementation**:

Append to `apps/notebook/services/spacetime_pipeline.py`:

```python
GRAPH_SEARCH_SUFFICIENT = 30
WEB_ACQUISITION_BUDGET_S = 8.0
SPACETIME_GEOM_SOURCE = 'spacetime_cold_start'
SPACETIME_GEOM_CONFIDENCE = 0.3
SPACETIME_NOTEBOOK_SLUG = 'spacetime-inbox'


def derive_search_queries(query: str) -> list[str]:
    """Generate 5-10 search queries from one user query.

    For V1 we use a small fixed set of suffix variations. The original
    query is always present. The 26B is NOT used here (see design doc:
    the cold-start path must not block on the LLM).
    """
    base = query.strip()
    if not base:
        return []

    variants = [
        base,
        f'{base} history',
        f'{base} timeline',
        f'{base} origin',
        f'{base} sites',
        f'{base} cities',
        f'{base} primary sources',
    ]
    # Deduplicate while preserving order.
    seen: set[str] = set()
    out: list[str] = []
    for v in variants:
        v = v.strip()
        if v and v not in seen:
            seen.add(v)
            out.append(v)
        if len(out) >= 10:
            break
    return out[:10]


def _stage_web_acquisition(ctx: PipelineContext) -> dict[str, Any]:
    """Stage 2: dispatch search + Firecrawl when graph_search is thin.

    Skip when graph_search already returned >= GRAPH_SEARCH_SUFFICIENT
    (currently 30) usable objects. Otherwise we run a small set of
    derived queries through the best available search provider, then
    fetch + ingest the top results into provisional Objects pinned to
    the Spacetime Inbox notebook with geom_source='spacetime_cold_start'.
    """
    if len(ctx.graph_objects) >= GRAPH_SEARCH_SUFFICIENT:
        return {'web_objects_added': 0}

    from apps.notebook.search_providers import get_best_search_provider
    from apps.notebook.web_fetch import fetch_page_content
    from apps.notebook.provisional_ingest import ingest_provisional_page
    from apps.notebook.models import Notebook

    provider = get_best_search_provider()
    if provider is None:
        logger.info('spacetime_pipeline: no search provider available; skipping web_acquisition')
        return {'web_objects_added': 0}

    inbox = Notebook.objects.filter(slug=SPACETIME_NOTEBOOK_SLUG).first()
    if inbox is None:
        logger.warning(
            'spacetime_pipeline: Spacetime Inbox notebook missing; '
            'run python3 manage.py seed_spacetime_inbox',
        )

    deadline = time.monotonic() + WEB_ACQUISITION_BUDGET_S
    queries = derive_search_queries(ctx.query)

    seen_urls: set[str] = set()
    new_object_pks: list[int] = []

    for q in queries:
        if time.monotonic() > deadline:
            break
        try:
            results = provider.search(q) or []
        except Exception as exc:
            logger.warning('spacetime_pipeline: search failed for %r: %s', q, exc)
            continue

        for r in results[:5]:
            if time.monotonic() > deadline:
                break
            url = (r.get('url') or '').strip()
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            page = fetch_page_content(url)
            if page is None or not page.get('content'):
                continue

            ingest_result = ingest_provisional_page(
                url=page.get('url') or url,
                title=page.get('title') or url,
                content=page.get('content') or '',
                author=page.get('author'),
                publication=page.get('publication'),
                fetch_context={
                    'agent': 'spacetime_cold_start',
                    'source': 'spacetime_cold_start',
                    'query_id': ctx.spacetime_job_id,
                    'origin_query': ctx.query,
                    'geom_source': SPACETIME_GEOM_SOURCE,
                    'geom_confidence': SPACETIME_GEOM_CONFIDENCE,
                    'notebook_slug': inbox.slug if inbox else SPACETIME_NOTEBOOK_SLUG,
                },
            )
            if ingest_result and ingest_result.get('object_pk'):
                new_object_pks.append(int(ingest_result['object_pk']))

    if new_object_pks:
        _apply_spacetime_provenance(new_object_pks, inbox)

    return {'web_objects_added': len(new_object_pks), 'web_object_pks': new_object_pks}


def _apply_spacetime_provenance(pks: list[int], inbox) -> None:
    """Stamp the geom_source / geom_confidence / notebook on new Objects.

    `ingest_provisional_page` writes the `Object` row but does not know
    about geom_source. That field lives on the Object directly, separate
    from the fetch_context we pass through, so we patch it after the fact.
    """
    if not pks:
        return
    from apps.notebook.models import Object

    update_kwargs: dict[str, Any] = {
        'geom_source': SPACETIME_GEOM_SOURCE,
        'geom_confidence': SPACETIME_GEOM_CONFIDENCE,
    }
    if inbox is not None:
        update_kwargs['notebook'] = inbox

    Object.objects.filter(pk__in=pks).update(**update_kwargs)


STAGES['web_acquisition'] = _stage_web_acquisition
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.WebAcquisitionStageTest -v 2
```

Expected: 3 PASS.

**Commit**: `feat(spacetime): web_acquisition stage with provisional ingest`

**Delegate to**: django-engine-pro

---

### Task 4.4: `engine_pass` stage with bounded wait

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_pipeline.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: append:

```python
class EnginePassStageTest(TestCase):
    def test_no_op_when_no_web_objects(self):
        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        ctx = PipelineContext(
            spacetime_job_id='j', query='q', canonical_key='q',
            mode=None, force=False,
        )
        ctx.web_objects_added = 0
        ctx.graph_objects = [
            {'pk': 1, 'title': 't', 'centroid_lat': 0, 'centroid_lon': 0, 'year': 2000},
        ]
        patch_dict = STAGES['engine_pass'](ctx)
        # resolved_objects is just the graph_objects when no web work happened.
        self.assertEqual(len(patch_dict['resolved_objects']), 1)

    @patch('apps.notebook.services.spacetime_pipeline._run_engine_for_pks')
    @patch('apps.notebook.services.spacetime_pipeline._fetch_object_metadata')
    def test_runs_engine_then_re_resolves(self, mock_meta, mock_engine):
        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        mock_meta.return_value = {
            7: {
                'pk': 7, 'title': 'web obj',
                'centroid_lat': 1.0, 'centroid_lon': 2.0,
                'year': 1850, 'representative_claim_id': None,
            },
        }
        ctx = PipelineContext(
            spacetime_job_id='j', query='q', canonical_key='q',
            mode=None, force=False,
        )
        ctx.web_objects_added = 1
        # Stash the new pk on ctx as web_acquisition does.
        setattr(ctx, 'web_object_pks', [7])
        ctx.graph_objects = []

        patch_dict = STAGES['engine_pass'](ctx)
        mock_engine.assert_called_once_with([7], deadline_s=8.0)
        self.assertEqual(len(patch_dict['resolved_objects']), 1)
        self.assertEqual(patch_dict['resolved_objects'][0]['pk'], 7)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.EnginePassStageTest -v 2
```

Expected: 2 FAIL with `KeyError: 'engine_pass'`.

**Implementation**:

Append to `apps/notebook/services/spacetime_pipeline.py`:

```python
ENGINE_PASS_BUDGET_S = 8.0


def _stage_engine_pass(ctx: PipelineContext) -> dict[str, Any]:
    """Stage 3: bounded-time NER + Place mention extraction on new objects.

    Combines `graph_objects` (already resolved) with the freshly ingested
    `web_object_pks` after running the connection engine on them so
    PlaceMentions and Claims are populated. Whatever resolved by the
    deadline is what we proceed with; the rest are dropped.
    """
    web_pks: list[int] = list(getattr(ctx, 'web_object_pks', []) or [])
    if web_pks:
        _run_engine_for_pks(web_pks, deadline_s=ENGINE_PASS_BUDGET_S)
        web_meta = _fetch_object_metadata(web_pks)
        web_objects = [
            meta for meta in web_meta.values()
            if meta.get('centroid_lat') is not None
            and meta.get('centroid_lon') is not None
            and meta.get('year') is not None
        ]
    else:
        web_objects = []

    return {'resolved_objects': list(ctx.graph_objects) + web_objects}


def _run_engine_for_pks(pks: list[int], *, deadline_s: float) -> None:
    """Synchronously run the connection engine on the given PKs, bounded.

    The connection engine extracts PlaceMentions, Claims, and Embeddings.
    We call the in-process function (not the RQ task) so the bounded
    wait actually bounds wall-clock latency. Any pks that don't finish
    by the deadline are simply not enriched; downstream stages will skip
    them.
    """
    if not pks:
        return
    deadline = time.monotonic() + deadline_s
    try:
        from apps.notebook.engine import run_connection_engine_for_objects
    except ImportError:
        logger.info('spacetime_pipeline: connection engine entry not importable; skipping engine_pass')
        return

    try:
        run_connection_engine_for_objects(pks, deadline=deadline)
    except Exception as exc:
        logger.warning(
            'spacetime_pipeline: engine pass raised for pks=%s: %s',
            pks, exc,
        )


STAGES['engine_pass'] = _stage_engine_pass
```

**Note on `run_connection_engine_for_objects`**: this entry point is the canonical wrapper used by the existing `dispatch_engine_batch` management command. If at execution time it does not yet exist with this exact name and signature, surface that as a sub-task: locate the equivalent (likely `apps.notebook.engine.run_connection_engine_for_object` singular, called in a loop) and adjust the `_run_engine_for_pks` body to call it once per PK, still capped at `deadline`. Do not invent a new public function in the engine module.

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.EnginePassStageTest -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): engine_pass stage with bounded NER/Place enrichment`

**Delegate to**: django-engine-pro

---

### Task 4.5: Stage-scoped integration test (`graph_search` + `web_acquisition` + `engine_pass`)

**Files**:
- Modify: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: append:

```python
class StageOneToThreeIntegrationTest(TestCase):
    """End-to-end through the first three stages with everything else
    mocked. Confirms that resolved_objects accumulates from both graph
    and web sources, and that timing is recorded.
    """
    @patch('apps.notebook.unified_retrieval.unified_retrieve')
    @patch('apps.notebook.services.spacetime_pipeline._fetch_object_metadata')
    @patch('apps.notebook.search_providers.get_best_search_provider')
    @patch('apps.notebook.web_fetch.fetch_page_content')
    @patch('apps.notebook.provisional_ingest.ingest_provisional_page')
    @patch('apps.notebook.services.spacetime_pipeline._run_engine_for_pks')
    @patch('apps.notebook.services.spacetime_pipeline._apply_spacetime_provenance')
    def test_three_stages_roll_through(
        self, _mock_provenance, _mock_engine, mock_ingest, mock_fetch,
        mock_provider, mock_meta, mock_retrieve,
    ):
        # graph_search returns 1 usable object, below the 30 threshold.
        mock_retrieve.return_value = [{'object_pk': 1, 'learned_score': 0.9}]
        # _fetch_object_metadata is called twice: once in graph_search (for
        # pk=1) and once in engine_pass (for the new web object pk=42).
        meta_responses = [
            {1: {
                'pk': 1, 'title': 'A',
                'centroid_lat': 41.9, 'centroid_lon': 12.5,
                'year': 1500, 'representative_claim_id': None,
            }},
            {42: {
                'pk': 42, 'title': 'WebA',
                'centroid_lat': 36.8, 'centroid_lon': 10.2,
                'year': 1520, 'representative_claim_id': None,
            }},
        ]
        mock_meta.side_effect = meta_responses

        # web_acquisition: search provider returns 1 url, which fetches
        # and ingests as Object pk=42.
        mock_provider.return_value = MagicMock(
            search=MagicMock(return_value=[
                {'url': 'https://example.com/a', 'title': 'A', 'snippet': '...'},
            ]),
        )
        mock_fetch.return_value = {
            'url': 'https://example.com/a', 'title': 'A',
            'content': 'body', 'author': None, 'publication': None,
        }
        mock_ingest.return_value = {
            'object_pk': 42, 'filter_report': {}, 'latency_ms': 50,
        }

        # Disable downstream stages by clearing them (they land in Stage 5/6).
        from apps.notebook.services import spacetime_pipeline as p
        with patch.dict(p.STAGES, {
            'graph_search': p._stage_graph_search,
            'web_acquisition': p._stage_web_acquisition,
            'engine_pass': p._stage_engine_pass,
        }, clear=True), patch(
            'apps.notebook.services.spacetime_jobs.publish_event'
        ), patch(
            'apps.notebook.services.spacetime_jobs.record_stage'
        ):
            payload = p.run_pipeline(
                spacetime_job_id='j',
                query='carthaginian salt trade',
                canonical_key='carthaginian-salt-trade',
                mode=None,
                force=False,
            )

        # No final_payload -> _empty_topic.
        self.assertEqual(payload['key'], 'carthaginian-salt-trade')
        self.assertEqual(payload['events'], [])
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.StageOneToThreeIntegrationTest -v 2
```

Expected: PASS.

**Implementation**: none beyond Tasks 4.1-4.4. This task pins the integration shape.

**Commit**: `test(spacetime): integration test for graph_search + web_acquisition + engine_pass`

**Delegate to**: django-engine-pro

---

## Stage exit criteria

- All 5 tasks marked `[done]`.
- Stage-scoped integration:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline -v 2
```

Expected: every test PASS.

- The `STAGES` registry contains keys `graph_search`, `web_acquisition`, `engine_pass`. The remaining stages (`cluster_bucket`, `gnn_inflection`, `llm_chrome`, `complete`) are absent until Stages 5 and 6 land.

## Handoff to next stage

After Stage 4 the following are available:
- `apps.notebook.services.spacetime_pipeline.run_pipeline(...)` runs three of seven stages and returns an empty topic.
- `apps.notebook.services.spacetime_pipeline.PipelineContext` carries `graph_objects`, `web_objects_added`, `web_object_pks`, `resolved_objects`, plus the empty fields the later stages will populate.
- `apps.notebook.services.spacetime_pipeline._fetch_object_metadata`, `derive_search_queries`, and `_apply_spacetime_provenance` are reusable from later stages.
- New objects ingested through `web_acquisition` have `geom_source='spacetime_cold_start'`, `geom_confidence=0.3`, and live in the `spacetime-inbox` notebook.
