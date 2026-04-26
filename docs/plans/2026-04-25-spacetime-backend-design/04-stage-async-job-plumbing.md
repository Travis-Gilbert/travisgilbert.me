# Stage 3: Redis pub/sub helpers, SSE relay, `spacetime_cold_start_task` shell

_Part of multi-file plan. See [implementation-plan.md](implementation-plan.md) for the index._

## Overview

Stage 3 ports the `/ask/async/` plumbing verbatim onto the spacetime channel. We get four artifacts:

1. `spacetime_jobs.py`: `make_job_id`, `channel_name`, `result_key`, `stages_key`, `publish_event`, `store_result`, `store_error`, `record_stage`, `fetch_status`, `fetch_result`, `fetch_stages`. Same shape as `ask_jobs.py`, plus an additional `record_stage` so the `/status/` endpoint can list completed stages.
2. The real `spacetime_cold_start_task` shell: it publishes `pipeline_start`, delegates to `_run_spacetime_pipeline` (which is a thin indirection over `apps.notebook.services.spacetime_pipeline.run_pipeline`), and publishes `complete` or `error`. The pipeline body itself lands in Stage 4; this stage exercises only the lifecycle wrapper.
3. SSE relay route `GET /stream/<job_id>/` that mirrors `/ask/stream/<job_id>/`: replays a stored result if the job already finished, otherwise subscribes to the live channel.
4. Replace the `_stub_make_job_id` helper from Stage 2 with the real one.

No business logic yet: just the streaming substrate.

## Prerequisites

- Stages 0-2 complete. `apps.notebook.api.spacetime` mounts the router.
- `apps.notebook.redis_utils.get_redis_connection()` exists (already used by `ask_jobs.py`).
- `django_rq` is configured in `config/settings.py` (already true).

## Files this stage touches

```
Index-API/
├── apps/notebook/services/spacetime_jobs.py            # NEW
├── apps/notebook/api/spacetime.py                      # MOD: add stream view, drop stub helper
├── apps/notebook/tasks.py                              # MOD: replace stub spacetime_cold_start_task
└── apps/notebook/tests/test_spacetime_jobs.py          # NEW
```

## Tasks

### Task 3.1: `spacetime_jobs.py` pub/sub helpers

**Files**:
- Create: `Index-API/apps/notebook/services/spacetime_jobs.py`
- Create: `Index-API/apps/notebook/tests/test_spacetime_jobs.py`

**Test first**: write `test_spacetime_jobs.py`:

