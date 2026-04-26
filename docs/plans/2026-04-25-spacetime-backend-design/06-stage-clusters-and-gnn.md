# Stage 5: Bucket grouping + GNN inflection via Modal infer app

_Part of multi-file plan. See [implementation-plan.md](implementation-plan.md) for the index._

## Overview

Stage 5 turns `resolved_objects` into ranked clusters. Two pipeline stages register here:

| Stage | Action | Bounded budget |
|---|---|---|
| `cluster_bucket` | Group resolved objects by `(canonical_city, year_decade)`. Each bucket = one candidate cluster; `papers` field is bucket size. Pull a representative claim per bucket for the `note` text. | 500 ms |
| `gnn_inflection` | Score every bucket via the existing `theseus-spacetime-infer` Modal app (H100). Keep the top 8-12 buckets by attention magnitude. Emit a `cluster` SSE event per kept bucket, front-loaded by score. | ~3 s (parallel: up to 12 inferences with `max_containers=4` on the Modal side) |

Cluster `note` text comes verbatim from `Claim.text` of the bucket's representative object. We never let the 26B near these notes.

## Prerequisites

- Stages 0-4 complete.
- `modal_app/spacetime_infer.py` exists with `infer_single_embedding` (H100).
- `apps.notebook.models.Claim` has `text`, `valid_from`, `source_object`.
- `apps.notebook.models.PlaceMention` exists and links Object → PlaceEntity for canonical city resolution.
- The Modal app is reachable from Railway (the production engine_worker dispatches to it via `modal.Function.lookup`).

## Files this stage touches

```
Index-API/
├── apps/notebook/services/spacetime_clusters.py       # NEW
├── apps/notebook/services/spacetime_pipeline.py       # MOD: register stages
└── apps/notebook/tests/test_spacetime_clusters.py     # NEW
```

## Tasks

### Task 5.1: Bucket grouping module

**Files**:
- Create: `Index-API/apps/notebook/services/spacetime_clusters.py`
- Create: `Index-API/apps/notebook/tests/test_spacetime_clusters.py`

**Test first**: write `test_spacetime_clusters.py`:

```python
"""Tests for spacetime_clusters: bucket grouping, GNN scoring, cluster
events.
"""
from unittest.mock import MagicMock, patch

from django.test import TestCase

from apps.notebook.services.spacetime_clusters import (
    Bucket,
    bucket_resolved_objects,
    extract_canonical_city,
    year_to_decade,
)


class YearToDecadeTest(TestCase):
    def test_modern_year(self):
        self.assertEqual(year_to_decade(1923), 1920)
        self.assertEqual(year_to_decade(2024), 2020)

    def test_bce(self):
        # -150 BCE -> -150 (we don't decade-bucket BCE finer than that).
        self.assertEqual(year_to_decade(-150), -150)
        self.assertEqual(year_to_decade(-2000), -2000)


class ExtractCanonicalCityTest(TestCase):
    def test_uses_first_place_mention_city(self):
        obj_meta = {
            'pk': 7,
            'place_mentions': [
                {'place_type': 'country', 'preferred_name': 'France'},
                {'place_type': 'city', 'preferred_name': 'Paris'},
            ],
        }
        self.assertEqual(extract_canonical_city(obj_meta), 'Paris')

    def test_falls_back_to_centroid_signature(self):
        obj_meta = {
            'pk': 7,
            'place_mentions': [],
            'centroid_lat': 48.85, 'centroid_lon': 2.35,
        }
        self.assertTrue(
            extract_canonical_city(obj_meta).startswith('lat')
        )


class BucketResolvedObjectsTest(TestCase):
    def test_groups_by_city_and_decade(self):
        objs = [
            {
                'pk': 1, 'title': 'A',
                'centroid_lat': 48.85, 'centroid_lon': 2.35,
                'year': 1920,
                'place_mentions': [{'place_type': 'city', 'preferred_name': 'Paris'}],
                'representative_claim_id': 100,
            },
            {
                'pk': 2, 'title': 'B',
                'centroid_lat': 48.85, 'centroid_lon': 2.35,
                'year': 1925,
                'place_mentions': [{'place_type': 'city', 'preferred_name': 'Paris'}],
                'representative_claim_id': 101,
            },
            {
                'pk': 3, 'title': 'C',
                'centroid_lat': 41.9, 'centroid_lon': 12.5,
                'year': 1925,
                'place_mentions': [{'place_type': 'city', 'preferred_name': 'Rome'}],
                'representative_claim_id': 102,
            },
        ]
        buckets = bucket_resolved_objects(objs)
        bucket_keys = sorted([(b.city, b.year_decade) for b in buckets])
        self.assertEqual(
            bucket_keys,
            [('Paris', 1920), ('Rome', 1920)],
        )
        # Paris bucket has 2 papers.
        paris = next(b for b in buckets if b.city == 'Paris')
        self.assertEqual(paris.papers, 2)
        self.assertEqual(len(paris.object_pks), 2)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_clusters.YearToDecadeTest apps.notebook.tests.test_spacetime_clusters.ExtractCanonicalCityTest apps.notebook.tests.test_spacetime_clusters.BucketResolvedObjectsTest -v 2
```

