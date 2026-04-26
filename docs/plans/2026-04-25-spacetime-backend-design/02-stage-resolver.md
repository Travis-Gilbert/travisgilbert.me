# Stage 1: Resolver ladder (5 steps, <50ms)

_Part of multi-file plan. See [implementation-plan.md](implementation-plan.md) for the index._

## Overview

Stage 1 implements `resolve_topic_query(query)`: the deterministic, sub-50ms function that runs inside the request handler before deciding "cache hit" vs "cold-start". The ladder has five rungs and short-circuits on the first match:

1. Slug exact match: `slugify(query)` == `SpacetimeTopicCache.canonical_key`.
2. Title case-insensitive match: `query.lower()` == `title.lower()`.
3. Substring overlap: slug contains query OR query contains slug.
4. SBERT cosine: top result with similarity ≥ 0.7 against `title_embedding`.
5. Fallback: return `(canonical_key=slugify(query), step='cold_start', cache=None)`.

The 26B is explicitly NOT used here: it is too slow.

## Prerequisites

- Stage 0 complete. `SpacetimeTopicCache` exists and is migrated.
- Required state at entry: empty `SpacetimeTopicCache` table (or any state, but the tests will populate fixtures).

## Files this stage touches

```
Index-API/
├── apps/notebook/services/spacetime_resolver.py     # NEW
└── apps/notebook/tests/test_spacetime_resolver.py   # NEW
```

## Tasks

### Task 1.1: Define `ResolverResult` and stub `resolve_topic_query`

**Files**:
- Create: `Index-API/apps/notebook/services/spacetime_resolver.py`

**Test first**: write the test file:

```python
"""Tests for spacetime_resolver: deterministic 5-step ladder.

Each test fixture seeds the bare minimum SpacetimeTopicCache rows the
ladder needs to short-circuit on a specific rung. The SBERT step is
patched in test_resolver_step4_sbert because we don't want the test
suite to load 90MB of MiniLM weights on every CI run.
"""
from unittest.mock import patch

from django.test import TestCase

from apps.notebook.models import SpacetimeTopicCache
from apps.notebook.services.spacetime_resolver import (
    ResolverResult,
    resolve_topic_query,
)


def _make_cache(canonical_key: str, title: str, **kwargs) -> SpacetimeTopicCache:
    defaults = {
        'sub': 'test sub',
        'sources': 1,
        'span_min': 1900,
        'span_max': 2000,
        'payload_json': {'key': canonical_key, 'title': title},
    }
    defaults.update(kwargs)
    return SpacetimeTopicCache.objects.create(
        canonical_key=canonical_key,
        title=title,
        **defaults,
    )


class ResolverShellTest(TestCase):
    def test_returns_resolver_result_dataclass(self):
        result = resolve_topic_query('something nobody has searched yet')
        self.assertIsInstance(result, ResolverResult)
        self.assertEqual(result.step, 'cold_start')
        self.assertIsNone(result.cache)
        self.assertTrue(result.canonical_key)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_resolver.ResolverShellTest -v 2
```

Expected: FAIL with `ModuleNotFoundError: No module named 'apps.notebook.services.spacetime_resolver'`.

**Implementation**:

Write `apps/notebook/services/spacetime_resolver.py`:

```python
"""Spacetime topic resolver: deterministic 5-step ladder, <50ms target.

Called from the POST /api/v2/theseus/spacetime/topic/ view before the
cold-start branch. The ladder collapses any user-typed query onto a
single canonical_key and either returns a cached SpacetimeTopicCache
row or signals that a cold-start is needed.

The 26B LLM is explicitly NOT in this path. Steps 1-3 are SQL string
ops, step 4 is one pgvector cosine-distance query, step 5 is a slug
generation. Total budget: 50ms.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from django.utils.text import slugify

from apps.notebook.models import SpacetimeTopicCache


@dataclass
class ResolverResult:
    """Outcome of resolve_topic_query.

    canonical_key: slug used as the cache key going forward.
    step: which rung of the ladder fired (one of slug/title/substring/
        sbert/cold_start).
    cache: the matching cache row when step != 'cold_start', else None.
    """

    canonical_key: str
    step: str
    cache: Optional[SpacetimeTopicCache] = None


SBERT_COSINE_THRESHOLD = 0.7


def resolve_topic_query(query: str) -> ResolverResult:
    """Run the 5-step ladder and return the first match.

    `query` is the raw user-typed string. The ladder runs in order:

      1. Exact slug match on canonical_key.
      2. Case-insensitive exact title match.
      3. Substring containment (slug ⊆ q OR q ⊆ slug).
      4. SBERT cosine similarity against title_embedding (>= 0.7).
      5. None of the above: return cold_start with the slugified key.
    """
    raise NotImplementedError(
        'spacetime_resolver: implement steps 1-5 in subsequent tasks.'
    )
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_resolver.ResolverShellTest -v 2
```

