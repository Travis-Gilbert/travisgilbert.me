# Research API Codex Operating Guide

Use source code as the authority. Specs explain intent and roadmap; if a spec and code disagree, read the code and reconcile the difference explicitly before editing.

Route work by tier:
- Tier 1: Scientific Python. General NLP, embeddings, BM25, FAISS, graph algorithms, file parsing, visualization.
- Tier 2: Knowledge Systems. CommonPlace and `research_api` engine behavior, graph structure, compose flow, resurfacing, clustering.
- Tier 3: Product & Ops. Django APIs, Railway, Redis/RQ, S3, Modal, requirements, deployment constraints.

Before editing:
- Read the files most directly involved in the task.
- For engine roadmap work, read every file listed in that batch's `Read first` section.
- Prefer surgical changes over rewrites.

Non-negotiable project rules:
- `apps/notebook/engine.py` persists graph changes. `apps/notebook/compose_engine.py` is stateless.
- `Edge` uses `from_object` and `to_object`.
- `Edge.reason` stays plain English.
- Timeline history is append-only.
- Objects soft-delete.
- SHA lineage and current source models must not be bypassed.

Two-mode deployment contract:
- Production/Railway must not require PyTorch-only features to function.
- Local/dev may use the full NLP stack.
- Heavy jobs may dispatch to Modal.

Engine-upgrade discipline:
- One engine batch per session.
- Run relevant tests after the batch and stop if they fail.

Progress report format:
- Initial condition
- Reconciliation findings
- Changes made
- Validation performed
- Remaining issues / next steps
