# Stage 2: POST /topic/, GET /status/, sync cache hit path

_Part of multi-file plan. See [implementation-plan.md](implementation-plan.md) for the index._

## Overview

Stage 2 wires the public endpoints. `POST /api/v2/theseus/spacetime/topic/` calls the resolver from Stage 1: on hit (steps 1-4) it returns `payload_json` directly with a 200; on miss (step 5) it enqueues `spacetime_cold_start_task` and returns `{job_id, stream_url, status_url}` with a 202. `GET /status/<job_id>/` polls the Redis-stored result for non-SSE clients. The post_delete invalidation signal lives here too.

The actual `spacetime_cold_start_task` is a stub at this stage (it just publishes a `complete` event with an empty payload). Stages 3-7 fill it in. This stage only needs to confirm the routing, the cache-hit short-circuit, the staleness re-bake hook, and the invalidation signal work.

## Prerequisites

- Stages 0 and 1 complete. Models migrated, resolver returns `ResolverResult`.
- `config/api_v2.py` exposes the `api` `NinjaAPI` object that mounts other routers under `/theseus/`.

## Files this stage touches

```
Index-API/
├── apps/notebook/api/spacetime.py                  # NEW: ninja router
├── apps/notebook/signals_spacetime.py              # NEW: post_delete invalidation (kept separate from any existing signals.py)
├── apps/notebook/apps.py                           # MOD: register signals on AppConfig.ready()
├── apps/notebook/tasks.py                          # MOD: stub spacetime_cold_start_task
├── config/api_v2.py                                # MOD: mount spacetime_router
└── apps/notebook/tests/test_spacetime_api.py       # MOD: extend with topic + status + invalidation tests
```

## Tasks

### Task 2.1: Schema definitions for the spacetime endpoints

**Files**:
- Create: `Index-API/apps/notebook/api/spacetime.py` (initial shell)
- Modify: `Index-API/apps/notebook/tests/test_spacetime_api.py`

**Test first**: append to `test_spacetime_api.py`:

```python
from django.test import Client


class SpacetimeRouterMountedTest(TestCase):
    def test_topic_route_is_mounted(self):
        # Ninja registers the router under /api/v2/theseus/spacetime/.
        # Hitting it without a body returns 422 (schema validation), which
        # is enough to confirm routing works without exercising the
        # resolver path.
        client = Client()
        resp = client.post(
            '/api/v2/theseus/spacetime/topic/',
            data='{}',
            content_type='application/json',
        )
        self.assertNotEqual(resp.status_code, 404, resp.content)
        self.assertIn(resp.status_code, (200, 202, 400, 422))
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.SpacetimeRouterMountedTest -v 2
```

Expected: FAIL with status 404 (router not yet mounted).

**Implementation**:

Write `apps/notebook/api/spacetime.py` shell (the views are stubs that 501 until Task 2.2 / 2.3 fill them in, but the router and schemas are real):

```python
"""Spacetime Atlas API endpoints.

POST /api/v2/theseus/spacetime/topic/             Resolve a topic; sync (200) or enqueue cold-start (202).
GET  /api/v2/theseus/spacetime/stream/<job_id>/   SSE stream for cold-start (filled in Stage 3).
GET  /api/v2/theseus/spacetime/status/<job_id>/   Polling status for non-SSE clients.
"""
from __future__ import annotations

from typing import Any, Optional

from ninja import Router, Schema

router = Router(tags=['spacetime'])


class TopicRequest(Schema):
    query: str
    mode: Optional[str] = None
    nocache: Optional[bool] = False


class TopicJobEnvelope(Schema):
    job_id: str
    stream_url: str
    status_url: str


class TopicStatus(Schema):
    status: str
    stages_completed: list[str]
    error: Optional[str] = None


@router.post('/topic/')
def post_topic(request, payload: TopicRequest) -> Any:
    """Resolve a topic. Cache hit returns SpacetimeTopic JSON; miss enqueues cold-start."""
    # Filled in by Task 2.2.
    from django.http import JsonResponse
    return JsonResponse({'error': 'not implemented'}, status=501)


@router.get('/status/{job_id}/', response=TopicStatus)
def get_status(request, job_id: str) -> Any:
    """Polling fallback for clients that cannot do SSE."""
    # Filled in by Task 2.4.
    from django.http import JsonResponse
    return JsonResponse({'error': 'not implemented'}, status=501)
```

Then mount the router in `config/api_v2.py`. Append after the existing imports (around line 35):