Expected: 5 FAIL with `ModuleNotFoundError`.

**Implementation**:

Write `apps/notebook/services/spacetime_clusters.py`:

```python
"""Spacetime cluster construction.

A "cluster" is one dot on the globe: `(id, city, lat, lon, year, papers,
note, source_object_ids)`. We build clusters in two phases:

1. bucket_resolved_objects: group objects by (canonical_city, year_decade).
   Each bucket carries the representative claim ID for note text.

2. score_buckets_with_gnn: send each bucket's feature matrix to the
   theseus-spacetime-infer Modal app and rank by attention magnitude.

Cluster note text is extracted verbatim from Claim.text on the
representative claim. We never use the 26B for note text.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class Bucket:
    city: str
    year_decade: int
    object_pks: list[int] = field(default_factory=list)
    representative_claim_id: Optional[int] = None
    centroid_lat: float = 0.0
    centroid_lon: float = 0.0
    representative_year: int = 0  # the canonical year for the dot
    papers: int = 0
    score: float = 0.0  # populated by GNN scoring


def year_to_decade(year: int) -> int:
    """Return the decade-bucket for a year.

    For modern years (>= 1900) we floor-divide to nearest 10. For BCE
    or deep-time entries (year < 1900) we keep the year as-is to avoid
    over-bucketing the long tail. Refining the BCE bucket policy is V2
    work; the design doc allows clusters to be sparser there.
    """
    if year >= 1900:
        return (year // 10) * 10
    return year


def extract_canonical_city(obj_meta: dict[str, Any]) -> str:
    """Return the canonical city string for grouping.

    Order:
      1. First PlaceMention with place_type='city'.
      2. Any PlaceMention.
      3. Stringified centroid signature 'lat:48.85,lon:2.35' (last resort).
    """
    mentions = obj_meta.get('place_mentions') or []
    for m in mentions:
        if (m.get('place_type') or '') == 'city' and m.get('preferred_name'):
            return str(m['preferred_name'])
    for m in mentions:
        if m.get('preferred_name'):
            return str(m['preferred_name'])
    lat = obj_meta.get('centroid_lat')
    lon = obj_meta.get('centroid_lon')
    if lat is not None and lon is not None:
        return f'lat:{round(lat, 2)},lon:{round(lon, 2)}'
    return 'unknown'


def bucket_resolved_objects(
    resolved_objects: list[dict[str, Any]],
) -> list[Bucket]:
    """Group resolved objects into (canonical_city, year_decade) buckets.

    Each input object dict must include: pk, title, centroid_lat,
    centroid_lon, year, place_mentions (list of {place_type, preferred_name}),
    representative_claim_id (Optional[int]).
    """
    by_key: dict[tuple[str, int], Bucket] = {}
    for obj in resolved_objects:
        year = obj.get('year')
        lat = obj.get('centroid_lat')
        lon = obj.get('centroid_lon')
        if year is None or lat is None or lon is None:
            continue

        city = extract_canonical_city(obj)
        decade = year_to_decade(int(year))
        key = (city, decade)

        bucket = by_key.get(key)
        if bucket is None:
            bucket = Bucket(
                city=city,
                year_decade=decade,
                centroid_lat=float(lat),
                centroid_lon=float(lon),
                representative_year=int(year),
                representative_claim_id=obj.get('representative_claim_id'),
            )
            by_key[key] = bucket

        bucket.object_pks.append(int(obj['pk']))
        bucket.papers = len(bucket.object_pks)
        # Take the earliest representative_claim_id we see (highest-NLI is
        # already the first per object in graph_search; first one to land
        # in the bucket wins).
        if bucket.representative_claim_id is None and obj.get('representative_claim_id'):
            bucket.representative_claim_id = obj['representative_claim_id']
        # Update centroid to a running mean (cheap and good enough for
        # globe rendering at low zoom).
        n = len(bucket.object_pks)
        bucket.centroid_lat = (
            bucket.centroid_lat * (n - 1) + float(lat)
        ) / n
        bucket.centroid_lon = (
            bucket.centroid_lon * (n - 1) + float(lon)
        ) / n

    return list(by_key.values())


def fetch_note_text(claim_id: Optional[int], fallback_title: str) -> str:
    """Return the verbatim note text for a cluster.

    Uses the representative claim's `text`. Falls back to the object's
    title when no claim was extracted (the engine_pass deadline may have
    expired before NLI ran on this object).
    """
    if claim_id is None:
        return fallback_title or ''
    try:
        from apps.notebook.models import Claim
        claim = Claim.objects.filter(pk=claim_id).only('text').first()
        if claim and claim.text:
            return str(claim.text)
    except Exception as exc:
        logger.warning('spacetime_clusters: claim lookup failed: %s', exc)
    return fallback_title or ''
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_clusters -v 2
```

