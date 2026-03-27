# CommonPlace Visual Overhaul: Library, Sidebar, Dot Grid, Models

> **For Claude Code. One batch per session. Read entire spec before writing code.**
> **Read every file listed under "Read first" before writing a single line.**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**

---

## Design Intent

CommonPlace currently suffers from "every dial at 10": six visual zones compete
for attention on the Library page, the Toolbox radiates six distinct hues, colored
monospace section headers all shout at the same volume, and the dot grid competes
with content on the parchment surface. The result feels disjointed compared to
travisgilbert.me and Studio, both of which have clear visual hierarchy.

This spec applies a "color volume" system: one element at full volume, everything
else turned down. All warmth, texture, and color stays. Nothing is removed, only
given a volume knob.

### Design Principles (from mockup session)

1. **One hero per page.** The Library's hero becomes an Engine Pulse terminal block,
   not a "pick up where you left off" card. The engine is the product.
2. **Section headers use weight, not color.** Reserve terracotta/colored monospace
   for the single hero element. Section labels become muted JetBrains Mono at 28%
   opacity.
3. **Sidebar is monochrome at rest, colorful on interaction.** Nav items and Toolbox
   icons bloom into their identity colors on hover/active. The `LABEL_ACCENT` map
   already exists with per-item colors.
4. **Dot grid uses inverse vignette.** Center is clean parchment for reading. Dots
   fade in radially from the edges using the existing mulberry32 PRNG.
5. **Objects are rows with type marks, not uniform card grids.** Each object type
   gets a geometrically distinct mark (Source = teal bar, Concept = purple circle,
   Person = initial avatar, Hunch = dashed rotated square, Note = subtle rect,
   File = folded-corner rect).
6. **Wordmark becomes two lines.** "Common" in full white, "Place" in grayish teal
   (~rgba(55, 120, 130, 0.6)).
7. **Open questions (Option B) belongs in Compose sidebar**, not the Library.
   Cognitive fatigue on arrival is an ADHD concern.

---

## Batch 0: Sidebar Wordmark + Monochrome Baseline

### Read first
- `src/components/commonplace/shell/CommonPlaceSidebar.tsx` (full file, 33KB)
- `src/components/commonplace/shell/CommonPlaceSidebar.module.css` (8KB)
- `src/components/commonplace/shared/ComponentToolbox.tsx`

### Changes

#### 1. Two-line wordmark in `CommonPlaceSidebar.tsx`

Find the brand zone `<Link>` that renders "CommonPlace" at fontSize 24. Replace
with two `<span>` elements:

```
<Link href="/commonplace" onClick={closeDrawerIfMobile} style={{ textDecoration: 'none', display: 'block' }}>
  <span style={{
    display: 'block',
    fontFamily: 'var(--cp-font-title)',
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--cp-sidebar-text)',
    lineHeight: 1.1,
  }}>Common</span>
  <span style={{
    display: 'block',
    fontFamily: 'var(--cp-font-title)',
    fontSize: 22,
    fontWeight: 700,
    color: 'rgba(55, 120, 130, 0.6)',
    lineHeight: 1.1,
  }}>Place</span>
</Link>
```

#### 2. Monochrome nav icons at rest, color on hover

The `LABEL_ACCENT` map already defines per-item colors. Currently, color is only
applied when `isActive` is true (via the `SidebarIcon` color prop). Change the
behavior so:

- **At rest:** Icon opacity 0.5, no color override (monochrome)
- **On hover:** Icon gets the item's `LABEL_ACCENT` color, opacity 1
- **Active:** Icon keeps the accent color, opacity 1

This requires adding hover state handling. In `CommonPlaceSidebar.module.css`,
add a rule for `.sidebarItem:hover` that increases icon opacity. In the
`SidebarIcon` component, pass the accent color as a CSS custom property so
hover can reference it:

```css
.sidebarItem:hover .sidebarIcon {
  opacity: 1;
}
```

The inline `SidebarIcon` already accepts a `color` prop. Add a data attribute
`data-hover-color` to the nav item wrapper so CSS can use it, or handle via
onMouseEnter/onMouseLeave to set icon color transiently.

#### 3. Toolbox monochrome at rest

In `ComponentToolbox.tsx`, the toolbox tiles currently show colored backgrounds.
Change the baseline to:

- Background: `rgba(244, 243, 240, 0.02)`
- Icon dot: `rgba(244, 243, 240, 0.06)`
- Text color: `rgba(244, 243, 240, 0.22)`

On hover, bloom to the tool's identity color:

- Background: `rgba(244, 243, 240, 0.04)`
- Icon dot: tool color at 35% opacity
- Text color: `rgba(244, 243, 240, 0.7)`

Use CSS transition (0.3s ease) for smooth bloom.

### Gate
`npm run build`

---

