# CommonPlace v5.1: Lego Composition System

> **For Claude Code. One batch per session. Read entire spec before writing code.**

## Summary

Objects in CommonPlace compose together like Lego bricks. Drag a Hunch onto a Person card and the Hunch becomes a badge. Any object can snap onto any other, creating a parent-child visual relationship backed by a typed `pinned` edge in the graph.

## Build Order

```
Backend:  Migration (pinned edge type, pin_position, pin_sort_order)
Batch 1:  Badge renderer (PinnedBadge component, 10 type-specific badges)
Batch 2:  Drag-and-drop pin interaction (HTML5 DnD, ghost preview, API)
Batch 3:  Layout presets update (1/2/3 pane with Iconoir icons)
Batch 4:  Terminal canvas background (mulberry32 seeded dots, teal gradient)
Batch 5:  Tab drag between panes (module-level composition)
```

Full spec in COMMONPLACE-V5.1-LEGO-COMPOSITION.md (local).