Expected: 5 PASS (only the bucket-related ones; GNN tests come in 5.2).

**Commit**: `feat(spacetime): bucket_resolved_objects + claim note extraction`

**Delegate to**: ml-pro

---

### Task 5.2: GNN scoring via the Modal infer app

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_clusters.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_clusters.py`

**Test first**: append:

```python
class ScoreBucketsTest(TestCase):
    def test_score_buckets_attaches_score_via_modal(self):
        from apps.notebook.services.spacetime_clusters import (
            Bucket, score_buckets_with_gnn,
        )
        buckets = [
            Bucket(city='Paris', year_decade=1920,
                   centroid_lat=48.85, centroid_lon=2.35,
                   representative_year=1923, papers=4,
                   object_pks=[1, 2, 3, 4]),
            Bucket(city='Rome', year_decade=1920,
                   centroid_lat=41.9, centroid_lon=12.5,
                   representative_year=1925, papers=2,
                   object_pks=[5, 6]),
        ]

        # Patch the Modal lookup so the test does not dispatch to GPU.
        with patch(
            'apps.notebook.services.spacetime_clusters._get_infer_function'
        ) as mock_get:
            fn = MagicMock()
            # Returns a 256-d embedding; the magnitude is what we score on.
            fn.remote = MagicMock(side_effect=[
                [0.0] * 255 + [0.9],  # high
                [0.0] * 255 + [0.3],  # low
            ])
            mock_get.return_value = fn

            scored = score_buckets_with_gnn(buckets, num_edge_types=8)

        self.assertEqual(scored[0].city, 'Paris')
        self.assertEqual(scored[1].city, 'Rome')
        self.assertGreater(scored[0].score, scored[1].score)

    def test_score_buckets_falls_back_to_papers_when_modal_down(self):
        from apps.notebook.services.spacetime_clusters import (
            Bucket, score_buckets_with_gnn,
        )
        buckets = [
            Bucket(city='Paris', year_decade=1920, papers=4,
                   centroid_lat=0, centroid_lon=0, representative_year=1923,
                   object_pks=[1, 2, 3, 4]),
            Bucket(city='Rome', year_decade=1920, papers=10,
                   centroid_lat=0, centroid_lon=0, representative_year=1925,
                   object_pks=[5, 6, 7, 8, 9, 10, 11, 12, 13, 14]),
        ]
        with patch(
            'apps.notebook.services.spacetime_clusters._get_infer_function',
            return_value=None,
        ):
            scored = score_buckets_with_gnn(buckets, num_edge_types=8)

        # Falls back to papers count -> Rome wins.
        self.assertEqual(scored[0].city, 'Rome')
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_clusters.ScoreBucketsTest -v 2
```

Expected: 2 FAIL.

**Implementation**:

Append to `apps/notebook/services/spacetime_clusters.py`:

```python
DEFAULT_GNN_TIMEOUT_S = 5.0
DEFAULT_FEATURE_DIM = 64  # V1 minimum feature dim; spacetime_model.py expands as needed
DEFAULT_NUM_EDGE_TYPES = 8