## Batch 1: Dot Grid Inverse Vignette

### Read first
- `src/components/DotGrid.tsx` (the shared dot grid component)
- `src/styles/commonplace.css` (search for dot-related rules)

### Changes

#### 1. Inverse vignette in `DotGrid.tsx`

The DotGrid component currently renders dots uniformly across the canvas. Add
a radial fade calculation so dots are invisible at the center and gradually
appear toward the edges.

In the dot rendering loop, after calculating each dot's position, compute:

```typescript
const cx = canvasWidth * 0.5;
const cy = canvasHeight * 0.35; // slightly above center for reading position
const maxR = Math.sqrt(cx * cx + cy * cy);
const dx = dotX - cx;
const dy = dotY - cy;
const dist = Math.sqrt(dx * dx + dy * dy);
const norm = dist / maxR;

// Fade curve: zero at center, grows quadratically toward edges
const fadeCurve = Math.pow(Math.max(0, norm - 0.15) / 0.85, 1.8);
const alpha = fadeCurve * 0.12; // max alpha at edges

if (alpha < 0.005) continue; // skip invisible dots
```

This keeps the center ~15% radius completely clean, then gradually fades dots
in with a quadratic curve. The existing mulberry32 PRNG stays for jitter and
size variation.

#### 2. Apply to CommonPlace only

The `DotGrid` component is shared across all three sites. The inverse vignette
should only apply in the CommonPlace context. Use the existing `noGradient` prop
pattern: add a new prop `inverseVignette?: boolean` and pass it from the
CommonPlace layout:

```tsx
<DotGrid noGradient inverseVignette />
```

When `inverseVignette` is true, apply the radial fade. When false, render
normally (existing behavior for travisgilbert.me).

### Gate
`npm run build`

---

## Batch 2: Library Section Headers + Engine Pulse Hero

### Read first
- `src/components/commonplace/views/LibraryView.tsx` (8KB)
- `src/components/commonplace/views/library/ResumeZone.tsx` (7.8KB)
- `src/components/commonplace/views/library/ResurfacedZone.tsx` (3.6KB)
- `src/components/commonplace/views/library/ThreadChain.tsx` (7KB)
- `src/components/commonplace/views/library/SearchHero.tsx` (1.2KB)
- `src/components/commonplace/views/library/LibraryTypeFilters.tsx` (2.3KB)
- `src/lib/commonplace-api.ts` (search for feed/engine endpoints)

### Changes

#### 1. Section headers: muted weight, not colored monospace

In `LibraryView.tsx`, find every section header rendering (the PICK UP WHERE YOU
LEFT OFF, RESURFACED, RECENT THREAD labels). Change from:

- Colored text (terracotta/red)
- Full opacity

To:

- `color: rgba(26, 24, 22, 0.28)` (or `var(--cp-text-faint)`)
- `fontFamily: var(--cp-font-mono)`
- `fontSize: 9px`
- `fontWeight: 600`
- `letterSpacing: 0.7px`
- `textTransform: uppercase`

Add a secondary description after the label in lighter weight:

```
RESURFACED  Engine chose these for review
```

The secondary text uses `fontWeight: 400`, `marginLeft: 6px`,
`color: rgba(26, 24, 22, 0.18)`.

#### 2. Replace ResumeZone with Engine Pulse

Replace the "Pick up where you left off" block in `ResumeZone.tsx` with an
Engine Pulse terminal. This is a compact dark terminal block (`#1A1C22`
background, border-radius 5px) showing recent engine activity.

Data source: Use the existing notebook feed endpoint or engine events API. If no
dedicated engine event feed exists, derive from the `/api/v1/notebook/feed/`
endpoint, filtering for connection and cluster events.

Each row in the Engine Pulse shows:

```
[time ago]  [icon]  [pass name] found connection: [object A] entails [object B] (confidence)
[time ago]  [icon]  Cluster formed: N objects around [concept]
[time ago]  [icon]  N objects waiting for connections
```

Styling:
- Background: `#1A1C22`
- Font: `JetBrains Mono`, 10px
- Time column: `rgba(244, 243, 240, 0.2)`, fixed width 32px
- Pass names: `#5DCAA5` (engine green)
- Object names: `rgba(244, 243, 240, 0.8)`
- Confidence values: `#C49A4A` (gold)
- General text: `rgba(244, 243, 240, 0.55)`

#### 3. "While you were away" strip

Below the Engine Pulse, add a thin teal strip:

- `background: rgba(45, 95, 107, 0.04)`
- `border-left: 2px solid rgba(45, 95, 107, 0.2)`
- `border-radius: 0`
- Font: JetBrains Mono, 10px, color `#2D5F6B`
- Content: "N new connections while you were away" with a clock icon

This replaces the current separate "While you were away" panel that competed
with the resume zone.

