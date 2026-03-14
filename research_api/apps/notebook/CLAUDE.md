# CommonPlace Notebook App

Django app providing the knowledge graph backend for CommonPlace (`/commonplace`).

## Models (12)

ObjectType, Object, ComponentType, Component, Timeline, Node, Edge, ResolvedEntity, DailyLog, Notebook, Project, Layout

## Key Contracts

- **Nodes are append-only.** Only mutable field: `retrospective_notes`. Use `Node.objects.filter(pk=...).update(retrospective_notes=...)`.
- **Edge.reason must be a plain-English sentence** explaining *why*, not a keyword list.
- **`_generate_sha()`** in models.py creates all SHA hashes. Never reuse a SHA.
- **All timestamps use `django.utils.timezone`**. Never use `datetime.now()`.
- **Master Timeline** (`is_master=True`) must always exist. Use `get_or_create`.
- **Soft-delete only.** Objects have `is_deleted` flag. Never hard-delete.

## API Layer

11 ViewSets (ObjectType, ComponentType, Object, Component, Node, Edge, Notebook, Project, Timeline, Layout, DailyLog) + 6 custom endpoints (capture, feed, graph, resurface, object export, notebook export).

All endpoints live under `/api/v1/notebook/` and are exempt from APIKeyMiddleware (added to `EXEMPT_PREFIXES`).

## Connection Engine

`engine.py`: Three-pass spaCy NER pipeline (entity extraction, shared entity edges, topic similarity via Jaccard). Run with:

```bash
python3 manage.py run_connection_engine        # Process inbox + active nodes
python3 manage.py run_connection_engine --all  # Process all nodes
python3 manage.py run_connection_engine --dry-run
```

## Other Commands

```bash
python3 manage.py seed_commonplace            # Seed ObjectTypes + ComponentTypes + master Timeline
python3 manage.py create_sample_data          # Create ~15 sample Objects
python3 manage.py create_sample_data --clean  # Clean + create samples
```

## Key Files

| File | Purpose |
|------|---------|
| `models.py` | 12 models with SHA hashing, soft-delete, component system |
| `engine.py` | spaCy NER connection engine (3-pass) |
| `bm25.py` | BM25 keyword scoring for connection explanations |
| `services.py` | `enrich_url()` OG metadata, `quick_capture()` object creation |
| `signals.py` | DailyLog auto-population via post_save |
| `serializers.py` | DRF serializers for all 12 models |
| `views.py` | ViewSets + custom endpoints |

## Build History

Original build spec preserved at `docs/plans/commonplace-backend-build-spec.md`.