# Cap on parallel Modal inference calls. Mirrors the max_containers=4 set
# on the Modal-side function so we don't queue dozens of cold GPU starts.
MODAL_MAX_PARALLEL = 4


def _get_infer_function():
    """Resolve the theseus-spacetime-infer Modal Function reference.

    Returns None when Modal is not configured / reachable; callers then
    fall back to the heuristic ranking. See modal_app/spacetime_infer.py.
    """
    try:
        import modal
        fn = modal.Function.lookup(
            'theseus-spacetime-infer',
            'infer_single_embedding',
        )
        return fn
    except Exception as exc:
        logger.info(
            'spacetime_clusters: Modal infer lookup failed (will use fallback): %s',
            exc,
        )
        return None


def _build_feature_matrix(bucket: Bucket) -> tuple[bytes, bytes, int]:
    """Build the (events, attention_mask) tensors for one bucket.

    The Modal infer expects:
      events: np.float32 [1, T, F].tobytes()
      mask:   np.uint8   [1, T].tobytes()

    For V1 we encode each object as one timestep with a small feature
    vector: (centroid_lat, centroid_lon, year_normalized, papers_log,
    plus zero-padding to F). T equals len(object_pks). The actual GNN
    model interprets these in spacetime_model.py; we just need to round-
    trip the shape correctly.
    """
    import numpy as np
    pks = bucket.object_pks
    T = max(len(pks), 1)
    F = DEFAULT_FEATURE_DIM

    events = np.zeros((1, T, F), dtype=np.float32)
    mask = np.zeros((1, T), dtype=np.uint8)
    for i, _pk in enumerate(pks):
        if i >= T:
            break
        events[0, i, 0] = (bucket.centroid_lat or 0.0) / 90.0
        events[0, i, 1] = (bucket.centroid_lon or 0.0) / 180.0
        events[0, i, 2] = (bucket.representative_year or 0) / 4000.0
        # Log-papers as a saturation feature.
        events[0, i, 3] = min(1.0, (bucket.papers or 1) / 50.0)
        mask[0, i] = 1
    return events.tobytes(), mask.tobytes(), T


def _attention_magnitude(embedding: list[float]) -> float:
    """Reduce a 256-d spacetime embedding to a single scalar score.

    L2 norm is the simplest "attention magnitude" proxy. The spacetime
    model is trained to push high-attention events to larger norms;
    reducing to L2 keeps the ranking ordinal-valid without requiring
    head-specific decoding.
    """
    if not embedding:
        return 0.0
    s = 0.0
    for v in embedding:
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        s += f * f
    return s ** 0.5