```python
"""Tests for spacetime_jobs Redis pub/sub helpers.

Every helper short-circuits to a no-op when redis_utils returns None,
so we can assert behavior under both "redis available" and "redis down"
conditions by patching get_redis_connection.
"""
import json
from unittest.mock import MagicMock, patch

from django.test import TestCase

from apps.notebook.services import spacetime_jobs


class JobIdTest(TestCase):
    def test_make_job_id_is_unique_hex(self):
        a = spacetime_jobs.make_job_id()
        b = spacetime_jobs.make_job_id()
        self.assertNotEqual(a, b)
        self.assertEqual(len(a), 32)
        int(a, 16)  # raises if not hex


class ChannelNameTest(TestCase):
    def test_channel_format(self):
        self.assertEqual(
            spacetime_jobs.channel_name('abc'),
            'theseus:spacetime:abc',
        )

    def test_result_key_format(self):
        self.assertEqual(
            spacetime_jobs.result_key('abc'),
            'theseus:spacetime:abc:result',
        )

    def test_stages_key_format(self):
        self.assertEqual(
            spacetime_jobs.stages_key('abc'),
            'theseus:spacetime:abc:stages',
        )


class PublishEventNoRedisTest(TestCase):
    @patch.object(spacetime_jobs, '_get_redis', return_value=None)
    def test_publish_event_silent_when_redis_unavailable(self, mock_get):
        # Should not raise.
        spacetime_jobs.publish_event('job-a', 'stage', {'name': 'x'})


class PublishEventWithRedisTest(TestCase):
    @patch.object(spacetime_jobs, '_get_redis')
    def test_publish_event_writes_json_envelope(self, mock_get):
        r = MagicMock()
        mock_get.return_value = r
        spacetime_jobs.publish_event('job-a', 'cluster', {'id': 1})
        r.publish.assert_called_once()
        channel, payload = r.publish.call_args.args
        self.assertEqual(channel, 'theseus:spacetime:job-a')
        envelope = json.loads(payload)
        self.assertEqual(envelope['event'], 'cluster')
        self.assertEqual(envelope['data'], {'id': 1})


class StoreAndFetchResultTest(TestCase):
    @patch.object(spacetime_jobs, '_get_redis')
    def test_store_then_fetch_round_trips(self, mock_get):
        store = {}
        r = MagicMock()
        r.setex = lambda k, ttl, v: store.__setitem__(k, v)
        r.get = lambda k: store.get(k)
        mock_get.return_value = r

        spacetime_jobs.store_result('j', {'topic': 'sickle-cell-anemia'})
        out = spacetime_jobs.fetch_result('j')
        self.assertEqual(out, {'topic': 'sickle-cell-anemia'})

    @patch.object(spacetime_jobs, '_get_redis', return_value=None)
    def test_fetch_result_returns_none_when_redis_down(self, _):
        self.assertIsNone(spacetime_jobs.fetch_result('j'))


class RecordAndFetchStagesTest(TestCase):
    @patch.object(spacetime_jobs, '_get_redis')
    def test_record_stage_appends_in_order(self, mock_get):
        store_list = []
        r = MagicMock()
        r.rpush = lambda k, v: store_list.append((k, v))
        r.expire = MagicMock()
        r.lrange = lambda k, a, b: [v for kk, v in store_list if kk == k]
        mock_get.return_value = r

        spacetime_jobs.record_stage('j', 'graph_search')
        spacetime_jobs.record_stage('j', 'web_acquisition')
        stages = spacetime_jobs.fetch_stages('j')
        self.assertEqual(stages, ['graph_search', 'web_acquisition'])


class FetchStatusTest(TestCase):
    @patch.object(spacetime_jobs, 'fetch_result', return_value=None)
    def test_pending_when_no_result(self, _):
        self.assertEqual(spacetime_jobs.fetch_status('j'), 'pending')

    @patch.object(spacetime_jobs, 'fetch_result', return_value={'error': 'x'})
    def test_error_when_only_error_key(self, _):
        self.assertEqual(spacetime_jobs.fetch_status('j'), 'error')

    @patch.object(
        spacetime_jobs, 'fetch_result',
        return_value={'key': 'sickle-cell-anemia', 'events': []},
    )
    def test_complete_for_full_payload(self, _):
        self.assertEqual(spacetime_jobs.fetch_status('j'), 'complete')
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_jobs -v 2
```

Expected: all FAIL with `ModuleNotFoundError: No module named 'apps.notebook.services.spacetime_jobs'`.

**Implementation**:

Write `apps/notebook/services/spacetime_jobs.py`:

```python
"""Redis pub/sub helpers for the spacetime cold-start pipeline.

Mirrors apps/notebook/services/ask_jobs.py one-for-one but on a separate
channel namespace so the two pipelines do not conflict. The cold-start
RQ task is the publisher; the SSE relay endpoint is the subscriber.

Channel name format:
    theseus:spacetime:<job_id>

Event envelope (each pubsub message is a JSON-encoded dict):
    {"event": "<type>", "data": <type-specific-payload>}

Event types:
    "stage"     pipeline stage progress, e.g. {"name": "graph_search"}
    "cluster"   one resolved cluster ready to render on the globe
    "chrome"    topic-level chrome (title, sub, era_band, mode)
    "complete"  full SpacetimeTopic payload (terminal)
    "error"     terminal error payload (terminal)

In addition to the result key (which mirrors ask_jobs), we maintain a
Redis list at theseus:spacetime:<job_id>:stages so the polling status
endpoint can list completed stages without re-subscribing.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Optional

from apps.notebook.redis_utils import get_redis_connection

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = 'theseus:spacetime:'
RESULT_TTL_SECONDS = 600  # 10 minutes
STAGES_TTL_SECONDS = 600

_redis_conn = None
_redis_resolved = False


def _get_redis():
    """Cache-and-return Redis connection (no per-call django_rq round-trip)."""
    global _redis_conn, _redis_resolved
    if _redis_resolved:
        return _redis_conn
    _redis_conn = get_redis_connection()
    _redis_resolved = True
    if _redis_conn is None:
        logger.warning('spacetime_jobs: no redis connection available')
    return _redis_conn


def make_job_id() -> str:
    return uuid.uuid4().hex


def channel_name(job_id: str) -> str:
    return f'{CHANNEL_PREFIX}{job_id}'


def result_key(job_id: str) -> str:
    return f'{CHANNEL_PREFIX}{job_id}:result'


def stages_key(job_id: str) -> str:
    return f'{CHANNEL_PREFIX}{job_id}:stages'


def publish_event(job_id: str, event: str, data) -> None:
    """Publish one envelope to the job's channel. Fire-and-forget."""
    r = _get_redis()
    if r is None:
        return
    try:
        message = json.dumps({'event': event, 'data': data}, default=str)
        r.publish(channel_name(job_id), message)
    except Exception as exc:
        logger.debug('spacetime_jobs.publish_event failed: %s', exc)


def record_stage(job_id: str, stage_name: str) -> None:
    """Append stage_name to the job's stages list (with TTL)."""
    r = _get_redis()
    if r is None:
        return
    try:
        key = stages_key(job_id)
        r.rpush(key, stage_name)
        r.expire(key, STAGES_TTL_SECONDS)
    except Exception as exc:
        logger.debug('spacetime_jobs.record_stage failed: %s', exc)


def fetch_stages(job_id: str) -> list[str]:
    """Return the ordered list of completed stages for this job."""
    r = _get_redis()
    if r is None:
        return []
    try:
        raw = r.lrange(stages_key(job_id), 0, -1)
        out = []
        for item in raw or []:
            if isinstance(item, bytes):
                item = item.decode('utf-8', errors='replace')
            out.append(str(item))
        return out
    except Exception as exc:
        logger.debug('spacetime_jobs.fetch_stages failed: %s', exc)
        return []


def store_result(job_id: str, payload: dict) -> None:
    r = _get_redis()
    if r is None:
        return
    try:
        r.setex(result_key(job_id), RESULT_TTL_SECONDS, json.dumps(payload, default=str))
    except Exception as exc:
        logger.debug('spacetime_jobs.store_result failed: %s', exc)


def store_error(job_id: str, error_message: str) -> None:
    store_result(job_id, {'error': error_message})


def fetch_result(job_id: str) -> Optional[dict]:
    r = _get_redis()
    if r is None:
        return None
    try:
        raw = r.get(result_key(job_id))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.debug('spacetime_jobs.fetch_result failed: %s', exc)
        return None


def fetch_status(job_id: str) -> str:
    """Return one of 'pending', 'complete', 'error'."""
    stored = fetch_result(job_id)
    if stored is None:
        return 'pending'
    if isinstance(stored, dict) and 'error' in stored and len(stored) == 1:
        return 'error'
    return 'complete'
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_jobs -v 2
```

Expected: 11 PASS.

**Commit**: `feat(spacetime): pub/sub helpers + stages list in Redis`

**Delegate to**: django-engine-pro

---

### Task 3.2: SSE relay endpoint `GET /stream/<job_id>/`

**Files**:
- Modify: `Index-API/apps/notebook/api/spacetime.py`
- Modify: `Index-API/apps/notebook/tests/test_spacetime_api.py`

**Test first**: append:

```python
class GetStreamReplayTest(TestCase):
    def test_replay_complete_payload_for_finished_job(self):
        from apps.notebook.services import spacetime_jobs as sj
        with patch.object(sj, 'fetch_status', return_value='complete'), \
             patch.object(
                 sj, 'fetch_result',
                 return_value={'key': 'k', 'events': []},
             ):
            resp = Client().get('/api/v2/theseus/spacetime/stream/abc/')
            content = b''.join(resp.streaming_content).decode()

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['content-type'], 'text/event-stream')
        self.assertIn('event: complete', content)
        self.assertIn('"key": "k"', content)
        self.assertIn('event: done', content)

    def test_replay_error_for_failed_job(self):
        from apps.notebook.services import spacetime_jobs as sj
        with patch.object(sj, 'fetch_status', return_value='error'), \
             patch.object(sj, 'fetch_result', return_value={'error': 'fetch failed'}):
            resp = Client().get('/api/v2/theseus/spacetime/stream/abc/')
            content = b''.join(resp.streaming_content).decode()
        self.assertIn('event: error', content)
        self.assertIn('"error": "fetch failed"', content)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.GetStreamReplayTest -v 2
```

