# Codex Operating Model

This repo has three inputs:
- code in `research_api` is the working truth
- `scipy-pro-v3-spec.md` describes the intended operating philosophy
- `ENGINE-UPGRADE-SPEC.md` describes the batch roadmap

Codex should resolve disagreements by reading the code first, then updating status/docs to match reality.

Routing:
- Scientific Python for algorithms, embeddings, parsing, and visualization
- Knowledge Systems for notebook graph behavior, compose, resurfacing, clustering, claims, and engine work
- Product & Ops for API and deployment/runtime constraints

Engine work rules:
- use repo-root `ENGINE-UPGRADE-SPEC.md`
- read each batch's `Read first` files before editing
- do one batch per session
- run tests after the batch

Historical note:
- `apps/notebook/ENGINE-CLAUDE.md` and `apps/notebook/ENGINE-UPGRADE-SPEC.md` are legacy references, not the source of truth