def score_buckets_with_gnn(
    buckets: list[Bucket],
    *,
    num_edge_types: int = DEFAULT_NUM_EDGE_TYPES,
) -> list[Bucket]:
    """Score every bucket via the Modal infer app and sort descending.

    On Modal failure we fall back to ranking by `papers` (a useful
    proxy that keeps cold-start usable when GPU is offline).
    """
    if not buckets:
        return []

    fn = _get_infer_function()

    if fn is None:
        for b in buckets:
            b.score = float(b.papers or 0)
        buckets.sort(key=lambda b: b.score, reverse=True)
        return buckets

    # Parallel dispatch via Modal Function.starmap to bound concurrency.
    # We do not use spawn_map because we need ordered results and the
    # number of buckets is small.
    from concurrent.futures import ThreadPoolExecutor

    args_list: list[tuple[bytes, bytes, int, int]] = []
    for b in buckets:
        events_bytes, mask_bytes, T = _build_feature_matrix(b)
        args_list.append((events_bytes, mask_bytes, num_edge_types))

    embeddings: list[list[float]] = []
    with ThreadPoolExecutor(max_workers=MODAL_MAX_PARALLEL) as executor:
        try:
            results = list(executor.map(
                lambda args: fn.remote(*args),
                args_list,
            ))
        except Exception as exc:
            logger.warning(
                'spacetime_clusters: Modal inference batch failed (%s); '
                'falling back to papers ranking',
                exc,
            )
            for b in buckets:
                b.score = float(b.papers or 0)
            buckets.sort(key=lambda b: b.score, reverse=True)
            return buckets
    embeddings = results

    for bucket, emb in zip(buckets, embeddings):
        bucket.score = _attention_magnitude(emb or [])

    buckets.sort(key=lambda b: b.score, reverse=True)
    return buckets
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_clusters.ScoreBucketsTest -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): GNN bucket scoring with Modal fallback`

**Delegate to**: ml-pro

---

### Task 5.3: Register `cluster_bucket` and `gnn_inflection` stages

**Files**:
- Modify: `Index-API/apps/notebook/services/spacetime_pipeline.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: append to `test_spacetime_pipeline.py`:

```python
class ClusterBucketStageTest(TestCase):
    @patch('apps.notebook.services.spacetime_pipeline._enrich_with_place_mentions')
    def test_cluster_bucket_buckets_resolved(self, mock_enrich):
        # _enrich_with_place_mentions returns the same list; this isolates
        # the stage from the DB query that fetches PlaceMentions.
        mock_enrich.side_effect = lambda objs: objs

        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        ctx = PipelineContext(
            spacetime_job_id='j', query='q', canonical_key='q',
            mode=None, force=False,
        )
        ctx.resolved_objects = [
            {'pk': 1, 'title': 'A', 'centroid_lat': 48.85, 'centroid_lon': 2.35,
             'year': 1920, 'place_mentions': [{'place_type': 'city', 'preferred_name': 'Paris'}],
             'representative_claim_id': None},
            {'pk': 2, 'title': 'B', 'centroid_lat': 48.85, 'centroid_lon': 2.35,
             'year': 1925, 'place_mentions': [{'place_type': 'city', 'preferred_name': 'Paris'}],
             'representative_claim_id': None},
        ]
        patch_dict = STAGES['cluster_bucket'](ctx)
        self.assertEqual(len(patch_dict['buckets']), 1)
        self.assertEqual(patch_dict['buckets'][0].papers, 2)


class GnnInflectionStageTest(TestCase):
    @patch('apps.notebook.services.spacetime_pipeline.score_buckets_with_gnn')
    @patch('apps.notebook.services.spacetime_pipeline.fetch_note_text')
    @patch('apps.notebook.services.spacetime_jobs.publish_event')
    def test_emits_one_cluster_event_per_kept_bucket(
        self, mock_publish, mock_note, mock_score,
    ):
        from apps.notebook.services.spacetime_clusters import Bucket
        from apps.notebook.services.spacetime_pipeline import (
            STAGES, PipelineContext,
        )
        mock_note.return_value = 'a sentence note'
        scored = [
            Bucket(city='Paris', year_decade=1920,
                   centroid_lat=48.85, centroid_lon=2.35,
                   representative_year=1923, papers=4, score=0.9,
                   object_pks=[1, 2, 3, 4]),
        ]
        mock_score.return_value = scored

        ctx = PipelineContext(
            spacetime_job_id='j', query='q', canonical_key='q',
            mode=None, force=False,
        )
        ctx.buckets = scored
        patch_dict = STAGES['gnn_inflection'](ctx)
        # publish_event was called once with event 'cluster'.
        events = [c.args[1] for c in mock_publish.call_args_list]
        self.assertEqual(events.count('cluster'), 1)
        # The cluster payload has the expected shape.
        cluster_payload = next(
            c.args[2] for c in mock_publish.call_args_list if c.args[1] == 'cluster'
        )
        self.assertEqual(cluster_payload['city'], 'Paris')
        self.assertEqual(cluster_payload['note'], 'a sentence note')
        self.assertEqual(cluster_payload['papers'], 4)
        self.assertEqual(cluster_payload['source_object_ids'], [1, 2, 3, 4])
        # ctx.clusters reflects the same payload.
        self.assertEqual(len(patch_dict['clusters']), 1)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.ClusterBucketStageTest apps.notebook.tests.test_spacetime_pipeline.GnnInflectionStageTest -v 2
```

