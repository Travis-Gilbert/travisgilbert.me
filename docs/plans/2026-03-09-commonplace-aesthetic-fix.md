# CommonPlace Aesthetic Fix: Visual Polish for Pass 1 Components

> **Priority: URGENT.** The structural Pass 1 components are in place but the
> visual layer is missing. Cards look like white rectangles. Background is plain.
> Graph nodes are monochrome. Timeline cards are empty shells.
>
> This spec contains exact CSS values and inline style overrides.
> Every change is a visual fix, not a structural change.
> Do NOT refactor the component architecture. Just make it look right.

---

## Problem Summary (from screenshots)

1. All cards are white/near-white rectangles with no type differentiation
2. Background is plain parchment with no texture
3. Timeline cards only show type badge + title, no rich content
4. Graph nodes are all the same teal color
5. No hover effects on cards
6. RESURFACE label renders as ugly stacked letters
7. Cards have 4px border-radius (too sharp) and 10px padding (too cramped)

---

## Fix 1: Card Base Styles (ObjectCard.tsx)

### File: `src/components/commonplace/ObjectCard.tsx`

Replace the `baseCardStyle` object with stronger visual treatments:

```typescript
const baseCardStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'var(--cp-card)',
  border: `1px solid var(--cp-border-faint)`,
  borderRadius: 10,                              // was 4
  padding: '14px 16px 10px',                     // was 10px 12px 8px
  cursor: 'pointer',
  transition: 'box-shadow 200ms ease, transform 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  boxShadow: '0 1px 3px rgba(42, 36, 32, 0.05)',
  position: 'relative',
  overflow: 'hidden',
};
```

### Hover state (add CSS class rules)

In `commonplace.css`, add:

```css
/* ── Card hover and interaction ── */

.cp-object-card {
  border-radius: 10px !important;
}

.cp-object-card:hover {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(42, 36, 32, 0.1) !important;
}

.cp-object-card:active {
  transform: translateY(0) !important;
  box-shadow: 0 2px 8px rgba(42, 36, 32, 0.08) !important;
}
```

### Type-specific card styles (strengthen all overrides)

Replace the conditional cardStyle spreads with much stronger differentiation:

```typescript
const cardStyle: CSSProperties = {
  ...baseCardStyle,

  // Source: teal top accent (3px gradient bar, not just a border)
  ...(node.objectType === 'source' && {
    borderTop: `3px solid ${hexAlpha(color, sat)}`,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  }),

  // Hunch: dashed pink border + warm gradient background
  ...(node.objectType === 'hunch' && {
    border: `1.5px dashed ${hexAlpha(color, sat * 0.5)}`,
    background: `linear-gradient(140deg, #FFF8F4 0%, #FEF3EC 100%)`,
  }),

  // Quote: 4px gold left border + warm gradient
  ...(node.objectType === 'quote' && {
    borderLeft: `4px solid ${hexAlpha(color, sat)}`,
    background: `linear-gradient(135deg, var(--cp-card) 0%, #FBF8F0 100%)`,
    paddingTop: 18,
  }),

  // Place: gold left border + subtle gold top gradient
  ...(node.objectType === 'place' && {
    borderLeft: `4px solid ${hexAlpha(color, sat)}`,
    background: `linear-gradient(180deg, ${hexAlpha(color, 0.04)} 0%, var(--cp-card) 40%)`,
  }),

  // Person: terracotta bottom border (contact card feel)
  ...(node.objectType === 'person' && {
    borderBottom: `3px solid ${hexAlpha(color, sat * 0.7)}`,
  }),

  // Task: orange left border
  ...(node.objectType === 'task' && {
    borderLeft: `3px solid ${hexAlpha(color, sat)}`,
  }),

  // Event: blue gradient banner at top
  ...(node.objectType === 'event' && {
    background: `linear-gradient(160deg, ${hexAlpha(color, 0.06)} 0%, var(--cp-card) 50%)`,
    borderTop: `3px solid ${hexAlpha(color, sat * 0.7)}`,
  }),

  // Script: steel left border + slightly different background
  ...(node.objectType === 'script' && {
    borderLeft: `3px solid ${hexAlpha(color, sat * 0.6)}`,
    background: '#FAFAF8',
  }),

  // Concept: purple border tint
  ...(node.objectType === 'concept' && {
    border: `1.5px solid ${hexAlpha(color, sat * 0.25)}`,
  }),
};
```

### Title font size (increase for readability)

```typescript
const titleStyle: CSSProperties = {
  fontFamily:
    node.objectType === 'script'
      ? 'var(--cp-font-code)'
      : 'var(--cp-font-title)',
  fontSize: node.objectType === 'script' ? 13 : 15.5,  // was 13/15
  fontWeight: node.objectType === 'concept' ? 700 : 600, // was 500
  fontStyle:
    node.objectType === 'hunch' || node.objectType === 'quote'
      ? 'italic'
      : 'normal',
  color: 'var(--cp-text)',
  lineHeight: 1.35,
  marginBottom: node.summary ? 6 : 0,  // was 5
};
```

### Person header: bigger avatar

The current avatar is 22px. It should be 40px minimum to feel like a contact card:

```typescript
function PersonHeader({ node, color, sat }) {
  const initial = node.title.charAt(0).toUpperCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: `conic-gradient(from 0deg, ${hexAlpha(color, sat * 0.3)}, ${hexAlpha(color, sat * 0.6)}, ${hexAlpha(color, sat * 0.3)})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, position: 'relative',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: `linear-gradient(135deg, ${hexAlpha(color, 0.1)}, ${hexAlpha(color, 0.22)})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--cp-font-title)', fontSize: 18, fontWeight: 700, color,
        }}>
          {initial}
        </div>
        {node.edgeCount > 0 && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 16, height: 16, borderRadius: '50%',
            background: color, color: '#F5F0E8',
            fontFamily: 'var(--cp-font-code)', fontSize: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--cp-card)',
          }}>
            {node.edgeCount}
          </div>
        )}
      </div>
      <TypeBadge label="PERSON" color={color} sat={sat} />
    </div>
  );
}
```

### Quote header: bigger quotation mark

Current mark is 28px. Should be 44px with lower opacity:

```typescript
function QuoteHeader({ color, sat }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <span style={{
        fontFamily: 'var(--cp-font-title)',
        fontSize: 44,       // was 28
        lineHeight: 0.7,
        color: hexAlpha(color, 0.2 * sat),
        userSelect: 'none',
      }}>&ldquo;</span>
    </div>
  );
}
```

---

## Fix 2: Inverted Vignette Dot Background

### File: `src/styles/commonplace.css`

Replace `.cp-blueprint-grid` (or add alongside it) with the inverted vignette:

```css
/* ── Inverted vignette dots: denser at edges, fading to center ── */

