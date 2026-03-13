# CommonPlace: Self-Organizing Knowledge System

> Full spec in repository. See SELF-ORGANIZING-SPEC.md for complete code.
> Builds on ENGINE-UPGRADE-SPEC.md (dependency).

## The Law Firm Test

Benchmark: dump hundreds of mixed documents, system organizes them
into cases, connects entities, surfaces contradictions, traces lineage.

Current state: ~40% there. Engine intelligence exists. Missing the
self-organizing layer that restructures the graph automatically.

## Five Feedback Loops

1. **Auto-Classification** - Infer ObjectType from content features
2. **Community Formation** - Clusters become Notebooks automatically
3. **Entity Promotion** - Frequent mentions become first-class Objects
4. **Edge Evolution** - Decay unused connections, reinforce engaged ones
5. **Emergent Type Detection** - Suggest new types from cluster patterns

## Implementation Order

1. Batch 13: Auto-Classification
2. Batch 12: Bulk Ingestion Pipeline
3. Batch 14: Cluster-Driven Auto-Organization (flagship)
4. Batch 15: Provenance Tracing (idea genealogy)
5. Batch 16: Structured Report Generation

## Infrastructure

Switch to custom Dockerfiles for reliable PyTorch/Tesseract/spaCy builds.
Split RQ worker into its own Railway service.
Keep Modal for GPU jobs.
