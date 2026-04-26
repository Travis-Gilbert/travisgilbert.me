# Stage 0: Foundation: models, migration, middleware, inbox notebook

_Part of multi-file plan. See [implementation-plan.md](implementation-plan.md) for the index._

## Overview

Stage 0 lays the groundwork that every other stage relies on: two new Django models (`SpacetimeTopicCache` and `SpacetimeQueryLog`), the migration that creates them, the APIKeyMiddleware exemption that makes `/api/v2/theseus/spacetime/` publicly accessible, and a management command that idempotently creates the "Spacetime Inbox" Notebook for cold-start objects. Nothing in this stage talks to Redis, Modal, or the 26B; it is pure Django persistence and routing config.

## Prerequisites

- Previous stage: none. This is Stage 0.
- Required state at entry: clean `Index-API` working tree on `main`. The repo is the separate Django backend at `/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/`.
- pgvector is already installed (`apps.notebook.models.graph.Embedding` uses it).
- `apps.notebook.models.organization.Notebook` exists and accepts the fields used in `seed_spacetime_inbox`.

## Files this stage touches

```
Index-API/
├── apps/notebook/models/spacetime.py                                     # NEW
├── apps/notebook/models/__init__.py                                      # MOD
├── apps/notebook/migrations/0098_spacetime_cache_and_querylog.py         # NEW
├── apps/notebook/management/commands/seed_spacetime_inbox.py             # NEW
├── apps/notebook/tests/test_seed_spacetime_inbox.py                      # NEW
├── apps/notebook/tests/__init__.py                                       # ensure exists
└── apps/api/middleware.py                                                # MOD: extend PUBLIC_READ_PREFIXES
```

## Tasks

### Task 0.1: Add `SpacetimeTopicCache` and `SpacetimeQueryLog` models

**Files**:
- Create: `Index-API/apps/notebook/models/spacetime.py`

**Test first**: This task is pure model definition. Validation of the model shape happens in Task 0.3 once the migration exists. Skip the test step here; the migration test in Task 0.3 will fail if these classes are wrong.

**Implementation**:

Write `apps/notebook/models/spacetime.py`:

```python
"""Spacetime Atlas backend models.

SpacetimeTopicCache stores baked SpacetimeTopic JSON keyed by canonical
slug, with a 384d title embedding for SBERT-based resolver fallback.
SpacetimeQueryLog records every resolved query for observability and
the spacetime_coverage IQ axis.

See docs/plans/2026-04-25-spacetime-backend-design/design-doc.md for
the full schema rationale.
"""
from __future__ import annotations

from django.contrib.postgres.fields import ArrayField
from django.db import models
from pgvector.django import VectorField

from apps.core.models import TimeStampedModel


class SpacetimeTopicCache(TimeStampedModel):
    """Baked SpacetimeTopic, keyed by canonical slug.

    Sync cache hit returns payload_json verbatim. Stale-but-extant entries
    (older than seven days) still return their payload but trigger a
    background re-bake. Deleting an Object that contributed to a cached
    topic invalidates that cache entry via the post_delete signal.
    """

    MODE_MODERN = 'modern'
    MODE_PREHISTORY = 'prehistory'
    MODE_CHOICES = (
        (MODE_MODERN, 'Modern'),
        (MODE_PREHISTORY, 'Prehistory'),
    )

    canonical_key = models.SlugField(
        max_length=200,
        unique=True,
        db_index=True,
        help_text='slugify(query) result; the resolver ladder collapses queries onto this.',
    )

    title = models.CharField(max_length=200)
    sub = models.CharField(max_length=300)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default=MODE_MODERN)
    sources = models.IntegerField(default=0)
    span_min = models.FloatField()
    span_max = models.FloatField()

    payload_json = models.JSONField(
        help_text='Full SpacetimeTopic shape. Returned verbatim on cache hit.',
    )
    title_embedding = VectorField(
        dimensions=384,
        null=True,
        blank=True,
        help_text='SBERT MiniLM-L6-v2 embedding of the title for resolver step 4.',
    )

    object_ids = ArrayField(
        models.IntegerField(),
        default=list,
        blank=True,
        help_text='Object PKs that contributed to this cached topic. Drives invalidation.',
    )
    last_baked_at = models.DateTimeField(auto_now_add=True)
    bake_duration_ms = models.IntegerField(default=0)
    bake_count = models.IntegerField(default=1)

    class Meta:
        app_label = 'notebook'
        ordering = ['-last_baked_at']
        indexes = [
            models.Index(fields=['canonical_key'], name='idx_st_cache_key'),
            models.Index(fields=['-last_baked_at'], name='idx_st_cache_baked'),
        ]

    def __str__(self) -> str:
        return f'SpacetimeTopicCache({self.canonical_key})'


class SpacetimeQueryLog(TimeStampedModel):
    """One row per resolved query. Powers spacetime_coverage IQ + p50/p95.

    cache_hit=True covers resolver steps 1-4 (any prebaked match).
    cache_hit=False means the cold-start pipeline ran (resolver step 5).
    The terminal stage in stages_completed tells us where cold-starts get
    stuck.
    """

    RESOLVER_STEP_CHOICES = (
        ('slug', 'Slug exact match'),
        ('title', 'Title case-insensitive'),
        ('substring', 'Substring overlap'),
        ('sbert', 'SBERT cosine fallback'),
        ('cold_start', 'Cold-start pipeline'),
    )

    query = models.CharField(max_length=500)
    canonical_key = models.SlugField(max_length=200, db_index=True)
    resolver_step = models.CharField(max_length=20, choices=RESOLVER_STEP_CHOICES)
    cache_hit = models.BooleanField(db_index=True)
    stages_completed = ArrayField(
        models.CharField(max_length=30),
        default=list,
        blank=True,
        help_text='Pipeline stages that finished. Empty on cache hit.',
    )
    duration_ms_per_stage = models.JSONField(
        default=dict,
        blank=True,
        help_text='{"graph_search": 1820, "web_acquisition": 7400, ...}',
    )
    cluster_count = models.IntegerField(null=True, blank=True)
    web_objects_added = models.IntegerField(default=0)
    error = models.TextField(blank=True)

    class Meta:
        app_label = 'notebook'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at'], name='idx_st_qlog_recent'),
            models.Index(fields=['canonical_key', '-created_at'], name='idx_st_qlog_key'),
            models.Index(fields=['cache_hit', '-created_at'], name='idx_st_qlog_hit'),
        ]

    def __str__(self) -> str:
        return f'SpacetimeQueryLog({self.query[:60]!r} -> {self.resolver_step})'
```

**Verify**: file exists. No command run yet (the migration in Task 0.3 will exercise the imports).

**Commit**: `feat(spacetime): add SpacetimeTopicCache and SpacetimeQueryLog models`

**Delegate to**: django-engine-pro

---

### Task 0.2: Re-export new models from `apps.notebook.models.__init__`

**Files**:
- Modify: `Index-API/apps/notebook/models/__init__.py`

**Test first**: skip; the import smoke at end-of-stage covers this.

**Implementation**:

Append the import block to `apps/notebook/models/__init__.py` immediately after the `from .place import (...)` block (around line 146):

```python
from .spacetime import (  # noqa: F401
    SpacetimeQueryLog,
    SpacetimeTopicCache,
)
```

Then add `'SpacetimeQueryLog'` and `'SpacetimeTopicCache'` to the `__all__` list (which begins around line 152). Insert them alphabetically, e.g. after `'ResolvedEntity'` and before `'TemporalTension'` so the list stays sorted.

**Verify**: run

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 -c "import django; django.setup(); from apps.notebook.models import SpacetimeTopicCache, SpacetimeQueryLog; print(SpacetimeTopicCache, SpacetimeQueryLog)"
```

Expected: prints both class repr lines without error.

**Commit**: `feat(spacetime): re-export spacetime models from notebook package`

**Delegate to**: django-engine-pro

---

### Task 0.3: Migration for the two new models

**Files**:
- Create: `Index-API/apps/notebook/migrations/0098_spacetime_cache_and_querylog.py`

**Test first**: the migration self-validates via `makemigrations --check`. Use that as the test:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py makemigrations --dry-run --check apps.notebook
```