```python
from apps.notebook.api.spacetime import router as spacetime_router  # noqa: E402
```

And after the existing `api.add_router(...)` calls (after the federation router on line 49):

```python
api.add_router("/theseus/spacetime/", spacetime_router)
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.SpacetimeRouterMountedTest -v 2
```

Expected: PASS (the route now exists; the stub returns 501 which is in the accepted set).

**Commit**: `feat(spacetime): mount spacetime router with TopicRequest schema`

**Delegate to**: django-engine-pro

---

### Task 2.2: `POST /topic/` cache hit branch

**Files**:
- Modify: `Index-API/apps/notebook/api/spacetime.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_api.py`

**Test first**: append:

```python
import json
from datetime import timedelta
from django.utils import timezone


class PostTopicCacheHitTest(TestCase):
    def test_returns_payload_on_slug_hit(self):
        SpacetimeTopicCache.objects.create(
            canonical_key='sickle-cell-anemia',
            title='Sickle cell anemia',
            sub='A genetic blood disorder.',
            sources=12,
            span_min=1910,
            span_max=2024,
            payload_json={
                'key': 'sickle-cell-anemia',
                'title': 'Sickle cell anemia',
                'sub': 'A genetic blood disorder.',
                'sources': 12,
                'span': [1910, 2024],
                'events': [],
                'trace': [],
                'mode': 'modern',
            },
        )
        client = Client()
        resp = client.post(
            '/api/v2/theseus/spacetime/topic/',
            data=json.dumps({'query': 'Sickle Cell Anemia'}),
            content_type='application/json',
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        body = resp.json()
        self.assertEqual(body['key'], 'sickle-cell-anemia')
        self.assertIn('events', body)


class PostTopicStaleCacheTest(TestCase):
    def test_stale_cache_still_returns_payload(self):
        # Stale-but-extant: payload returned, re-bake fired in background.
        # The re-bake is just a queue.delay call; we patch it to assert
        # the trigger fires.
        old = timezone.now() - timedelta(days=10)
        cache_row = SpacetimeTopicCache.objects.create(
            canonical_key='old-topic',
            title='Old topic',
            sub='',
            sources=1,
            span_min=1900, span_max=1950,
            payload_json={'key': 'old-topic'},
        )
        SpacetimeTopicCache.objects.filter(pk=cache_row.pk).update(last_baked_at=old)

        with patch(
            'apps.notebook.api.spacetime._enqueue_background_rebake'
        ) as mock_rebake:
            resp = Client().post(
                '/api/v2/theseus/spacetime/topic/',
                data=json.dumps({'query': 'Old topic'}),
                content_type='application/json',
            )
        self.assertEqual(resp.status_code, 200)
        mock_rebake.assert_called_once_with('old-topic', mode=None)
```

Add the imports needed (`from unittest.mock import patch`, `from apps.notebook.models import SpacetimeTopicCache`).

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.PostTopicCacheHitTest apps.notebook.tests.test_spacetime_api.PostTopicStaleCacheTest -v 2
```

Expected: 2 FAIL with status 501.

**Implementation**:

Replace the `post_topic` body in `apps/notebook/api/spacetime.py`:

```python
import logging
from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone

from apps.notebook.services.spacetime_resolver import resolve_topic_query

logger = logging.getLogger(__name__)


CACHE_FRESH_DAYS = 7


def _enqueue_background_rebake(canonical_key: str, mode: Optional[str] = None) -> None:
    """Queue a background re-bake for a stale cache row.

    Called when a cache hit is older than CACHE_FRESH_DAYS. The re-bake
    fires the same task as a cold-start with force=True. It is fire-and-
    forget: the current request still returns the stale payload.
    """
    try:
        from apps.notebook.tasks import spacetime_cold_start_task
        from apps.notebook.services.spacetime_jobs import make_job_id
        spacetime_cold_start_task.delay(
            spacetime_job_id=make_job_id(),
            query=canonical_key.replace('-', ' '),
            canonical_key=canonical_key,
            mode=mode,
            force=True,
        )
    except Exception as exc:
        logger.warning(
            'spacetime: background rebake enqueue failed for %s: %s',
            canonical_key, exc,
        )