### Gate
`npm run build`

---

## Batch 3: Object Rows with Type Marks

### Read first
- `src/components/commonplace/views/library/ResurfacedZone.tsx` (3.6KB)
- `src/components/commonplace/views/library/ThreadChain.tsx` (7KB)
- `src/components/commonplace/objects/` (entire directory, for existing renderers)
- `src/components/commonplace/objectRenderables.ts` (type mapping)

### Changes

#### 1. Create `ObjectRow.tsx` component

Create `src/components/commonplace/shared/ObjectRow.tsx`. This is the core
building block replacing card grids. Each row displays:

```
[type mark]  [title + description]  [connection count + date]
```

Layout:
- `display: flex; align-items: center; gap: 10px; padding: 8px 12px;`
- `border-radius: 5px`
- Hover: `background: rgba(26, 24, 22, 0.03)`
- Click: opens ObjectDrawer via `openDrawer(slug)`

#### 2. Type marks (left side, flex-shrink: 0)

Each object type gets a geometrically distinct mark. Create these as simple
inline JSX (no separate component files needed):

| Type | Mark | CSS |
|------|------|-----|
| Source | Vertical teal bar | `width: 3px; height: 32px; border-radius: 1px; background: #2D5F6B` |
| Concept | Purple circle with inner node | 24px circle, `rgba(107,79,122,0.1)` bg, `1.5px solid rgba(107,79,122,0.3)` border, 8px inner circle `#6B4F7A` |
| Person | Initial avatar | 26px circle, `rgba(180,90,45,0.1)` bg, 10px font, `#B45A2D` color, IBM Plex Sans 600 |
| Hunch | Dashed rotated square | 24px, `1.5px dashed rgba(196,154,74,0.5)` border, `rgba(196,154,74,0.06)` bg, `transform: rotate(-2deg)`, italic "?" in Vollkorn |
| Note | Subtle rect | 24px, `rgba(26,24,22,0.04)` bg, `1px solid rgba(26,24,22,0.08)` |
| File/URL | Folded-corner rect | 22x28px, `rgba(45,95,107,0.06)` bg, `1px solid rgba(45,95,107,0.15)`, pseudo-element corner fold |
| Event | Date badge | 24px, `rgba(196,154,74,0.08)` bg, `1px solid rgba(196,154,74,0.15)` |
| Task | Checkbox circle | 20px circle, `1.5px solid rgba(26,24,22,0.2)`, no fill |
| Quote | Left-bar italic | 3px terracotta bar + italic Vollkorn snippet |

Resolve type from the object's `objectType` or `kind` field. Use the existing
type mapping in `objectRenderables.ts`.

#### 3. Right side metadata

- Connection count: `font-family: var(--cp-font-mono); font-size: 9px; color: rgba(45,95,107,0.5)` showing "N conn."
- Date: same font, `color: rgba(26,24,22,0.25)`
- Stack vertically with `text-align: right`

#### 4. Replace card grids in ResurfacedZone and ThreadChain

In `ResurfacedZone.tsx`, replace the card grid with a vertical list of
`ObjectRow` components. Remove card styling imports.

In `ThreadChain.tsx`, replace the horizontal card row with a vertical list of
`ObjectRow` components.

For resurfaced items specifically, add engine status text below the title:
- `color: rgba(180, 90, 45, 0.5)`
- `fontFamily: var(--cp-font-mono); fontSize: 9px`
- Content: "Waiting for connections" or "N connections found"

### Gate
`npm run build`

---

## Batch 4: Filter Pills + Polish

### Read first
- `src/components/commonplace/views/library/LibraryTypeFilters.tsx` (2.3KB)

### Changes

#### 1. Quieter filter pills

Replace current filter pill styling with:

- Default: `fontSize: 10px; padding: 3px 10px; borderRadius: 99px; color: rgba(26,24,22,0.3)`
- Active: `background: rgba(26,24,22,0.06); color: rgba(26,24,22,0.6); fontWeight: 500`
- Hover: `background: rgba(26,24,22,0.04)`

Each type filter gets a small 5px colored dot before the label:

```
[dot] Source   [dot] Concept   [dot] Person   [dot] Hunch
```

Dot colors match the type mark colors from Batch 3.

#### 2. Remove competing visual weight

Search for any remaining instances of:
- Terracotta/red section header colors (should all be muted now)
- Heavy card borders on the Library page
- The old ResumeZone card border treatment

Remove or reduce to the new visual weight system.

### Gate
`npm run build`

---

## Batch 5: Models Page Visual Alignment

