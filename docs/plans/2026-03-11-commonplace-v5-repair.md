# CommonPlace v5: Integration Repair Spec

> **For Claude Code (use OPUS). Read entire spec before writing code.**

## Problem

The v5 redesign created new components but failed to integrate them. New polymorphic renderers exist in `objects/` but old views still use the 19KB `ObjectCard.tsx` monolith. Library is not the default. Tab bars are still cream. Construction grid is missing.

## Batches

```
Batch 1: Replace ObjectCard with ObjectRenderer in GridView, TimelineView, LooseEndsView, ResurfaceView
Batch 2: Make Library the default landing (layout presets, sidebar, localStorage version bump)
Batch 3: Dark chrome tab bars, construction grid, sidebar glow fix
Batch 4: Font feature settings (kerning, ligatures, old-style figures)
Batch 5: Compose engine terminal (collapsible bottom panel)
```

Full implementation details in COMMONPLACE-V5-REPAIR.md (local spec).