.cp-blueprint-grid {
  background-image:
    radial-gradient(
      ellipse at center,
      transparent 30%,
      rgba(180, 90, 45, 0.03) 70%,
      rgba(180, 90, 45, 0.05) 100%
    ),
    radial-gradient(
      circle at center,
      rgba(180, 90, 45, 0.045) 1px,
      transparent 1px
    );
  background-size: 100% 100%, 24px 24px;
}

/* Remove the old grid-only pattern entirely: */
/* The first radial-gradient is the vignette (transparent center, tinted edges).
   The second is the dot matrix (24px spacing, terracotta at 4.5% opacity).
   Combined: dots are visible at edges, invisible at center. */
```

If `.cp-blueprint-grid` is applied in the layout, this replaces the grid pattern
with the vignette dot pattern on the exact same element. No JSX changes needed.

---

## Fix 3: Masonry Grid CSS

### File: `src/styles/commonplace.css`

Add or replace:

```css
/* ── Masonry grid ── */

.cp-masonry {
  columns: 3;
  column-gap: 14px;
  padding: 14px 20px 30px;
}

.cp-masonry-item {
  break-inside: avoid;
  margin-bottom: 14px;
}

@media (max-width: 1200px) {
  .cp-masonry { columns: 2; }
}

@media (max-width: 768px) {
  .cp-masonry {
    columns: 1;
    padding: 10px 14px 20px;
  }
}

/* ── Grid view layout ── */

.cp-grid-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.cp-grid-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--cp-border-faint);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.cp-grid-scroll {
  flex: 1;
  overflow-y: auto;
}
```

---

## Fix 4: View Toggle Styling

```css
.cp-view-toggle {
  display: flex;
  gap: 2px;
  background: var(--cp-bg);
  border-radius: 8px;
  padding: 2px;
  border: 1px solid var(--cp-border-faint);
}

.cp-view-toggle-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--cp-text-faint);
  font-family: var(--cp-font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 150ms;
}

.cp-view-toggle-btn--active {
  background: var(--cp-card);
  color: var(--cp-text);
  box-shadow: 0 1px 3px rgba(42, 36, 32, 0.08);
}
```

---

## Fix 5: Type Filter Chips

```css
.cp-type-chips {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  align-items: center;
}

.cp-type-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--cp-border);
  background: transparent;
  font-family: var(--cp-font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cp-text-faint);
  cursor: pointer;
  transition: all 150ms;
}

.cp-type-chip::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chip-color, var(--cp-text-faint));
  opacity: 0.5;
}

.cp-type-chip--active {
  border-color: var(--chip-color);
  background: color-mix(in srgb, var(--chip-color) 8%, transparent);
  color: var(--chip-color);
}

.cp-type-chip--active::before {
  opacity: 1;
  box-shadow: 0 0 6px color-mix(in srgb, var(--chip-color) 40%, transparent);
}
```

---

## Fix 6: Resurface Strip

```css
.cp-resurface-strip {
  display: flex;
  gap: 10px;
  padding: 14px 20px 8px;
  align-items: stretch;
}