Expected: still FAIL, but now with `NotImplementedError`. The next task wires step 5 (the cold-start fallback) so the shell test passes.

**Commit**: `feat(spacetime): resolver shell with ResolverResult dataclass`

**Delegate to**: django-engine-pro

---

### Task 1.2: Implement steps 1-3 plus cold-start fallback (no SBERT yet)

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_resolver.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_resolver.py`

**Test first**: append four test classes to `test_spacetime_resolver.py`:

```python
class ResolverStep1SlugTest(TestCase):
    def test_exact_slug_match_returns_cache(self):
        row = _make_cache('sickle-cell-anemia', 'Sickle cell anemia')
        result = resolve_topic_query('Sickle Cell Anemia')
        self.assertEqual(result.step, 'slug')
        self.assertEqual(result.canonical_key, 'sickle-cell-anemia')
        self.assertEqual(result.cache.pk, row.pk)


class ResolverStep2TitleTest(TestCase):
    def test_case_insensitive_title_match(self):
        row = _make_cache('mock-key', 'Carthaginian Salt Trade')
        # The query slugify'd is "carthaginian-salt-trade" which is NOT
        # the same as "mock-key", so step 1 misses. Step 2 catches it on
        # the title compare.
        result = resolve_topic_query('carthaginian salt trade')
        self.assertEqual(result.step, 'title')
        self.assertEqual(result.cache.pk, row.pk)


class ResolverStep3SubstringTest(TestCase):
    def test_query_slug_contains_canonical_key(self):
        row = _make_cache('flight', 'Flight')
        result = resolve_topic_query('history of flight in europe')
        self.assertEqual(result.step, 'substring')
        self.assertEqual(result.cache.pk, row.pk)

    def test_canonical_key_contains_query_slug(self):
        row = _make_cache('history-of-flight-in-europe', 'History of Flight in Europe')
        result = resolve_topic_query('flight')
        self.assertEqual(result.step, 'substring')
        self.assertEqual(result.cache.pk, row.pk)


class ResolverStep5ColdStartTest(TestCase):
    def test_unknown_query_falls_through_to_cold_start(self):
        result = resolve_topic_query('something nobody has searched yet')
        self.assertEqual(result.step, 'cold_start')
        self.assertEqual(result.canonical_key, 'something-nobody-has-searched-yet')
        self.assertIsNone(result.cache)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_resolver -v 2
```

Expected: 5 FAIL with `NotImplementedError`.

**Implementation**:

Replace the `NotImplementedError` body with the steps-1-3-and-5 implementation:

```python
def resolve_topic_query(query: str) -> ResolverResult:
    """Run the 5-step ladder and return the first match.

    See module docstring for the rung-by-rung contract.
    """
    if not query or not query.strip():
        return ResolverResult(canonical_key='', step='cold_start', cache=None)

    query_slug = slugify(query)
    query_lower = query.strip().lower()

    # Step 1: exact slug match on canonical_key.
    if query_slug:
        slug_hit = (
            SpacetimeTopicCache.objects
            .filter(canonical_key=query_slug)
            .first()
        )
        if slug_hit is not None:
            return ResolverResult(
                canonical_key=slug_hit.canonical_key,
                step='slug',
                cache=slug_hit,
            )

    # Step 2: case-insensitive exact title match. iexact is collation-aware
    # in PostgreSQL but we rely on Django's portable LOWER() comparison.
    title_hit = (
        SpacetimeTopicCache.objects
        .filter(title__iexact=query_lower)
        .order_by('-last_baked_at')
        .first()
    )
    if title_hit is not None:
        return ResolverResult(
            canonical_key=title_hit.canonical_key,
            step='title',
            cache=title_hit,
        )

    # Step 3: substring overlap in either direction. This is a small table
    # so two icontains scans are cheap; we cap at the first match by
    # ordering on -last_baked_at so the most recent bake wins ties.
    if query_slug:
        contains_hit = (
            SpacetimeTopicCache.objects
            .filter(canonical_key__icontains=query_slug)
            .order_by('-last_baked_at')
            .first()
        )
        if contains_hit is not None:
            return ResolverResult(
                canonical_key=contains_hit.canonical_key,
                step='substring',
                cache=contains_hit,
            )

        for candidate in (
            SpacetimeTopicCache.objects
            .all()
            .order_by('-last_baked_at')
        ):
            if candidate.canonical_key and candidate.canonical_key in query_slug:
                return ResolverResult(
                    canonical_key=candidate.canonical_key,
                    step='substring',
                    cache=candidate,
                )

    # Step 4 (SBERT) is filled in by Task 1.3.

    # Step 5: cold-start fallback. Slugify the query so the cold-start
    # pipeline can write back to a stable canonical_key.
    return ResolverResult(
        canonical_key=query_slug or slugify(query_lower),
        step='cold_start',
        cache=None,
    )
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_resolver -v 2
```

Expected: 5 PASS, 0 FAIL.

**Commit**: `feat(spacetime): resolver steps 1-3 plus cold-start fallback`

**Delegate to**: django-engine-pro

---

### Task 1.3: Step 4 SBERT cosine fallback (≥0.7)

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_resolver.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_resolver.py`