@router.post('/topic/')
def post_topic(request, payload: TopicRequest) -> Any:
    """Resolve a topic. Cache hit -> 200 + JSON. Cold-start -> 202 + envelope."""
    query = (payload.query or '').strip()
    if not query:
        return JsonResponse({'error': 'query required'}, status=400)

    nocache = bool(payload.nocache)
    if nocache:
        return _begin_cold_start(query, mode=payload.mode, force=True)

    result = resolve_topic_query(query)

    if result.cache is not None:
        # Stale-but-extant: return payload, fire background re-bake.
        age = timezone.now() - result.cache.last_baked_at
        if age > timedelta(days=CACHE_FRESH_DAYS):
            _enqueue_background_rebake(result.cache.canonical_key, mode=payload.mode)

        # Log resolution telemetry. Cache hits do not record stages.
        from apps.notebook.models import SpacetimeQueryLog
        SpacetimeQueryLog.objects.create(
            query=query[:500],
            canonical_key=result.cache.canonical_key,
            resolver_step=result.step,
            cache_hit=True,
        )
        return JsonResponse(result.cache.payload_json, status=200, safe=False)

    return _begin_cold_start(query, mode=payload.mode, force=False)


def _begin_cold_start(query: str, *, mode: Optional[str], force: bool) -> Any:
    """Enqueue the cold-start task and return the SSE envelope."""
    from apps.notebook.services.spacetime_jobs import make_job_id
    from apps.notebook.tasks import spacetime_cold_start_task
    from django.utils.text import slugify

    canonical_key = slugify(query)
    job_id = make_job_id()
    try:
        spacetime_cold_start_task.delay(
            spacetime_job_id=job_id,
            query=query,
            canonical_key=canonical_key,
            mode=mode,
            force=force,
        )
    except Exception as exc:
        logger.error('spacetime: enqueue failed: %s', exc)
        return JsonResponse({'error': 'enqueue_failed', 'detail': str(exc)}, status=503)

    return JsonResponse(
        {
            'job_id': job_id,
            'stream_url': f'/api/v2/theseus/spacetime/stream/{job_id}/',
            'status_url': f'/api/v2/theseus/spacetime/status/{job_id}/',
        },
        status=202,
    )
```

Stub `make_job_id` inline in `apps/notebook/api/spacetime.py` so this stage does not touch `apps/notebook/services/spacetime_jobs.py` (which is the full surface owned by Stage 3). The inline helper prefers the real `spacetime_jobs.make_job_id` when it lands and falls back to `uuid.uuid4().hex` otherwise:

Insert at the very top of the import block in `apps/notebook/api/spacetime.py`:

```python
import uuid as _uuid_for_stub
```

And replace `from apps.notebook.services.spacetime_jobs import make_job_id` with a defensive inline definition that prefers the real helper when present:

```python
def _stub_make_job_id() -> str:
    try:
        from apps.notebook.services.spacetime_jobs import make_job_id as _real
        return _real()
    except Exception:
        return _uuid_for_stub.uuid4().hex
