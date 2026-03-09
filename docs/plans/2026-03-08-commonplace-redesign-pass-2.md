# CommonPlace Redesign: Pass 2 (Advanced Features)

> Compose + Live Research Graph, drag animation, hunch schematics,
> entity chips, contextual retrospectives, graph frames, clustering, tensions.
> Full spec delivered as COMMONPLACE_PASS_2.md artifact.

## Batch Summary

| Batch | What | Key Files |
|---|---|---|
| 7 | Compose view + Live Research Graph (SBERT/KGE/TF-IDF primary, NLI toggle) | `ComposeView.tsx` (REWRITE), `LiveResearchGraph.tsx` (NEW), `useLiveResearch.ts` (NEW), `compose_engine.py` (NEW) |
| 8 | Hunch schematic sketch (rough.js canvas drawing tool) | `HunchSketch.tsx` (NEW) |
| 9 | Drag-and-drop capture particle animation (framer-motion) | `DropZone.tsx` (EDIT) |
| 10 | Contextual retrospective prompts (triggered by events, not periodic) | `RetroNote.tsx` (REWRITE) |
| 11 | Graph frame thumbnails (canvas.toDataURL visual bookmarks) | `FrameManager.tsx` (EDIT) |
| 12 | Connection strength clustering in masonry grid | `GridView.tsx` (EDIT) |
| 13 | Tension highlighting (amber visual language throughout) | `TensionBadge.tsx` (NEW), `KnowledgeMap.tsx` (EDIT), `ObjectDrawer.tsx` (EDIT) |

## New Dependencies

```bash
npm install framer-motion
```

## Critical Design Decision: Live Graph Engine Priority

Travis's strong opinion: the primary value in the Compose Live Graph comes
from SBERT semantic, KGE structural, and TF-IDF passes. NER entity matching
is supplementary, not primary. NLI (contradiction/support) is a toggleable
option, off by default.

Backend compose endpoint runs: TF-IDF > SBERT > KGE > NER (supplementary) > NLI (optional)
Debounce: 1200ms (higher than 800ms because SBERT is slower)
Latency target: under 500ms for passes 1-4 using pre-computed indexes

## Implementation Order

Batch 7 > 8 (independent) > 9 (independent) > 10 > 11 > 12 > 13