**Test first**: append two test classes to `test_spacetime_resolver.py`:

```python
class ResolverStep4SbertTest(TestCase):
    @patch('apps.notebook.services.spacetime_resolver.embed_query_for_resolver')
    def test_sbert_match_above_threshold(self, mock_embed):
        # Build a topic whose stored title_embedding is close to the
        # query embedding under cosine similarity. We patch both the
        # query embed and write a fixed vector on the row.
        vec = [0.1] * 384
        mock_embed.return_value = vec
        row = _make_cache(
            'cardiac-stents',
            'Cardiac Stents',
            title_embedding=vec,
        )
        result = resolve_topic_query('drug-eluting heart implants')
        self.assertEqual(result.step, 'sbert')
        self.assertEqual(result.cache.pk, row.pk)

    @patch('apps.notebook.services.spacetime_resolver.embed_query_for_resolver')
    def test_sbert_below_threshold_falls_through(self, mock_embed):
        # Query embedding is orthogonal to all stored vectors -> cosine
        # ~ 0 -> below 0.7 threshold -> ladder falls to cold_start.
        mock_embed.return_value = [1.0] + [0.0] * 383
        _make_cache(
            'cardiac-stents',
            'Cardiac Stents',
            title_embedding=[0.0, 1.0] + [0.0] * 382,
        )
        result = resolve_topic_query('something orthogonal')
        self.assertEqual(result.step, 'cold_start')

    @patch('apps.notebook.services.spacetime_resolver.embed_query_for_resolver')
    def test_sbert_skipped_when_embed_returns_none(self, mock_embed):
        mock_embed.return_value = None
        result = resolve_topic_query('any query')
        self.assertEqual(result.step, 'cold_start')


class ResolverEmbedHelperTest(TestCase):
    def test_embed_query_for_resolver_handles_failure(self):
        # If the embedding service is broken, the helper must return None
        # rather than raise. Step 4 then degrades to cold_start cleanly.
        from apps.notebook.services.spacetime_resolver import (
            embed_query_for_resolver,
        )
        with patch(
            'apps.notebook.embedding_service.get_embedding_for_text',
            side_effect=RuntimeError('embedding service down'),
        ):
            self.assertIsNone(embed_query_for_resolver('hello'))
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_resolver.ResolverStep4SbertTest apps.notebook.tests.test_spacetime_resolver.ResolverEmbedHelperTest -v 2
```

Expected: 4 FAIL (one with `AttributeError: ... embed_query_for_resolver`, others with cosine-step-missing).

**Implementation**:

Edit `apps/notebook/services/spacetime_resolver.py` to (a) add `embed_query_for_resolver` near the top, (b) insert step 4 between step 3 and step 5 in `resolve_topic_query`. Replace the file in full:

```python
"""Spacetime topic resolver: deterministic 5-step ladder, <50ms target.

See module docstring above for rationale.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from django.utils.text import slugify
from pgvector.django import CosineDistance

from apps.notebook.models import SpacetimeTopicCache

logger = logging.getLogger(__name__)


@dataclass
class ResolverResult:
    canonical_key: str
    step: str
    cache: Optional[SpacetimeTopicCache] = None


SBERT_COSINE_THRESHOLD = 0.7
SBERT_COSINE_DISTANCE_CUTOFF = 1.0 - SBERT_COSINE_THRESHOLD  # pgvector returns distance


def embed_query_for_resolver(query: str) -> Optional[list[float]]:
    """Embed a query string for the resolver step-4 fallback.

    Returns None on any failure so the resolver can degrade cleanly to
    cold_start. Reuses the shared embedding service so the same SBERT
    encoder used for Object embeddings is used here.
    """
    if not query:
        return None
    try:
        from apps.notebook.embedding_service import get_embedding_for_text
        vec = get_embedding_for_text(query)
        if vec is None:
            return None
        return list(vec)
    except Exception as exc:
        logger.warning('spacetime_resolver: embed_query_for_resolver failed: %s', exc)
        return None


def resolve_topic_query(query: str) -> ResolverResult:
    """Run the 5-step ladder and return the first match."""
    if not query or not query.strip():
        return ResolverResult(canonical_key='', step='cold_start', cache=None)

    query_slug = slugify(query)
    query_lower = query.strip().lower()

    # Step 1: exact slug match.
    if query_slug:
        slug_hit = (
            SpacetimeTopicCache.objects
            .filter(canonical_key=query_slug)
            .first()
        )
        if slug_hit is not None:
            return ResolverResult(slug_hit.canonical_key, 'slug', slug_hit)

    # Step 2: case-insensitive exact title.
    title_hit = (
        SpacetimeTopicCache.objects
        .filter(title__iexact=query_lower)
        .order_by('-last_baked_at')
        .first()
    )
    if title_hit is not None:
        return ResolverResult(title_hit.canonical_key, 'title', title_hit)

    # Step 3: substring overlap, both directions.
    if query_slug:
        contains_hit = (
            SpacetimeTopicCache.objects
            .filter(canonical_key__icontains=query_slug)
            .order_by('-last_baked_at')
            .first()
        )
        if contains_hit is not None:
            return ResolverResult(contains_hit.canonical_key, 'substring', contains_hit)

        for candidate in (
            SpacetimeTopicCache.objects.all().order_by('-last_baked_at')
        ):
            if candidate.canonical_key and candidate.canonical_key in query_slug:
                return ResolverResult(candidate.canonical_key, 'substring', candidate)

    # Step 4: SBERT cosine, threshold 0.7.
    query_vec = embed_query_for_resolver(query)
    if query_vec is not None:
        nearest = (
            SpacetimeTopicCache.objects
            .exclude(title_embedding__isnull=True)
            .annotate(_dist=CosineDistance('title_embedding', query_vec))
            .order_by('_dist')
            .first()
        )
        if nearest is not None:
            distance = getattr(nearest, '_dist', None)
            if distance is not None and distance <= SBERT_COSINE_DISTANCE_CUTOFF:
                return ResolverResult(nearest.canonical_key, 'sbert', nearest)

    # Step 5: cold-start fallback.
    return ResolverResult(
        canonical_key=query_slug or slugify(query_lower),
        step='cold_start',
        cache=None,
    )
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_resolver -v 2
```

Expected: 9 PASS (4 from Task 1.2, 4 from Task 1.3, 1 shell test from Task 1.1).

**Commit**: `feat(spacetime): resolver step 4 SBERT cosine fallback`

**Delegate to**: django-engine-pro

---

### Task 1.4: Resolver latency budget integration test

**Files**:
- Modify: `Index-API/apps/notebook/tests/test_spacetime_resolver.py`

**Test first**: append a stage-scoped integration test that wires every rung once and confirms the whole ladder finishes under the 50ms budget on the local SQLite/Postgres test DB:

```python
import time


class ResolverLatencyTest(TestCase):
    def test_full_ladder_under_50ms_budget(self):
        # Seed a few rows so steps 1-3 have something to scan but never match.
        for slug in ['alpha-topic', 'beta-topic', 'gamma-topic']:
            _make_cache(slug, slug.replace('-', ' ').title())

        # Patch SBERT so the test doesn't load the encoder.
        with patch(
            'apps.notebook.services.spacetime_resolver.embed_query_for_resolver',
            return_value=None,
        ):
            t0 = time.monotonic()
            result = resolve_topic_query('a query that matches nothing at all')
            elapsed_ms = (time.monotonic() - t0) * 1000

        self.assertEqual(result.step, 'cold_start')
        self.assertLess(elapsed_ms, 50.0, f'Resolver took {elapsed_ms:.1f}ms')
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_resolver.ResolverLatencyTest -v 2
```

Expected: PASS. If it fails, the most likely cause is the per-row Python `if candidate.canonical_key in query_slug` loop pulling too many rows; if the test DB has more than ~50 cache rows, switch to a pre-filter. (The current implementation is already cheap because we cap on substring-icontains as the primary path; the Python scan is only for the reverse direction.)

**Implementation**: none beyond Task 1.3. This task is purely the budget assertion.

**Commit**: `test(spacetime): resolver completes under 50ms budget`

**Delegate to**: django-engine-pro

---

## Stage exit criteria

- All 4 tasks marked `[done]`.
- Stage-scoped integration test:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_resolver -v 2
```

Expected: all tests PASS.

- Resolver returns `ResolverResult(step='cold_start', ...)` for any query that misses every prebaked row, in under 50ms.

## Handoff to next stage

After Stage 1 the following are available:
- `apps.notebook.services.spacetime_resolver.resolve_topic_query(query) -> ResolverResult`.
- `apps.notebook.services.spacetime_resolver.ResolverResult` dataclass with fields `(canonical_key, step, cache)`.
- `apps.notebook.services.spacetime_resolver.embed_query_for_resolver(query)` helper.
- `apps.notebook.services.spacetime_resolver.SBERT_COSINE_THRESHOLD = 0.7` constant.
