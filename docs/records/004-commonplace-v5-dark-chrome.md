# 004: CommonPlace v5 Dark Chrome Instrument Redesign

**Status:** In progress (Batches 1-6 complete, Batches 7-9 pending)
**Date started:** 2026-03-11

## Overview

Full visual and component architecture redesign of the CommonPlace frontend. The v4 aesthetic ("warm studio, cream parchment") is replaced by a "Dark Chrome Instrument" palette: deep graphite surfaces, vellum accent text, terracotta accent color, monospace labels. The redesign is batched so each batch is independently shippable.

## Design Language

| Token | Value | Role |
|-------|-------|------|
| `--cp-chrome` | `#1C1C20` | Base surface |
| `--cp-chrome-raise` | `#2A2A30` | Raised surface (tooltips, panels) |
| `--cp-sidebar` | dark chrome variant | Navigation rail |
| `--cp-vellum` | `#F4F3F0` | Primary text |
| `--cp-accent` | `#C4503C` | Terracotta highlight |
| `--cp-font-mono` | JetBrains Mono | Labels, metadata |
| `--cp-font-title` | Vollkorn | Heading display |

## Batch Log

### Batch 0: Font aliases (complete)
Added `--cp-font-title`, `--cp-font-sans`, `--cp-font-mono`, `--cp-font-metadata` aliases in `commonplace.css` pointing to existing site `--font-*` vars.

### Batch 1: Color token migration (complete)
Full palette swap in `commonplace.css`: dark chrome base, vellum text, terracotta accent, surface hierarchy (chrome/raise/float), text hierarchy (primary/muted/faint), border tokens.

### Batch 2: Polymorphic object renderers (complete)
New `src/components/commonplace/objects/` directory with 10 typed renderers + dispatcher:
- `NoteCard`, `SourceCard`, `QuoteBlock`, `ConceptNode`, `EventBadge`
- `HunchSticky`, `PersonPill`, `PlacePin`, `ScriptBlock`, `TaskRow`
- `ObjectRenderer` dispatcher: routes by `object_type` string to correct renderer

### Batch 3: TerminalBlock (complete)
Reusable dark surface component. Props: `title`, `statusDot` (color), `actions` slot, `className`. Used in ComposeView and anywhere a dark inset panel is needed.

### Batch 4: LibraryView (complete)
New `src/components/commonplace/LibraryView.tsx` module containing:
- `ClusterCard`: tag-based object cluster grid with count badge
- `LineageSwimlane`: horizontal ancestor/descendant chain with arrow connectors
- `ResumeCards`: filtered object list with type indicator chips

### Batch 5: ComposeView (complete)
Redesigned `src/components/commonplace/ComposeView.tsx`:
- Collapsible terminal panel (bottom, TerminalBlock-based) with command input
- Right toolkit panel with reference shelf and annotation strip
- Both panels toggle via header icon buttons

### Batch 6: Sidebar collapse to icon rail (complete)
Sidebar can collapse to a 48px icon rail. Key design decisions:

**Reactive collapse (not user toggle):** `SplitPaneContainer` is the sole writer of `sidebarCollapsed` via a `useEffect` that fires when `focusedViewType === 'compose'`. The sidebar only reads from context. Rail icon clicks call `requestView()`, which changes the active tab, which changes `focusedViewType`, which auto-re-expands the sidebar. No explicit `setSidebarCollapsed(false)` in any click handler.

**CSS tooltip approach:** Used `useState` hover + absolutely positioned div instead of floating-ui. Avoids a dependency for a simple 9px monospace tooltip.

**`RailIconButton` forward reference:** Defined before `SidebarIcon` in the file but references it. Works because both are `function` declarations (hoisted).

Files changed: `commonplace-context.tsx`, `SplitPaneContainer.tsx`, `CommonPlaceSidebar.tsx`, `commonplace.css`.

## Pending Batches

### Batch 7: ObjectContextMenu
Right-click context menu on any object card. Actions: Stash (move to stash pane), Connect (open connection drawer), Contain (nest inside another object).

### Batch 8: DotGrid canvas migration
Move the dot field from CSS (`.cp-pane-dots` background-image) to a shared DotGrid canvas layer in `PaneFrame`. Aligns with the main site's DotGrid pattern and enables zone-aware dot color changes.

### Batch 9: Backend cluster/lineage endpoints + frontend hooks
New Django endpoints for cluster grouping and lineage chains. Wire `ClusterCard` and `LineageSwimlane` to live data instead of placeholder props.

## Implementation Notes

- `sidebarCollapsed` is in `CommonPlaceContext` alongside other shared UI state
- The `objects/` directory is the canonical location for all typed renderers; `ObjectRenderer.tsx` is the single import point for consumers
- `TerminalBlock` is intentionally generic: it has no knowledge of CommonPlace-specific data or context