Expected: FAIL with `KeyError: 'cluster_bucket'` and `'gnn_inflection'`.

**Implementation**:

Append to `apps/notebook/services/spacetime_pipeline.py`:

```python
GNN_TOP_K_MIN = 8
GNN_TOP_K_MAX = 12


def _stage_cluster_bucket(ctx: PipelineContext) -> dict[str, Any]:
    """Stage 4: bucket resolved objects by (city, decade)."""
    from apps.notebook.services.spacetime_clusters import (
        bucket_resolved_objects,
    )

    enriched = _enrich_with_place_mentions(ctx.resolved_objects)
    buckets = bucket_resolved_objects(enriched)
    return {'buckets': buckets}


def _enrich_with_place_mentions(
    resolved_objects: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Bulk-load PlaceMentions for every resolved object.

    Adds a `place_mentions` key (list of {place_type, preferred_name})
    to each object dict so bucket_resolved_objects has what it needs
    without N+1 queries.
    """
    if not resolved_objects:
        return resolved_objects

    pks = [int(o['pk']) for o in resolved_objects if o.get('pk') is not None]
    if not pks:
        return resolved_objects

    try:
        from apps.notebook.models import PlaceMention
    except Exception:
        return resolved_objects

    mentions = (
        PlaceMention.objects
        .filter(object_id__in=pks)
        .select_related('place_entity')
        .only(
            'object_id', 'confidence',
            'place_entity__preferred_name', 'place_entity__place_type',
        )
        .order_by('-confidence')
    )
    by_pk: dict[int, list[dict[str, Any]]] = {}
    for m in mentions:
        if m.place_entity is None:
            continue
        by_pk.setdefault(m.object_id, []).append({
            'place_type': m.place_entity.place_type or '',
            'preferred_name': m.place_entity.preferred_name or '',
        })

    out = []
    for o in resolved_objects:
        copy = dict(o)
        copy['place_mentions'] = by_pk.get(int(o['pk']), [])
        out.append(copy)
    return out


def _stage_gnn_inflection(ctx: PipelineContext) -> dict[str, Any]:
    """Stage 5: score buckets via Modal infer; emit one cluster per kept.

    Keeps the top GNN_TOP_K_MAX (12) buckets by score, falling back to a
    minimum of GNN_TOP_K_MIN (8) when the bucket count is large enough.
    Each kept bucket is published as a `cluster` SSE event.
    """
    from apps.notebook.services.spacetime_clusters import (
        score_buckets_with_gnn,
        fetch_note_text,
    )

    if not ctx.buckets:
        return {'clusters': []}

    scored = score_buckets_with_gnn(ctx.buckets)
    # Keep at least 8 if we have at least 8; never more than 12.
    keep_n = max(GNN_TOP_K_MIN, min(GNN_TOP_K_MAX, len(scored)))
    keep_n = min(keep_n, len(scored))
    kept = scored[:keep_n]

    clusters: list[dict[str, Any]] = []
    for idx, bucket in enumerate(kept):
        note = fetch_note_text(
            bucket.representative_claim_id,
            fallback_title=f'{bucket.city}, {bucket.representative_year}',
        )
        cluster = {
            'id': idx + 1,
            'city': bucket.city,
            'lat': float(bucket.centroid_lat),
            'lon': float(bucket.centroid_lon),
            'year': int(bucket.representative_year),
            'papers': int(bucket.papers),
            'note': note,
            'source_object_ids': list(bucket.object_pks),
            'accent': 'terracotta',
        }
        spacetime_jobs.publish_event(
            ctx.spacetime_job_id, 'cluster', cluster,
        )
        clusters.append(cluster)

    return {'clusters': clusters}


# Re-export the cluster utility so the test patches resolve.
from apps.notebook.services.spacetime_clusters import (  # noqa: E402, F401
    score_buckets_with_gnn,
    fetch_note_text,
)


STAGES['cluster_bucket'] = _stage_cluster_bucket
STAGES['gnn_inflection'] = _stage_gnn_inflection
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.ClusterBucketStageTest apps.notebook.tests.test_spacetime_pipeline.GnnInflectionStageTest -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): cluster_bucket + gnn_inflection stages`

