---
name: scientific-python-core
description: Use for scientific Python work in or around research_api, including NLP, embeddings, BM25, FAISS, graph algorithms, file parsing, and visualization. Read the local implementation before relying on memory or external docs.
---

# Scientific Python Core

Use this skill when the task is primarily about a technique, model, algorithm, or parsing pipeline.

Read the local implementation first:
- `apps/research/advanced_nlp.py`
- `apps/notebook/bm25.py`
- `apps/notebook/vector_store.py`
- `apps/notebook/file_ingestion.py`
- `apps/notebook/pdf_ingestion.py`
- `apps/notebook/canvas_engine.py`

Rules:
- Prefer repo code over memory.
- Keep production-safe and PyTorch-only paths distinct.
- Preserve plain-English explanations when output is user-facing.
- If the work is an engine roadmap batch, follow `engine-upgrade-executor`.
