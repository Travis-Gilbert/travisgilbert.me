# Research API: Engine Upgrade Specification

> **For Claude Code. One batch per session. Read entire spec before writing code.**
> **Read every file listed under "Read first" before writing a single line.**
> **Test after every batch. Do not proceed if tests fail.**

---

## Architecture Overview

The connection engine currently runs a seven-pass pipeline in
`apps/notebook/engine.py`. This spec upgrades individual passes
and adds post-pass intelligence layers. All changes are additive:
existing passes continue to work. New passes fail silently when
dependencies are unavailable (two-mode deployment contract).

```
CURRENT STATE                         TARGET STATE
=============                         ============
Pass 1: spaCy NER (fixed vocab)  ->  Pass 1: Adaptive NER (graph-learned + spaCy)
Pass 2: Shared entity edges       ->  Pass 2: Shared entity edges (unchanged)
Pass 3: Jaccard keyword overlap   ->  Pass 3: BM25 unified lexical (replaces 3+4)
Pass 4: TF-IDF corpus            ->  (merged into Pass 3)
Pass 5: SBERT semantic           ->  Pass 4: Instruction-tuned SBERT (E5/Nomic)
Pass 6: NLI stance               ->  Pass 5: Claim-level NLI stance detection
Pass 7: KGE structural           ->  Pass 6: Temporal KGE (DE-SimplE)
(none)                            ->  Pass 7: Causal inference (DAG construction)

POST-PASS INTELLIGENCE (new)
  Community detection (Louvain/Leiden on notebook graph)
  Gap analysis (structural holes between clusters)
  Temporal evolution (sliding-window graph dynamics)
  Synthesis engine (LLM cluster summaries)
```

Two-mode deployment contract (NEVER BREAK THIS):
- PRODUCTION (Railway): spaCy + BM25. No PyTorch.
- LOCAL/DEV: All passes active. PyTorch + FAISS + sentence-transformers.
- MODAL (GPU): Heavy NLP jobs dispatched via Modal serverless functions.

See the full spec in the repository file for complete batch details.

---

## Implementation Order

1. **Batch 3:** Model migrations (Edge types, Cluster, Claim)
2. **Batch 1:** Adaptive NER (graph-learned PhraseMatcher)
3. **Batch 2:** BM25 unified lexical pass
4. **Batch 8:** Community detection (Louvain)
5. **Batch 9:** Gap analysis (structural holes)
6. **Batch 4:** Instruction-tuned SBERT (E5/Nomic)
7. **Batch 5:** Claim-level NLI stance detection
8. **Batch 7:** Causal inference engine
9. **Batch 6:** Temporal KGE (DE-SimplE)
10. **Batch 10-11:** Temporal evolution + synthesis