**Delegate to**: ml-pro

---

### Task 5.4: Stage-scoped integration test

**Files**:
- Modify: `Index-API/apps/notebook/tests/test_spacetime_pipeline.py`

**Test first**: append:

```python
class FiveStageIntegrationTest(TestCase):
    @patch('apps.notebook.unified_retrieval.unified_retrieve')
    @patch('apps.notebook.services.spacetime_pipeline._fetch_object_metadata')
    @patch('apps.notebook.services.spacetime_pipeline._enrich_with_place_mentions')
    @patch('apps.notebook.services.spacetime_pipeline.score_buckets_with_gnn')
    @patch('apps.notebook.services.spacetime_pipeline.fetch_note_text')
    @patch('apps.notebook.services.spacetime_jobs.publish_event')
    @patch('apps.notebook.services.spacetime_jobs.record_stage')
    def test_stages_through_gnn(
        self, _rec, _pub, mock_note, mock_score, mock_enrich, mock_meta,
        mock_retrieve,
    ):
        from apps.notebook.services.spacetime_clusters import Bucket
        from apps.notebook.services import spacetime_pipeline as p

        # Skip web_acquisition by giving graph_search 30+ usable objects.
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
        mock_score.side_effect = lambda buckets: sorted(
            buckets, key=lambda b: b.papers, reverse=True,
        )
        mock_note.return_value = 'note'

        # Disable engine_pass by clearing it from STAGES (web is skipped
        # because graph_search is sufficient).
        active = {
            'graph_search': p._stage_graph_search,
            'web_acquisition': p._stage_web_acquisition,
            'engine_pass': p._stage_engine_pass,
            'cluster_bucket': p._stage_cluster_bucket,
            'gnn_inflection': p._stage_gnn_inflection,
        }
        with patch.dict(p.STAGES, active, clear=True):
            payload = p.run_pipeline(
                spacetime_job_id='j', query='Paris',
                canonical_key='paris', mode=None, force=False,
            )

        # No final_payload; assemble step lands in Stage 6 -> empty topic.
        self.assertEqual(payload['key'], 'paris')
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_pipeline.FiveStageIntegrationTest -v 2
```

Expected: PASS.

**Implementation**: none beyond Task 5.3.

**Commit**: `test(spacetime): five-stage integration through gnn_inflection`

**Delegate to**: ml-pro

---

## Stage exit criteria

- All 4 tasks marked `[done]`.
- Stage-scoped integration:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_clusters apps.notebook.tests.test_spacetime_pipeline -v 2
```

Expected: every test PASS.

- `STAGES` registry now includes `cluster_bucket` and `gnn_inflection`.
- The pipeline emits `cluster` SSE events front-loaded by GNN score.

## Handoff to next stage

After Stage 5 the following are available:
- `apps.notebook.services.spacetime_clusters.bucket_resolved_objects(...)`.
- `apps.notebook.services.spacetime_clusters.score_buckets_with_gnn(buckets, *, num_edge_types=8)`.
- `apps.notebook.services.spacetime_clusters.fetch_note_text(claim_id, fallback_title)`.
- `apps.notebook.services.spacetime_pipeline.STAGES['cluster_bucket']` and `['gnn_inflection']`.
- `PipelineContext.clusters` populated with cluster dicts ready for chrome assembly.