.cp-resurface-label {
  font-family: var(--cp-font-mono);
  font-size: 8px;
  letter-spacing: 0.14em;
  color: var(--cp-text-faint);
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  text-align: center;
  padding: 4px 0;
  flex-shrink: 0;
  text-transform: uppercase;
}

.cp-resurface-cards {
  display: flex;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.cp-resurface-cards > * {
  flex: 1;
  min-width: 0;
}
```

The RESURFACE label currently renders as `{'R\nE\nS\nU\nR\nF\nA\nC\nE'}`.
Change to just `RESURFACE` and let `writing-mode: vertical-rl` handle it:

```tsx
// In GridView.tsx, change:
<div className="cp-resurface-label">
  {'R\nE\nS\nU\nR\nF\nA\nC\nE'}
</div>

// To:
<div className="cp-resurface-label">RESURFACE</div>
```

---

## Fix 7: Timeline Card Richness

### File: `src/components/commonplace/TimelineView.tsx`

The timeline cards currently render only title + type badge. They need:

1. **Full body text** (not truncated in timeline mode)
2. **Entity chips** if the node has extracted entities (even simulated from title)
3. **Connection count badge** if edges > 0
4. **Type-colored left border** on each card (matching the ObjectCard type)
5. **Date header styling** with Courier Prime uppercase

In the timeline card rendering, ensure the ObjectCard receives `mode="timeline"`.
But more importantly, the timeline-specific wrapper needs better styling:

```css
/* ── Timeline card wrapper (the card that sits to the right of the line) ── */

.cp-timeline-card-wrapper {
  background: var(--cp-card);
  border: 1px solid var(--cp-border-faint);
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 12px;
  transition: box-shadow 200ms ease;
  cursor: pointer;
}

.cp-timeline-card-wrapper:hover {
  box-shadow: 0 4px 16px rgba(42, 36, 32, 0.08);
}

/* Timeline left gutter line */
.cp-timeline-line {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 16px;
  width: 2px;
  background: rgba(180, 90, 45, 0.15);
}

/* Timeline dot on the line */
.cp-timeline-dot {
  position: absolute;
  left: 12px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--cp-bg);
  z-index: 2;
}
```

---

## Fix 8: Graph Node Colors

### File: `src/components/commonplace/KnowledgeMap.tsx`

Verify that `getNodeColor()` in `commonplace-graph.ts` returns the correct
type color (not a hardcoded teal). Each node's fill should be
`getObjectTypeIdentity(node.objectType).color`, not a single color.

Check: the node rendering SVG circle should use:
```typescript
const color = getNodeColor(node.objectType);
// NOT: const color = 'var(--cp-teal)';
```

If `getNodeColor` is returning the same color for all types, the function
needs to map through `OBJECT_TYPES` or `getObjectTypeIdentity()`.

Also verify the icon inside each node is rendering. The screenshot shows
what appear to be teal rectangles/squares inside the circles, not the
type-specific SVG icons. The icon paths from the SidebarIcon system
need to render as white stroked paths centered in the node circle.

---

## Fix 9: Card Footer Styling

### File: `src/components/commonplace/CardFooter.tsx`

Ensure the footer has a visible separator and proper spacing:

```css
.cp-card-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--cp-border-faint);
}

.cp-card-footer-time {
  font-family: var(--cp-font-mono);
  font-size: 9.5px;
  color: var(--cp-text-faint);
}

.cp-card-footer-edges {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 3px;
  font-family: var(--cp-font-code);
  font-size: 9px;
}
```

---

## Verification Checklist

After applying all fixes, verify against the mockup screenshots from earlier in this conversation:

- [ ] Source cards have visible teal top accent bar (3px)
- [ ] Hunch cards have dashed pink border and warm gradient background
- [ ] Person cards have 40px avatar circle with initial and edge count badge
- [ ] Quote cards have 44px quotation mark and gold left border
- [ ] Concept cards have radiating dot cluster
- [ ] Place cards have gold left border and gradient
- [ ] Task cards have orange left border
- [ ] Event cards have blue top accent and gradient
- [ ] Script cards have steel left border and monospace body
- [ ] All cards have 10px border-radius
- [ ] All cards lift on hover (translateY -2px, deeper shadow)
- [ ] Background shows inverted vignette dots (dense at edges, fading to center)
- [ ] Masonry grid is 3 columns on desktop, 2 on tablet, 1 on mobile
- [ ] RESURFACE label renders vertically with writing-mode (not stacked letters)
- [ ] Type filter chips have colored dots and active glow state
- [ ] Graph nodes are colored by type (not all teal)
- [ ] Graph nodes contain type-specific SVG icons in white
- [ ] Timeline cards have full body text, type-colored left border
- [ ] Card footer shows timestamp and edge count with separator line
- [ ] `npm run build` passes