Expected: 2 FAIL with `404`.

**Implementation**:

Append to `apps/notebook/api/spacetime.py`:

```python
import datetime
import json as _json
from decimal import Decimal

from django.http import StreamingHttpResponse


def _sse_json_default(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f'Object of type {type(obj).__name__} is not JSON serializable')


@router.get('/stream/{job_id}/', response=None)
def get_stream(request, job_id: str):
    """Server-Sent Events relay for spacetime cold-start jobs.

    If the job has already finished by the time this endpoint is called,
    the stored payload is replayed immediately. Otherwise the consumer
    subscribes to theseus:spacetime:<job_id> and forwards every Redis
    pub/sub message as an SSE event. Closes on receipt of `complete` or
    `error`.
    """
    from apps.notebook.services import spacetime_jobs

    def sse_stream():
        # Replay path for late subscribers.
        status = spacetime_jobs.fetch_status(job_id)
        if status in ('complete', 'error'):
            stored = spacetime_jobs.fetch_result(job_id)
            if stored is not None:
                event_name = 'complete' if status == 'complete' else 'error'
                payload = _json.dumps(stored, default=_sse_json_default)
                yield f'event: {event_name}\ndata: {payload}\n\n'
                yield 'event: done\ndata: {}\n\n'
                return

        # Live path.
        r = spacetime_jobs._get_redis()
        if r is None:
            yield 'event: error\ndata: {"message": "redis unavailable"}\n\n'
            return

        try:
            pubsub = r.pubsub(ignore_subscribe_messages=True)
            pubsub.subscribe(spacetime_jobs.channel_name(job_id))
        except Exception as exc:
            yield f'event: error\ndata: {{"message": "subscribe failed: {exc}"}}\n\n'
            return

        try:
            for message in pubsub.listen():
                if message is None:
                    continue
                if message.get('type') != 'message':
                    continue

                raw = message.get('data')
                if isinstance(raw, bytes):
                    raw = raw.decode('utf-8', errors='replace')

                try:
                    parsed = _json.loads(raw)
                except Exception:
                    continue

                event_name = parsed.get('event', 'message')
                event_data = _json.dumps(
                    parsed.get('data', {}),
                    default=_sse_json_default,
                )
                yield f'event: {event_name}\ndata: {event_data}\n\n'

                if event_name in ('complete', 'error'):
                    yield 'event: done\ndata: {}\n\n'
                    break
        finally:
            try:
                pubsub.unsubscribe()
                pubsub.close()
            except Exception:
                pass

    return StreamingHttpResponse(
        sse_stream(),
        content_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.GetStreamReplayTest -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): SSE relay GET /stream/<job_id>/`

**Delegate to**: django-engine-pro

---

### Task 3.3: Real `spacetime_cold_start_task` shell

**Files**:
- Modify: `Index-API/apps/notebook/tasks.py`
- Modify: `Index-API/apps/notebook/api/spacetime.py` (drop `_stub_make_job_id`)
- Modify: `Index-API/apps/notebook/tests/test_spacetime_jobs.py`

**Test first**: append to `test_spacetime_jobs.py`:

```python
class SpacetimeColdStartTaskShellTest(TestCase):
    """The shell publishes pipeline_start, calls _run_spacetime_pipeline,
    stores the result, and publishes complete. On exception it publishes
    error.
    """
    @patch('apps.notebook.tasks._run_spacetime_pipeline')
    @patch.object(spacetime_jobs, 'publish_event')
    @patch.object(spacetime_jobs, 'store_result')
    def test_happy_path_publishes_start_and_complete(
        self, mock_store, mock_publish, mock_pipeline,
    ):
        mock_pipeline.return_value = {'key': 'k', 'events': []}
        from apps.notebook.tasks import spacetime_cold_start_task
        out = spacetime_cold_start_task(
            spacetime_job_id='j1',
            query='hello',
            canonical_key='hello',
            mode=None,
            force=False,
        )
        self.assertEqual(out['status'], 'complete')
        events = [c.args[1] for c in mock_publish.call_args_list]
        self.assertIn('stage', events)
        self.assertIn('complete', events)
        mock_store.assert_called_once_with('j1', {'key': 'k', 'events': []})

    @patch(
        'apps.notebook.tasks._run_spacetime_pipeline',
        side_effect=RuntimeError('boom'),
    )
    @patch.object(spacetime_jobs, 'publish_event')
    @patch.object(spacetime_jobs, 'store_error')
    def test_exception_path_publishes_error(
        self, mock_store_err, mock_publish, _mock_pipeline,
    ):
        from apps.notebook.tasks import spacetime_cold_start_task
        out = spacetime_cold_start_task(
            spacetime_job_id='j2',
            query='hello',
            canonical_key='hello',
            mode=None,
            force=False,
        )
        self.assertEqual(out['status'], 'error')
        events = [c.args[1] for c in mock_publish.call_args_list]
        self.assertIn('error', events)
        mock_store_err.assert_called_once()
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_jobs.SpacetimeColdStartTaskShellTest -v 2
```