Expected before this task: `Migrations for 'notebook': ... 0098_*.py - Create model SpacetimeQueryLog ... Create model SpacetimeTopicCache`. Failure mode: the model definitions are inconsistent and Django reports a different migration shape.

**Implementation**:

Generate the real migration:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py makemigrations notebook --name spacetime_cache_and_querylog
```

The autogenerated file should be `apps/notebook/migrations/0098_spacetime_cache_and_querylog.py`. Open it and confirm:
- It depends on the previous migration (`('notebook', '0097_conversation_object_type')`).
- It creates `SpacetimeTopicCache` and `SpacetimeQueryLog` with the exact field set from Task 0.1.
- It includes the three indexes on each table.
- It uses `pgvector.django.VectorField` and `django.contrib.postgres.fields.ArrayField`.

If autogen produced unexpected operations, delete the file and re-run after fixing the model. Do not hand-edit unless absolutely necessary; if you do, keep `dependencies` and the index `name=` strings exactly as listed in Task 0.1.

**Verify**: run

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py makemigrations --check && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py migrate notebook 0098_spacetime_cache_and_querylog --plan
```

Expected: `--check` exits 0 (no further migrations needed). `--plan` lists exactly one operation: `notebook.0098_spacetime_cache_and_querylog`.

**Commit**: `feat(spacetime): migration for SpacetimeTopicCache and SpacetimeQueryLog`

**Delegate to**: django-engine-pro

---

### Task 0.4: Exempt `/api/v2/theseus/spacetime/` from APIKeyMiddleware

**Files**:
- Modify: `Index-API/apps/api/middleware.py` (replace the `PUBLIC_READ_PREFIXES` tuple, currently lines 27-32)

**Test first**: write a unit test at `Index-API/apps/notebook/tests/test_spacetime_api.py` (this same file also receives endpoint tests in Stages 2-3, this is the first slice):

```python
"""Tests for the spacetime API middleware exemption.

The spacetime endpoints must be publicly accessible (same as /ask/async/)
so the frontend can post a query without an API key. This test pins the
PUBLIC_READ_PREFIXES tuple so the entry isn't accidentally removed.
"""
from django.test import TestCase

from apps.api.middleware import EXEMPT_PREFIXES, PUBLIC_READ_PREFIXES


class SpacetimeMiddlewareExemptionTest(TestCase):
    def test_spacetime_prefix_is_publicly_readable(self):
        self.assertIn('/api/v2/theseus/spacetime/', PUBLIC_READ_PREFIXES)

    def test_spacetime_prefix_inherits_into_exempt_prefixes(self):
        self.assertIn('/api/v2/theseus/spacetime/', EXEMPT_PREFIXES)
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.SpacetimeMiddlewareExemptionTest -v 2
```

Expected: both tests FAIL with `AssertionError: '/api/v2/theseus/spacetime/' not found in (...)` (the prefix is not yet listed).

**Implementation**:

Edit `apps/api/middleware.py`. Replace the `PUBLIC_READ_PREFIXES` tuple (currently lines 27-32) with the version that includes the spacetime entry:

```python
# Route boundary matrix
# - Public research reads remain open.
# - Workspace/epistemic routes are currently open (no API key required).
# - Internal machine routes keep their own auth contracts.
PUBLIC_READ_PREFIXES = (
    '/api/v1/trail/',
    '/api/v1/connections/',
    '/api/v1/graph/',
    '/api/v1/sources/',
    '/api/v2/theseus/spacetime/',
)
```

Do not touch any other tuple in this file.

**Verify**: re-run the two tests:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_spacetime_api.SpacetimeMiddlewareExemptionTest -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): exempt /api/v2/theseus/spacetime/ from APIKeyMiddleware`

**Delegate to**: django-engine-pro

---

### Task 0.5: Spacetime Inbox notebook seeder management command

**Files**:
- Create: `Index-API/apps/notebook/management/commands/seed_spacetime_inbox.py`
- Create: `Index-API/apps/notebook/tests/test_seed_spacetime_inbox.py`

**Test first**: write the test file:

```python
"""Tests for the seed_spacetime_inbox management command.

The command must be idempotent: running it twice yields exactly one
Notebook with the canonical slug. We pin both the slug and the
is_auto_generated flag because downstream code (cold-start pipeline)
relies on filtering by slug.
"""
from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.notebook.models import Notebook


