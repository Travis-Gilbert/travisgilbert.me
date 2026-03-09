# CommonPlace Redesign: Pass 1 (Core UI Overhaul)

> Foundation rebuild: card system, grid layout, sidebar, command palette,
> detail drawer, timeline. Full spec delivered as COMMONPLACE_PASS_1.md artifact.
>
> This is the abbreviated commit version. See the full file for complete
> TypeScript examples, CSS classes, and verification checklists.

## Batch Summary

| Batch | What | Key Files |
|---|---|---|
| 0 | Polymorphic ObjectCard system (11 type-specific designs) | `src/components/commonplace/ObjectCard.tsx` (NEW), `CardFooter.tsx` (NEW) |
| 1 | Masonry grid + inverted vignette dot background + Resurface strip | `src/components/commonplace/GridView.tsx` (NEW), `commonplace.css` (EDIT) |
| 2 | cmdk command palette + Sonner toasts + react-hotkeys-hook | `src/components/commonplace/CommandPalette.tsx` (NEW) |
| 3 | Sidebar restructure (256px, Objects 2x3 grid, Projects restored) | `CommonPlaceSidebar.tsx` (EDIT) |
| 4 | Vaul detail drawer (Overview, Connections, History tabs) | `src/components/commonplace/ObjectDrawer.tsx` (NEW) |
| 5 | Rich timeline with GSAP ScrollTrigger | `TimelineView.tsx` (REWRITE) |
| 6 | Graph: type icons in nodes, clickable edges, card-to-graph toggle | `KnowledgeMap.tsx` (EDIT) |

## New Dependencies

```bash
npm install vaul cmdk sonner gsap react-hotkeys-hook @floating-ui/react
```

## Key Design Decisions

- Object-first card grid replaces timeline as default view
- Each of 11 object types gets a visually distinct card design
- Saturation encoding: cards with more edges render with more vivid colors
- "Why This?" inline connection summary on cards
- Sidebar is 256px (adjustable), full SaaS navigation preserved
- Type filters moved to horizontal chips in main content header
- Projects section restored to sidebar
- History tab styled as "Immutable Record" with sealed-document feel
- Inverted vignette dots (denser at edges, fading to center)

## Implementation Order

Batch 0 > 1 > 2 (parallel with 3) > 4 > 5 > 6
