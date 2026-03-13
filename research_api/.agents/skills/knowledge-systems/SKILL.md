---
name: knowledge-systems
description: Use for CommonPlace and research_api architecture work: connection engine, compose engine, graph rules, resurfacing, clustering, claims, and other notebook-side knowledge-system behavior. Treat source code as authoritative.
---

# Knowledge Systems

Use this skill when the task applies scientific techniques to the CommonPlace or `research_api` knowledge graph.

Read the relevant notebook-side files before editing:
- `apps/notebook/engine.py`
- `apps/notebook/compose_engine.py`
- `apps/notebook/models.py`
- `apps/notebook/views.py`
- `apps/notebook/resurface.py`

Rules:
- `apps/research/*` and `apps/notebook/*` are related but not interchangeable.
- `engine.py` writes graph state; `compose_engine.py` returns live suggestions only.
- Preserve `Edge.reason`, `from_object` / `to_object`, append-only timeline behavior, and notebook-scoped config.
- If specs conflict with code, document the conflict and follow the code.
