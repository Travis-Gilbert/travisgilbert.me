# Engine Upgrade Status

Current status is based on code audit, not spec claims.

| Batch | Status | Notes |
| --- | --- | --- |
| 1. Adaptive NER | Complete | `adaptive_ner.py` is live and wired into `engine.py` and `signals.py`. |
| 2. BM25 unified lexical | Complete | `bm25.py` replaces the old lexical path in the notebook engine. |
| 3. Edge/model migrations | Complete | `Cluster`, `Claim`, `Object.cluster`, and new edge metadata exist in models and migration `0006`. |
| 4. Instruction-tuned SBERT | Partial | SBERT + FAISS exist, but the instruction-tuned upgrade and deployment cleanup are still pending. |
| 5. Claim-level NLI | Pending | Claim schema exists; claim-level runtime does not. |
| 6. Temporal KGE | Pending | Static RotatE/KGE runtime exists; temporal KGE does not. |
| 7. Causal inference | Pending | Edge type exists; causal runtime does not. |
| 8. Community detection | Complete | `apps/notebook/community.py` and `detect_communities` command are live and covered by notebook tests. |
| 9. Gap analysis | Pending | Depends on Batch 8 output. |
| 10-11. Temporal evolution + synthesis | Pending | No notebook runtime modules yet. |

Known reconciliation notes:
- `scipy-pro-v3-spec.md` overstates Batch 4 completion.
- `apps/notebook/ENGINE-CLAUDE.md` and `apps/notebook/ENGINE-UPGRADE-SPEC.md` describe older intermediate states and should not be treated as current truth.
