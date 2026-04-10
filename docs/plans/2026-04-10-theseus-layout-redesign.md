# Theseus Layout Redesign

**Date:** 2026-04-10
**Status:** In Progress

## Context

Theseus currently has an immersive galaxy ask page at `/theseus` with subpages for artifacts, models, and truth-maps. Navigation is a minimal breadcrumb bar (TheseusNav) that has been flagged as disorienting. The product needs two things: (1) a conversational chat interface as the new front door, and (2) a richer graph explorer with three-panel progressive reveal inspired by Obsidian and GitNexus patterns.

The design memo (`Index-API/theseus_obsidian_and_graph_borrowings.md`) establishes that the graph is a powerful secondary surface, not the homepage. The front page should be conversation-first.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Product split | Chat Home (new) + Explorer (upgraded current) |
| Navigation model | Modal shift between surfaces |
| Nav component | Left sidebar rail (Claude.ai style), bottom bar on mobile |
| Chat visual feel | Dark brand header, warm readable conversation body |
| Chat model | Threaded (scrolling history, like Claude.ai) |
| Chat-to-Explorer bridge | Visual preview cards embedded in responses |
| Explorer density | Progressive reveal (graph is hero, panels on demand) |
| Explorer MVP | Full Phase 1: structure panel + context panel + selection dimming + controls |
| Theseus face | Preserved as one graph visualization mode in Explorer |
| Ask from Explorer | Explorer keeps its own input for visual/graph answers |

## Product Architecture

```
/theseus (layout: TheseusShell + Sidebar)
  |-- / ................... Chat Home (threaded conversation)
  |-- /explorer ........... Graph Explorer (upgraded current page)
  |-- /notebook ........... Inquiry workspace (future)
  |-- /artifacts .......... Existing, relocated to sidebar
  |-- /models ............. Existing, relocated to sidebar
  +-- /truth-maps/[slug] .. Existing
```

## Implementation Phases

### Phase 1: Sidebar Navigation + Route Restructure
Replace TheseusNav with sidebar rail. Move current page to /theseus/explorer. Create Chat Home placeholder.

### Phase 2: Chat Home
Threaded conversational interface with visual preview cards inline in responses.

### Phase 3: Explorer Upgrade
Three-panel progressive reveal: structure panel (left), graph canvas (center), context panel (right).

### Phase 4: Polish + Bridge
Wire chat visual preview cards to Explorer scenes. Transition animations.

See full plan at `.claude/plans/gentle-hatching-melody.md`.