```

Then call `_stub_make_job_id()` everywhere instead of `make_job_id()`. This is the only stub allowed here; Stage 3 deletes it and switches to the real `spacetime_jobs.make_job_id`.

For `spacetime_cold_start_task`, add a one-line stub in `apps/notebook/tasks.py`. Insert near the existing `ask_async_task` (around line 1576, immediately after `return {'status': 'complete', 'ask_job_id': ask_job_id}`):

```python
@django_rq.job('default', timeout=120)
def spacetime_cold_start_task(
    spacetime_job_id: str,
    query: str,
    canonical_key: str,
    mode: str | None = None,
    force: bool = False,
):
    """Stub spacetime cold-start task; full pipeline lands in Stages 4-7."""
    logger.info(
        'spacetime_cold_start_task stub called: job=%s query=%r key=%s force=%s',
        spacetime_job_id, query, canonical_key, force,
    )
    return {'status': 'stub', 'spacetime_job_id': spacetime_job_id}
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.PostTopicCacheHitTest apps.notebook.tests.test_spacetime_api.PostTopicStaleCacheTest -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): POST /topic/ cache-hit + cold-start envelope`

**Delegate to**: django-engine-pro

---

### Task 2.3: `POST /topic/` cold-start envelope test

**Files**:
- Modify: `Index-API/apps/notebook/tests/test_spacetime_api.py`

**Test first**: append:

```python
class PostTopicColdStartTest(TestCase):
    def test_unknown_query_returns_envelope(self):
        with patch(
            'apps.notebook.tasks.spacetime_cold_start_task.delay'
        ) as mock_delay:
            resp = Client().post(
                '/api/v2/theseus/spacetime/topic/',
                data=json.dumps({'query': 'totally novel topic xyz'}),
                content_type='application/json',
            )
        self.assertEqual(resp.status_code, 202, resp.content)
        body = resp.json()
        self.assertIn('job_id', body)
        self.assertTrue(body['stream_url'].endswith(f"/{body['job_id']}/"))
        self.assertTrue(body['status_url'].endswith(f"/{body['job_id']}/"))
        mock_delay.assert_called_once()

    def test_nocache_flag_forces_cold_start(self):
        # Even with a fresh cache row present, ?nocache=1 hits cold-start.
        SpacetimeTopicCache.objects.create(
            canonical_key='cached-topic',
            title='Cached topic',
            sub='', sources=1, span_min=2000, span_max=2024,
            payload_json={'key': 'cached-topic'},
        )
        with patch(
            'apps.notebook.tasks.spacetime_cold_start_task.delay'
        ) as mock_delay:
            resp = Client().post(
                '/api/v2/theseus/spacetime/topic/',
                data=json.dumps({'query': 'Cached topic', 'nocache': True}),
                content_type='application/json',
            )
        self.assertEqual(resp.status_code, 202)
        mock_delay.assert_called_once()
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.PostTopicColdStartTest -v 2
```

Expected: 2 PASS already (Task 2.2 implementation is sufficient).

**Implementation**: none beyond Task 2.2. This task is pure verification of the cold-start envelope shape.

**Commit**: `test(spacetime): cold-start envelope and nocache flag`

**Delegate to**: django-engine-pro

---

### Task 2.4: `GET /status/<job_id>/` polling endpoint

**Files**:
- Modify: `Index-API/apps/notebook/api/spacetime.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_api.py`

**Test first**: append:

```python
class GetStatusTest(TestCase):
    def test_pending_when_no_redis_state(self):
        with patch(
            'apps.notebook.api.spacetime._fetch_status_payload',
            return_value={'status': 'pending', 'stages_completed': []},
        ):
            resp = Client().get('/api/v2/theseus/spacetime/status/abc123/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['status'], 'pending')

    def test_complete_returns_stages(self):
        with patch(
            'apps.notebook.api.spacetime._fetch_status_payload',
            return_value={
                'status': 'complete',
                'stages_completed': ['graph_search', 'cluster_bucket', 'complete'],
            },
        ):
            resp = Client().get('/api/v2/theseus/spacetime/status/abc123/')
        body = resp.json()
        self.assertEqual(body['status'], 'complete')
        self.assertEqual(
            body['stages_completed'],
            ['graph_search', 'cluster_bucket', 'complete'],
        )
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.GetStatusTest -v 2
```

Expected: 2 FAIL with 501.

**Implementation**:

Replace the `get_status` body in `apps/notebook/api/spacetime.py`:

```python
def _fetch_status_payload(job_id: str) -> dict:
    """Read the job's status from Redis without blocking.

    Returns one of:
      - {'status': 'pending', 'stages_completed': []}
      - {'status': 'complete', 'stages_completed': [...]}
      - {'status': 'error', 'stages_completed': [...], 'error': str}

    `stages_completed` is best-effort and may be empty for pending jobs.
    """
    try:
        from apps.notebook.services.spacetime_jobs import (
            fetch_status as _fetch,
            fetch_stages,
        )
        status = _fetch(job_id)
        stages = fetch_stages(job_id)
        out: dict = {'status': status, 'stages_completed': stages}
        if status == 'error':
            from apps.notebook.services.spacetime_jobs import fetch_result
            stored = fetch_result(job_id) or {}
            out['error'] = (
                stored.get('error')
                or stored.get('message')
                or 'unknown error'
            )
        return out
    except Exception as exc:
        logger.warning('spacetime: status lookup failed for %s: %s', job_id, exc)
        return {'status': 'pending', 'stages_completed': []}


@router.get('/status/{job_id}/', response=TopicStatus)
def get_status(request, job_id: str):
    return _fetch_status_payload(job_id)
```

The two helpers `fetch_status` and `fetch_stages` are owned by Stage 3's `spacetime_jobs.py`. The test mocks `_fetch_status_payload` directly so this task does not depend on Stage 3 yet. The `try/except Exception` falls back to `pending` if the helpers are missing, so the endpoint still works between stages.

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.GetStatusTest -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): GET /status/<job_id>/ polling endpoint`

**Delegate to**: django-engine-pro

---

### Task 2.5: post_delete invalidation signal

**Files**:
- Create: `Index-API/apps/notebook/signals_spacetime.py` (kept separate from any existing `signals.py` to avoid colliding with current notebook signals)
- Modify: `Index-API/apps/notebook/apps.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_api.py`

**Test first**: append:

```python
from apps.notebook.models import Object, ObjectType


class CacheInvalidationOnObjectDeleteTest(TestCase):
    def test_deleting_referenced_object_clears_cache(self):
        ot = ObjectType.objects.create(name='Test', slug='test-ot')
        obj = Object.objects.create(title='X', object_type=ot)
        cache_row = SpacetimeTopicCache.objects.create(
            canonical_key='references-x',
            title='References X',
            sub='', sources=1, span_min=2000, span_max=2024,
            payload_json={'key': 'references-x'},
            object_ids=[obj.pk, 999_999],
        )
        obj.delete()
        self.assertFalse(
            SpacetimeTopicCache.objects.filter(pk=cache_row.pk).exists(),
            'Cache row referencing deleted Object must be evicted.',
        )

    def test_deleting_unreferenced_object_leaves_cache_alone(self):
        ot = ObjectType.objects.create(name='Test2', slug='test-ot-2')
        obj = Object.objects.create(title='Y', object_type=ot)
        cache_row = SpacetimeTopicCache.objects.create(
            canonical_key='no-ref',
            title='No ref',
            sub='', sources=1, span_min=2000, span_max=2024,
            payload_json={'key': 'no-ref'},
            object_ids=[111, 222],
        )
        obj.delete()
        self.assertTrue(
            SpacetimeTopicCache.objects.filter(pk=cache_row.pk).exists()
        )
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.CacheInvalidationOnObjectDeleteTest -v 2
```

Expected: 2 FAIL (no signal registered yet).

**Implementation**:

Write `apps/notebook/signals_spacetime.py`:

```python
"""post_delete signal for SpacetimeTopicCache invalidation.

When an Object is deleted, any SpacetimeTopicCache row whose object_ids
ArrayField contains its PK is evicted. The cache row is cheap to rebuild
on the next query, so dropping it is safer than serving stale events
that point to a now-missing Object.
"""
from __future__ import annotations

import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from apps.notebook.models import Object, SpacetimeTopicCache

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Object)
def invalidate_spacetime_cache_on_object_delete(sender, instance, **kwargs):
    pk = getattr(instance, 'pk', None)
    if pk is None:
        return
    try:
        deleted_count, _ = (
            SpacetimeTopicCache.objects
            .filter(object_ids__contains=[pk])
            .delete()
        )
        if deleted_count:
            logger.info(
                'spacetime: invalidated %d cache rows referencing Object pk=%s',
                deleted_count, pk,
            )
    except Exception as exc:
        logger.warning(
            'spacetime: cache invalidation failed for Object pk=%s: %s',
            pk, exc,
        )
```

Modify `apps/notebook/apps.py` to wire the signal in `ready()`. Locate the `class NotebookConfig(AppConfig)` and ensure its `ready()` imports the new module. If `ready()` does not exist, add:

```python
def ready(self):
    # Import signal handlers so they register on app startup.
    from apps.notebook import signals_spacetime  # noqa: F401
    # Preserve any pre-existing imports here.
```

If `ready()` already exists, append the line `from apps.notebook import signals_spacetime  # noqa: F401` immediately before its first existing `# noqa: F401` line so the order with other signal modules is preserved.

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.CacheInvalidationOnObjectDeleteTest -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): post_delete signal evicts cache on Object delete`

**Delegate to**: django-engine-pro

---

## Stage exit criteria

- All 5 tasks marked `[done]`.
- Stage-scoped integration test:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api -v 2
```

Expected: every test in the file PASS.

- `curl -s -X POST http://localhost:8000/api/v2/theseus/spacetime/topic/ -H 'Content-Type: application/json' -d '{"query":"sickle cell anemia"}'` returns a 200 JSON body when the cache is warm, or a 202 envelope when cold.

## Handoff to next stage

After Stage 2 the following are available:
- `POST /api/v2/theseus/spacetime/topic/` returns 200 (cache hit) or 202 (cold-start enqueued).
- `GET /api/v2/theseus/spacetime/status/<job_id>/` returns `{status, stages_completed, error?}`.
- `apps.notebook.tasks.spacetime_cold_start_task` exists as a stub awaiting Stages 3-7.
- Cache invalidation on Object delete is wired.
- The `_stub_make_job_id` helper is the only stub remaining; Stage 3 replaces it with the real `spacetime_jobs.make_job_id`.