### Read first
- `src/components/commonplace/models/ModelView.tsx` (3.2KB)
- `src/components/commonplace/models/ModelListPane.tsx` (9.8KB)
- `src/components/commonplace/models/ModelWorkbench.tsx` (9.4KB)
- `src/components/commonplace/models/ModelHeader.tsx` (7.8KB)
- `src/components/commonplace/models/ModuleBrick.tsx` (2.4KB)
- `src/components/commonplace/models/ModuleToggleBar.tsx` (3.8KB)
- `src/components/commonplace/models/AssumptionRegister.tsx` (5.9KB)
- `src/components/commonplace/models/AssumptionRow.tsx` (11.3KB)

### Changes

#### 1. ModelListPane: object rows, not cards

Replace any card-style model entries in `ModelListPane.tsx` with the same
row-based treatment used in the Library. Each model row shows:

- A purple concept-style type mark (models are epistemic structures)
- Model name in IBM Plex Sans 500
- Model type badge: JetBrains Mono, 8px, uppercase, 0.06em letter-spacing
  (e.g., "EXPLANATORY", "CAUSAL", "COMPARATIVE")
- Confidence/completeness indicator: thin progress bar or percentage

The "NEW MODEL" button at the top should use terracotta accent (this is an
action, it earns the color).

#### 2. Empty state

Replace the current DotField + centered text empty state with:

- The inverse vignette dot grid (already available via DotGrid component)
- Centered prompt text uses IBM Plex Sans, not Vollkorn
- Add a subtle JetBrains Mono subtext: "Models encode your understanding.
  Each one is a testable argument."

#### 3. ModuleBrick alignment

The `ModuleBrick` component wraps tensions, methods, compare, falsify, and
narratives. Ensure its header styling matches the new section header treatment:

- Label: JetBrains Mono, 9px, 600 weight, 0.7px letter-spacing, uppercase
- Accent color: module-specific (already defined in `MODULE_META`)
- Use the accent color only on a small left-border or dot, not the full header

#### 4. ModuleToggleBar alignment

The toggle bar should use the same quiet treatment as the Library filter pills:
muted by default, accent color on active/hover.

### Gate
`npm run build`

---

## Files Modified Summary

| File | Batch | Change |
|------|-------|--------|
| `src/components/commonplace/shell/CommonPlaceSidebar.tsx` | 0 | Two-line wordmark, hover color behavior |
| `src/components/commonplace/shell/CommonPlaceSidebar.module.css` | 0 | Hover state for nav icons |
| `src/components/commonplace/shared/ComponentToolbox.tsx` | 0 | Monochrome baseline, color on hover |
| `src/components/DotGrid.tsx` | 1 | inverseVignette prop, radial fade calc |
| `src/app/(commonplace)/layout.tsx` | 1 | Pass inverseVignette to DotGrid |
| `src/components/commonplace/views/LibraryView.tsx` | 2 | Section header styling |
| `src/components/commonplace/views/library/ResumeZone.tsx` | 2 | Replace with Engine Pulse terminal |
| `src/components/commonplace/views/library/SearchHero.tsx` | 2 | Updated styling |
| `src/components/commonplace/shared/ObjectRow.tsx` | 3 | NEW: row component with type marks |
| `src/components/commonplace/views/library/ResurfacedZone.tsx` | 3 | Card grid to object rows |
| `src/components/commonplace/views/library/ThreadChain.tsx` | 3 | Card grid to object rows |
| `src/components/commonplace/views/library/LibraryTypeFilters.tsx` | 4 | Quieter pills with type dots |
| `src/components/commonplace/models/ModelView.tsx` | 5 | Empty state update |
| `src/components/commonplace/models/ModelListPane.tsx` | 5 | Row-based model entries |
| `src/components/commonplace/models/ModuleBrick.tsx` | 5 | Header styling alignment |
| `src/components/commonplace/models/ModuleToggleBar.tsx` | 5 | Quiet toggle treatment |

## What This Spec Does NOT Cover

- Compose sidebar with open questions/gap detection (deferred, separate spec)
- Board view redesign (separate concern)
- Artifacts page pipeline visualization rework (separate concern)
- Mobile responsive adjustments (handled by existing mobile shell)
- Backend engine event feed API (may need a new endpoint if feed does not expose
  pass-level events; if so, create a follow-up backend spec)
- Map/Timeline/Calendar view styling (future visual alignment pass)

## Design Reference

Interactive mockups from this session are available in the Claude.ai project
conversation dated 2026-03-27. Key artifacts:

1. Attention weight map (current vs competitors vs your other sites)
2. Color volume system with before/after comparison
3. Full Library mockup with inverse vignette, type marks, engine pulse
4. Hero alternatives (A: Engine Pulse, B: Open Questions, C: No Hero)

All mockups use the actual CommonPlace palette: terracotta (#B45A2D), teal
(#2D5F6B), gold (#C49A4A), dusty purple (#6B4F7A), graphite chrome (#1C1C20),
vellum (#F4F3F0), engine green (#5DCAA5).