class SeedSpacetimeInboxTest(TestCase):
    def test_first_run_creates_notebook(self):
        out = StringIO()
        call_command('seed_spacetime_inbox', stdout=out)

        nb = Notebook.objects.get(slug='spacetime-inbox')
        self.assertEqual(nb.name, 'Spacetime Inbox')
        self.assertTrue(nb.is_auto_generated)
        self.assertIn('Created', out.getvalue())

    def test_second_run_is_idempotent(self):
        call_command('seed_spacetime_inbox')
        call_command('seed_spacetime_inbox')
        self.assertEqual(
            Notebook.objects.filter(slug='spacetime-inbox').count(), 1
        )
```

Run:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_seed_spacetime_inbox -v 2
```

Expected: both tests FAIL with `Unknown command: 'seed_spacetime_inbox'`.

**Implementation**:

Write `apps/notebook/management/commands/seed_spacetime_inbox.py`:

```python
"""Idempotently create the Spacetime Inbox notebook.

The cold-start pipeline pins all Firecrawl-acquired Objects to this
notebook so a curator can audit them in one place. Running this command
twice is a no-op: the canonical slug is `spacetime-inbox`.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.notebook.models import Notebook


SPACETIME_INBOX_SLUG = 'spacetime-inbox'
SPACETIME_INBOX_NAME = 'Spacetime Inbox'


class Command(BaseCommand):
    help = 'Create or update the Spacetime Inbox notebook used by cold-start ingestion.'

    @transaction.atomic
    def handle(self, *args, **options):
        nb, created = Notebook.objects.get_or_create(
            slug=SPACETIME_INBOX_SLUG,
            defaults={
                'name': SPACETIME_INBOX_NAME,
                'description': (
                    'Auto-curated home for objects ingested by the spacetime '
                    'cold-start pipeline. Filter by geom_source='
                    "'spacetime_cold_start' to recover or audit a batch."
                ),
                'color': '#2D5F6B',
                'icon': 'globe',
                'is_active': True,
                'is_auto_generated': True,
                'sort_order': 999,
                'engine_config': {},
                'available_types': [],
                'default_layout': {},
                'theme': {},
                'context_behavior': {},
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(
                f'Created Notebook {nb.slug!r} (pk={nb.pk}).'
            ))
        else:
            self.stdout.write(
                f'Notebook {nb.slug!r} already exists (pk={nb.pk}); no changes.'
            )
```

**Verify**: re-run the test:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 manage.py test apps.notebook.tests.test_seed_spacetime_inbox -v 2
```

Expected: 2 PASS.

**Commit**: `feat(spacetime): seed_spacetime_inbox idempotent management command`

**Delegate to**: django-engine-pro

---

## Stage exit criteria

- All 5 tasks marked `[done]`.
- Foundation integration smoke passes:

```bash
cd /Users/travisgilbert/Tech\ Dev\ Local/Creative/Website/Index-API && \
DJANGO_SETTINGS_MODULE=config.settings python3 -c "import django; django.setup(); from apps.notebook.models import SpacetimeTopicCache, SpacetimeQueryLog, Notebook; print(SpacetimeTopicCache._meta.db_table, SpacetimeQueryLog._meta.db_table)"
```

Expected: prints `notebook_spacetimetopiccache notebook_spacetimequerylog`.

- `python3 manage.py test apps.notebook.tests.test_spacetime_api.SpacetimeMiddlewareExemptionTest apps.notebook.tests.test_seed_spacetime_inbox` is GREEN.

## Handoff to next stage

After Stage 0 the following are available:
- `apps.notebook.models.SpacetimeTopicCache` (canonical_key, payload_json, title_embedding, object_ids).
- `apps.notebook.models.SpacetimeQueryLog`.
- Migration `0098_spacetime_cache_and_querylog` applied.
- `python3 manage.py seed_spacetime_inbox` creates the canonical inbox notebook.
- `/api/v2/theseus/spacetime/` is in `PUBLIC_READ_PREFIXES` (the router will be wired in Stage 2).
