# Connection Engine: Hand-Drawn Content Relationships

**Date:** 2026-02-21
**Status:** Designed

## Overview

A pure TypeScript connection engine that surfaces explicit editorial relationships between content entries, rendered as rough.js hand-drawn bezier curves on essay detail pages. Two interaction layers: ambient margin dots while reading, and a freeform scatter connection map in the footer.

## Goals

- Surface the explicit relationships already encoded in frontmatter (`related`, `connectedTo`, `connectedEssay`)
- Use rough.js animated bezier curves that match the site's hand-drawn aesthetic
- Start on essay detail pages, architect for extensibility to listing pages and dedicated views later
- Zero new frontmatter fields required

## Architecture

### Connection Engine (`src/lib/connectionEngine.ts`)

Pure TypeScript module. No React, no side effects. Exports two functions.

#### Types

```ts
type ConnectionType = 'essay' | 'field-note' | 'shelf';
type ConnectionWeight = 'heavy' | 'medium' | 'light';

interface Connection {
  id: string;               // deterministic: `${type}-${slug}`
  type: ConnectionType;
  slug: string;
  title: string;
  summary?: string;         // excerpt or annotation
  color: string;            // section color hex
  weight: ConnectionWeight;
  date: Date;
}
```

#### `computeConnections(essay, allContent)`

Takes the current essay entry and all content collections. Checks three explicit link types:

1. `essay.data.related` slugs matched against the essays collection
2. Field notes where `fieldNote.data.connectedTo === essay.slug`
3. Shelf entries where `shelfEntry.data.connectedEssay === essay.slug`

Weight mapping:
- `related` essays: `heavy` (1.8px stroke, terracotta `#B45A2D`)
- `connectedTo` field notes: `medium` (1.2px stroke, teal `#2D5F6B`)
- `connectedEssay` shelf entries: `light` (0.8px stroke, gold `#C49A4A`)

Returns `Connection[]`.

#### `findMentionIndex(connection, html)`

Scans rendered HTML for the first occurrence of the connection's title (case-insensitive substring match within `<p>` tags). Returns the 1-based paragraph index, or `null` if no mention is found. Dots with `null` index are omitted from the margin but still appear in the footer map.

### Margin Dots (`src/components/ConnectionDots.tsx`)

Client Component placed in the essay detail page's margin layer.

**Data flow:** The essay page (Server Component) calls `computeConnections()` and `findMentionIndex()` at build time, producing an array of `{ connection, paragraphIndex }` pairs. This array passes as a prop, along with the same paragraph Y-offset data that `StickyNoteLayer` uses via `paragraphPositions.ts`.

**Visual treatment:**
- 8px filled circle using the connection's section color
- Multiple dots at the same paragraph stack vertically with 4px spacing
- Hover tooltip: connected item's title and type label in Caveat font
- Positioned on the opposite margin side from sticky notes to avoid collision
- Mobile (below xl): inline row beneath the relevant paragraph

**Click behavior:** Smooth-scrolls to the footer connection map and sets `highlightedId` state matching that connection's `id`.

**Accessibility:** `<button>` elements with `aria-label="Connected: {title}"`. Focus styles match the connection color.

### Footer Connection Map (`src/components/ConnectionMap.tsx`)

Client Component rendered below the article body, near `SourcesCollapsible`.

**Layout:** Bounded container (~600px tall desktop, shorter mobile) wrapped in a neutral `RoughBox`. Current essay anchored at left-center. Connected items scattered to the right in freeform arrangement.

**Scatter positioning:** Deterministic positions seeded from connection `id` (same PRNG approach as `PatternImage`). Items cluster loosely by type: essays upper, field notes middle, shelf entries lower. Minimum distance constraints prevent overlap. Each item renders as a small card: title, type label (monospace 9px uppercase), section-colored left border.

**Rough.js bezier curves:** Single canvas or SVG underlaying the cards. Curves from essay anchor to each connected item via `rc.curve()` with vertically offset control points for organic arcs. Stroke color matches section color. Stroke width follows weight hierarchy. Roughness ~1.2.

**Animate-on with stagger:** IntersectionObserver triggers when map scrolls into view. Curves draw sequentially using `strokeDashoffset` technique (from `DrawOnIcon`), 200ms stagger. Heavy connections animate first, then medium, then light. Respects `prefers-reduced-motion` by showing all curves immediately.

### Click Highlight Interaction

**Dimming:** Non-selected curves and cards fade to 20% opacity (CSS transition, 300ms ease). Selected curve thickens by ~0.5px, connected card gets elevated shadow in section color.

**Re-draw:** Selected curve re-animates its stroke-draw (400ms replay) on focus transition.

**Deselection:** Click same dot/card, click empty space, or press Escape. All curves return to full opacity.

**Scroll coordination:** From margin dot: smooth-scroll to footer map, highlight activates after scroll completes. From within footer map: no scroll.

**State management:** Single `highlightedId: string | null` state shared via context. Both `ConnectionDots` and `ConnectionMap` read from it. Margin dot shows ring outline when its connection is highlighted from footer.

## File Structure

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/lib/connectionEngine.ts` | Pure module | `computeConnections()`, `findMentionIndex()`, types |
| `src/components/ConnectionDots.tsx` | Client Component | Margin dot indicators |
| `src/components/ConnectionMap.tsx` | Client Component | Footer scatter with rough.js curves |

### Modified Files

| File | Change |
|------|--------|
| `src/app/essays/[slug]/page.tsx` | Call engine at build time, pass connections to both components, add context provider |

### No Changes Needed

- `src/lib/paragraphPositions.ts` (consumed as-is by ConnectionDots)
- Content schemas (all fields already exist)
- `package.json` (rough.js already installed)

## Visual Language Summary

| Connection Type | Color | Weight | Stroke | Animate Order |
|----------------|-------|--------|--------|---------------|
| Essay (related) | Terracotta `#B45A2D` | Heavy | 1.8px | First |
| Field Note (connectedTo) | Teal `#2D5F6B` | Medium | 1.2px | Second |
| Shelf (connectedEssay) | Gold `#C49A4A` | Light | 0.8px | Third |

## Extensibility

The pure module pattern enables future extensions without changing the engine interface:

- **Listing pages:** Call `computeConnections()` per visible card for ambient dot indicators
- **Dedicated connections page:** Call for every content entry to build a full graph
- **Additional analyzers:** Tag-based or source-URL connections as new functions in the same module
- **Other content types:** Projects could gain `connectedTo` fields following the same pattern

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Explicit links only | No tag/URL matching | High signal, zero noise; every line represents editorial intent |
| First-mention detection | Not frontmatter-driven | Keeps content files clean; connections "just work" when adding related/connectedTo |
| Freeform scatter | Not radial or linear | Matches collage/studio-journal aesthetic; "objects on a desk" |
| Progressive reveal + click | Not click-only | Two layers: passive delight on scroll, active exploration on click |
| Section colors for curves | Not unified color | Leverages existing wayfinding language; type is instantly legible |
| Weight hierarchy | Not uniform stroke | Editorial cross-references (essays) feel strongest; shelf entries feel lightest |
| Opposite margin from sticky notes | Not same side | Avoids collision with comment layer |
| Null mention = footer only | Not forced placement | Graceful degradation; never places a dot somewhere misleading |
