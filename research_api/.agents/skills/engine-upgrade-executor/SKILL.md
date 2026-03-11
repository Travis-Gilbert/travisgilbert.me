---
name: engine-upgrade-executor
description: Use for ENGINE-UPGRADE-SPEC.md batch work in research_api. Read every file in the batch's Read first section before editing, execute one batch per session, and update status from actual code and test results.
---

# Engine Upgrade Executor

Use this skill for roadmap batches from repo-root `ENGINE-UPGRADE-SPEC.md`.

Workflow:
1. Read the entire repo-root `ENGINE-UPGRADE-SPEC.md`.
2. Read every file named in the current batch's `Read first` section.
3. Audit the code before assuming the batch is pending or complete.
4. Execute exactly one batch in the session.
5. Run relevant tests after the batch and stop if they fail.
6. Update `docs/engine-upgrade-status.md` from actual code and validation, not stale notes.

Rules:
- Prefer the repo-root engine spec over historical notebook-local copies.
- Keep changes surgical.
- Preserve the two-mode deployment contract.
