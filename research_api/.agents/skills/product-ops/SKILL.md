---
name: product-ops
description: Use for product and operational work in research_api: Django API surfaces, requirements, Railway, Redis/RQ, S3, Modal, and deployment constraints. Keep the two-mode deployment contract intact.
---

# Product Ops

Use this skill for API, runtime, and deployment work.

Read the local source first:
- `config/settings.py`
- `requirements/base.txt`, `requirements/local.txt`, `requirements/production.txt`
- `railway.toml`
- `Procfile`
- `apps/notebook/tasks.py`
- `apps/notebook/services.py`

Rules:
- Production must keep working without PyTorch-only paths.
- Local/dev may expose the full NLP stack.
- Heavy jobs may move to Modal instead of the web or worker runtime.
- Avoid changing public API shapes unless the task explicitly requires it.
