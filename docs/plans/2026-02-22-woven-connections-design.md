# Woven Connections: Inline Callouts, Margin Dots, and Thread Lines

**Date:** 2026-02-22
**Status:** Designed
**Supersedes:** `2026-02-21-connection-engine-design.md` (footer map and context provider removed)

## Philosophy

Connections should be editorial texture, not a feature showcase. The original footer scatter map (ConnectionMap) was too self-conscious: it turned connections into a standalone section that called attention to itself rather than enriching the reading experience. The redesign weaves connection signals into surfaces the reader already uses: paragraph text, margins, and listing cards.

Three surfaces, each with a distinct purpose:
1. **Inline callouts** (within article body): show connections at the moment they're relevant
2. **Margin dots** (essay detail margins): ambient fallback for connections without a natural text mention
3. **Thread lines** (listing pages and homepage): reveal the web of relationships across cards

## Surface 1: Inline Callouts

### Concept

When an essay mentions a connected piece by title or slug words, a compact callout block appears directly after the paragraph that contains the mention. This is the primary connection surface: it shows related content at the exact moment the reader encounters the idea.

### Implementation

**Pattern:** Follows the existing `injectAnnotations()` approach. A new `injectConnectionCallouts()` function in `content.ts` injects HTML after the relevant `</p>` tag at build time. Pure SSG; no Client Component required.

**New function:** `injectConnectionCallouts(html, positionedConnections)`

```ts
function injectConnectionCallouts(
  html: string,
  connections: PositionedConnection[],
): string
```

Iterates `</p>` tags. For each paragraph index that matches a connection where `findMentionIndex` returned a non-null value, injects a callout block after the closing tag.

**Injected HTML structure:**

```html
<aside class="connection-callout" data-connection-type="essay" data-connection-color="#B45A2D">
  <a href="/essays/the-sidewalk-tax" class="connection-callout-link">
    <span class="connection-callout-type">ESSAY</span>
    <span class="connection-callout-title">The Sidewalk Tax: How Curb Cuts Changed Everything</span>
  </a>
</aside>
```

**Visual treatment (CSS in `global.css`):**
- 2px left border in the connection's section color
- Slight indent from prose (left margin ~1rem)
- Top/bottom margin of 0.75rem
- Title in Caveat (`font-annotation`) at 15px, inheriting the section color
- Type label in monospace 9px uppercase, muted opacity
- Subtle hover: border thickens to 3px, background wash at 3% section color opacity
- Click navigates to the connected content
- Mobile: identical treatment (no layout change needed)

**Ordering:** If multiple connections mention the same paragraph, they stack vertically in weight order (heavy first).

### Engine Changes

The `PositionedConnection` type gains a `mentionFound` boolean:

```ts
export interface PositionedConnection {
  connection: Connection;
  paragraphIndex: number | null;  // raw findMentionIndex result
  mentionFound: boolean;          // true when findMentionIndex returned non-null
}
```

`positionConnections()` sets `mentionFound: true` when the raw result was non-null, then applies `FALLBACK_PARAGRAPH` for dots:

```ts
export function positionConnections(
  connections: Connection[],
  html: string,
): PositionedConnection[] {
  return connections.map((connection) => {
    const rawIndex = findMentionIndex(connection, html);
    return {
      connection,
      paragraphIndex: rawIndex ?? FALLBACK_PARAGRAPH,
      mentionFound: rawIndex !== null,
    };
  });
}
```

This lets consumers distinguish between "found a real mention" (render inline callout) and "fallback placement" (render margin dot only).

## Surface 2: Enhanced Margin Dots (Fallback)

### Concept

When `findMentionIndex` returns null (no natural mention in the text), a dot appears in the left margin as a fallback signal. These dots are purely ambient; the inline callout handles all mention-based connections.

### Changes from Current Implementation

The existing `ConnectionDots.tsx` evolves:

1. **Filter change:** Only renders dots where `mentionFound === false` (connections with no natural text mention). Currently renders all positioned connections.

2. **Remove context dependency:** No longer imports or uses `useConnectionHighlight` from `ConnectionContext`. The click no longer scrolls to a footer map (which is being removed).

3. **Click behavior:** Navigates directly to the connected content via `router.push()` instead of scrolling to the footer map.

4. **Hover enhancement:** On hover, an unfurling card appears (CSS transition, 200ms ease):
   - Title in Caveat font, 14px
   - Type label in monospace 9px uppercase
   - Section-color left border, 2px
   - Max-width 200px, slight warm shadow
   - Positioned adjacent to the dot (right of dot, shift left if near viewport edge)

5. **Desktop only:** Remains `hidden xl:block` (below xl, these fallback connections simply don't surface in the margin; they could appear as a compact list below article if needed later).

6. **Accessibility:** Remains `<button>` with `aria-label="Connected: {title}"`. Hover card content is also accessible via focus.

## Surface 3: Thread Lines

### Concept

On listing pages (`/essays`) and the homepage, rough.js hand-drawn arcs connect cards that have explicit editorial relationships. The visual effect is like string connecting pinned notes on a wall: subtle when scanning, rewarding when noticed.

### Architecture

**New component:** `ThreadLines` (`src/components/ThreadLines.tsx`), a Client Component.

**New engine function:** `computeThreadPairs(allContent)` in `connectionEngine.ts`:

```ts
export interface ThreadPair {
  fromSlug: string;
  toSlug: string;
  type: ConnectionType;
  color: string;
  weight: ConnectionWeight;
}

export function computeThreadPairs(content: AllContent): ThreadPair[] {
  // For each essay, check related slugs
  // For each field note, check connectedTo
  // For each shelf entry, check connectedEssay
  // Deduplicate bidirectional pairs (A→B and B→A become one pair)
  // Return array of unique pairs
}
```

Called at build time by listing page Server Components. Result passes as a serializable prop to `ThreadLines`.

**DOM measurement:** Cards render with `data-slug={slug}` attributes. `ThreadLines` uses `useEffect` + `useRef` to measure card positions via `getBoundingClientRect()` relative to the containing section.

**Canvas rendering:**
- Single `<canvas>` (or SVG) behind the card grid, absolutely positioned
- rough.js `rc.curve()` bezier arcs between card centers (or card edges for cleaner visual)
- Control points offset vertically for organic arcs (same approach as the removed ConnectionMap)
- Stroke color from section color mapping
- Stroke width from weight hierarchy (1.8 / 1.2 / 0.8)
- Roughness ~1.2

**Opacity behavior:**
- Rest state: 25% opacity (ambient, doesn't distract)
- On card hover: curves connected to that card rise to 60% opacity, all others fade to 12%
- Transition: 300ms ease

**Animate-on:** IntersectionObserver triggers `strokeDashoffset` draw animation (reusing `DrawOnIcon` technique). Staggered by weight (heavy first). Respects `prefers-reduced-motion`.

**Resize handling:** Debounced ResizeObserver (250ms) recalculates card positions and redraws curves. Canvas dimensions match container.

### Pages

**`/essays` listing page:**
- Wrap the card grid in a `position: relative` container
- Thread lines connect essay cards sharing `related` slugs
- `computeThreadPairs` scoped to essays only (no cross-type threads on this page)

**Homepage:**
- More complex: essays section has featured + secondary cards, field notes in a separate section below
- Thread lines only within each section (essays to essays, field notes showing `connectedTo` parent)
- Cross-section threads (e.g., field note to essay) deferred to future iteration when visual testing confirms the long arcs work well

### Visual Constraints

- Thread lines only render when both connected cards are visible on the current page (no "ghost" lines to off-screen content)
- Maximum 8 thread pairs per section to avoid visual noise
- Cards without connections render normally (no empty state needed)
- On mobile (below md), thread lines are hidden entirely (cards stack vertically, arcs would be vertical lines)

## Removals

### ConnectionMap (`src/components/ConnectionMap.tsx`)

Deleted entirely. The footer scatter visualization is replaced by the three surfaces above.

### ConnectionContext (`src/components/ConnectionContext.tsx`)

Deleted entirely. The shared `highlightedId` state was only needed to coordinate between margin dots and the footer map. Without the map, dots manage their own hover state locally.

### Essay Detail Page Changes (`src/app/essays/[slug]/page.tsx`)

- Remove `ConnectionProvider` wrapper
- Remove `ConnectionMap` rendering block
- Remove `ConnectionMap` and `ConnectionProvider` imports
- Keep `computeConnections` and `positionConnections` calls
- Split connections into two groups based on `mentionFound`:
  - `mentionFound === true`: pass to `injectConnectionCallouts()` for HTML injection
  - `mentionFound === false`: pass to `ConnectionDots` (margin fallback)

## File Structure

### New Files

| File | Type | Purpose |
|------|------|---------|
| `src/components/ThreadLines.tsx` | Client Component | Canvas thread arcs on listing pages |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/connectionEngine.ts` | Add `mentionFound` to `PositionedConnection`, add `computeThreadPairs()`, add `ThreadPair` type |
| `src/lib/content.ts` | Add `injectConnectionCallouts()` function |
| `src/components/ConnectionDots.tsx` | Remove context usage, filter to `mentionFound === false`, click navigates directly, add hover card |
| `src/app/essays/[slug]/page.tsx` | Remove ConnectionMap/ConnectionContext, split connections by mentionFound, call `injectConnectionCallouts()` |
| `src/app/essays/page.tsx` | Add `data-slug` to cards, compute thread pairs, render `ThreadLines` |
| `src/app/page.tsx` | Add `data-slug` to essay/field-note cards, compute thread pairs per section, render `ThreadLines` |
| `src/styles/global.css` | Add `.connection-callout` styles |

### Deleted Files

| File | Reason |
|------|--------|
| `src/components/ConnectionMap.tsx` | Replaced by three woven surfaces |
| `src/components/ConnectionContext.tsx` | No longer needed without shared highlight state |

## Visual Language Summary

| Surface | Where | Connection Types | Trigger |
|---------|-------|-----------------|---------|
| Inline callout | After paragraph in article body | All types with text mention | `mentionFound === true` |
| Margin dot | Left margin (xl+ only) | All types without text mention | `mentionFound === false` |
| Thread line | `/essays`, homepage card grids | Related essays, connectedTo field notes | Cards both visible on page |

| Connection Type | Color | Weight | Stroke | Animate Order |
|----------------|-------|--------|--------|---------------|
| Essay (related) | Terracotta `#B45A2D` | Heavy | 1.8px | First |
| Field Note (connectedTo) | Teal `#2D5F6B` | Medium | 1.2px | Second |
| Shelf (connectedEssay) | Gold `#C49A4A` | Light | 0.8px | Third |

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Remove footer map | Three woven surfaces | Connections as texture, not showcase; the map was too self-conscious |
| Inline callout as primary | Build-time HTML injection | Zero JS overhead; shows connection at the moment of relevance |
| Mention-based split | `mentionFound` boolean | Clean separation: callout where natural, dot where not |
| CSS-only callout | No Client Component | Follows successful `injectAnnotations` pattern; SSG-compatible |
| Direct navigation on dot click | No scroll-to-map | Simpler, more useful; the reader wants the content, not a visualization |
| Thread lines at 25% opacity | Not higher rest opacity | Ambient signal that doesn't compete with card content |
| Section-scoped threads | Not cross-section | Avoids long confusing arcs across different content types |
| Mobile: hide threads | Not responsive threads | Vertical card stacks make horizontal arcs meaningless |
| Max 8 thread pairs | Not unlimited | Prevents visual noise as content library grows |