Expected: FAIL: the existing stub from Stage 2 returns `{'status': 'stub', ...}` and ignores the pipeline.

**Implementation**:

Replace the stub `spacetime_cold_start_task` in `apps/notebook/tasks.py` with the full shell. Find the block added in Task 2.2 and overwrite:

```python
@django_rq.job('default', timeout=120)
def spacetime_cold_start_task(
    spacetime_job_id: str,
    query: str,
    canonical_key: str,
    mode: str | None = None,
    force: bool = False,
):
    """Run the spacetime cold-start pipeline and stream events.

    The pipeline body lives in apps.notebook.services.spacetime_pipeline
    (filled in by Stage 4). This shell handles event lifecycle:
      - publish pipeline_start
      - call _run_spacetime_pipeline
      - on success: store_result + publish_event('complete', ...)
      - on exception: store_error + publish_event('error', ...)

    The shell is a thin wrapper so the pipeline body can stay testable
    without RQ in the loop.
    """
    from apps.notebook.services import spacetime_jobs

    spacetime_jobs.publish_event(
        spacetime_job_id,
        'stage',
        {'name': 'pipeline_start', 'query': query},
    )

    try:
        result = _run_spacetime_pipeline(
            spacetime_job_id=spacetime_job_id,
            query=query,
            canonical_key=canonical_key,
            mode=mode,
            force=force,
        )
    except Exception as exc:
        logger.error('spacetime_cold_start_task failed: %s', exc, exc_info=True)
        spacetime_jobs.store_error(spacetime_job_id, str(exc))
        spacetime_jobs.publish_event(
            spacetime_job_id, 'error', {'message': str(exc)},
        )
        return {'status': 'error', 'error': str(exc)}

    spacetime_jobs.store_result(spacetime_job_id, result)
    spacetime_jobs.publish_event(spacetime_job_id, 'complete', result)
    return {'status': 'complete', 'spacetime_job_id': spacetime_job_id}


def _run_spacetime_pipeline(
    *,
    spacetime_job_id: str,
    query: str,
    canonical_key: str,
    mode: str | None,
    force: bool,
) -> dict:
    """Indirection so unit tests can patch the pipeline body cheaply.

    Filled in by Stage 4 (apps.notebook.services.spacetime_pipeline).
    For Stage 3 we return an empty SpacetimeTopic so the shell tests
    can run end-to-end without the heavy retrieval / Modal / 26B path.
    """
    try:
        from apps.notebook.services.spacetime_pipeline import run_pipeline
        return run_pipeline(
            spacetime_job_id=spacetime_job_id,
            query=query,
            canonical_key=canonical_key,
            mode=mode,
            force=force,
        )
    except ImportError:
        # Stage 4 has not landed yet; return an empty payload so the
        # endpoint contract still works during development.
        return {
            'key': canonical_key,
            'title': query,
            'sub': '',
            'sources': 0,
            'span': [0, 0],
            'events': [],
            'trace': [],
            'mode': mode or 'modern',
        }
```

Then in `apps/notebook/api/spacetime.py`, delete the `_stub_make_job_id` definition and replace every call site with `spacetime_jobs.make_job_id()`. Add the import at the top of the imports block:

```python
from apps.notebook.services import spacetime_jobs
```

The two call sites (in `_enqueue_background_rebake` and `_begin_cold_start`) become:

```python
spacetime_cold_start_task.delay(
    spacetime_job_id=spacetime_jobs.make_job_id(),
    ...
)
```

**Verify**:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_jobs.SpacetimeColdStartTaskShellTest apps.notebook.tests.test_spacetime_api -v 2
```

Expected: shell tests PASS; existing API tests still PASS.

**Commit**: `feat(spacetime): real cold-start task shell + drop stub job-id helper`

**Delegate to**: django-engine-pro

---

### Task 3.4: End-to-end stub stream verification

**Files**:
- Modify: `Index-API/apps/notebook/tests/test_spacetime_api.py`

**Test first**: append:

```python
class EndToEndStubStreamTest(TestCase):
    """Confirms POST /topic/ -> task runs sync (eager mode) -> GET /stream/
    replays the stored result. With the Stage 3 stub pipeline body, the
    payload is the empty SpacetimeTopic shape from `_run_spacetime_pipeline`'s
    fallback branch. Stages 4-7 flesh out the events.
    """
    def test_post_then_stream_completes(self):
        # Patch RQ so the task runs synchronously in the test process.
        from django_rq.queues import get_queue
        queue = get_queue('default')
        prior = queue.connection.connection_pool

        with patch(
            'django_rq.queues.get_queue',
        ) as mock_q, patch(
            'apps.notebook.services.spacetime_jobs._get_redis',
        ) as mock_redis:
            # Run the task body inline: stub the .delay() call to invoke
            # the underlying function directly with no Redis or RQ.
            from apps.notebook.tasks import spacetime_cold_start_task
            captured = {}

            def fake_delay(**kwargs):
                # Simulate the task running and storing the result.
                captured.update(kwargs)
                return spacetime_cold_start_task(**kwargs)

            spacetime_cold_start_task.delay = fake_delay  # type: ignore[attr-defined]

            # Mock redis as an in-memory dict for store/fetch.
            store: dict[str, str] = {}
            r = MagicMock()
            r.setex = lambda k, ttl, v: store.__setitem__(k, v)
            r.get = lambda k: store.get(k)
            r.publish = lambda k, v: None
            r.rpush = lambda *a, **kw: None
            r.expire = lambda *a, **kw: None
            r.lrange = lambda *a, **kw: []
            mock_redis.return_value = r

            resp = Client().post(
                '/api/v2/theseus/spacetime/topic/',
                data=json.dumps({'query': 'novel cold start topic'}),
                content_type='application/json',
            )
            self.assertEqual(resp.status_code, 202, resp.content)
            envelope = resp.json()
            job_id = envelope['job_id']

            # Stream replay should now find the stored result.
            stream_resp = Client().get(envelope['stream_url'])
            content = b''.join(stream_resp.streaming_content).decode()
            self.assertIn('event: complete', content)
```

Add the missing import: `from unittest.mock import MagicMock`.

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.EndToEndStubStreamTest -v 2
```

Expected: PASS. (If RQ-eager-mode integration is brittle here, flag it; the mock harness is enough to confirm the wiring without spawning a real worker.)

**Implementation**: none beyond Task 3.3.

**Commit**: `test(spacetime): end-to-end POST -> SSE replay round trip`

**Delegate to**: django-engine-pro

---

## Stage exit criteria

- All 4 tasks marked `[done]`.
- Stage-scoped integration test:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_jobs apps.notebook.tests.test_spacetime_api -v 2
```

Expected: every test PASS.

- The stub pipeline body returns an empty `SpacetimeTopic`; the SSE relay forwards `complete` correctly.

## Handoff to next stage

After Stage 3 the following are available:
- `apps.notebook.services.spacetime_jobs` with `make_job_id`, `channel_name`, `result_key`, `stages_key`, `publish_event`, `record_stage`, `fetch_stages`, `store_result`, `store_error`, `fetch_result`, `fetch_status`.
- `GET /api/v2/theseus/spacetime/stream/<job_id>/` SSE relay.
- `apps.notebook.tasks.spacetime_cold_start_task` shell that calls `_run_spacetime_pipeline` and handles success / failure event lifecycle.
- The pipeline body (`apps.notebook.services.spacetime_pipeline.run_pipeline`) is the only remaining seam; Stages 4-7 fill it in.
