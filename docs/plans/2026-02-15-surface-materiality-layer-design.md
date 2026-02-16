# Surface Materiality Layer — Design Document

> **Date**: 2026-02-15
> **Status**: Approved
> **Goal**: Transform flat, clean surfaces into textured, skeuomorphic "documents on a drafting table"

---

## Problem

The site feels empty and flat despite having strong brand foundations (warm palette, rough.js borders, interactive dot grid, good typography). The root cause: **surfaces lack physical materiality**.

- RoughBox draws a hand-drawn border around transparent space — no fill, no texture, no shadow
- Cards don't feel like objects sitting on a surface; they feel like regions marked by a line
- Zero skeuomorphic depth despite the brand guide specifying: paper grain, blueprint grids, vellum layers, warm shadows
- Interactions are static — no hover feedback suggesting physical objects
- Color palette is underused — almost everything is terracotta or neutral; teal, gold, and secondary colors barely appear
- Site reads as "too polished / too clean" rather than "creative workbench"

## Solution

A **surface materiality layer** applied globally through CSS and component upgrades. No new pages, no restructuring — purely adding texture, depth, and color richness to what exists.

---

## Part 1: Surface Texture System

### A. RoughBox Upgrade — Border to Full Surface

RoughBox gains new props (all defaulting ON):

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `grid` | boolean | `true` | 40px blueprint grid lines inside card |
| `grain` | boolean | `true` | SVG paper noise texture |
| `elevated` | boolean | `true` | `bg-surface` + warm shadow |
| `hover` | boolean | `false` | Lift-on-hover animation (opt-in for linked cards) |

**Visual stack when all defaults active:**
```
[hand-drawn rough.js border]
  └─ [opaque bg-surface (#FAF6F1)]
       └─ [blueprint grid ::before — opacity 0.15]
            └─ [paper grain ::after — opacity 0.03]
                 └─ [warm brown box-shadow]
                      └─ [content]
```

**Architecture:** Surface styles go on the wrapper `<div>`, NOT on the canvas. RoughBox canvas stays responsible only for the hand-drawn stroke. This keeps concerns separated — textured surface without rough borders (or vice versa) remains possible.

**Blueprint grid CSS (::before pseudo-element):**
```css
background-image:
  linear-gradient(var(--color-border-light) 1px, transparent 1px),
  linear-gradient(90deg, var(--color-border-light) 1px, transparent 1px);
background-size: 40px 40px;
opacity: 0.15;
```

**Paper grain CSS (::after pseudo-element):**
```css
/* Inline SVG feTurbulence as background-image */
background-image: url("data:image/svg+xml,...");
opacity: 0.03;
```

**Where grid appears:**
- Investigation cards (homepage + listing)
- Field note entries (homepage + listing)
- Project cards
- Shelf items
- Toolkit boxes
- Connect box
- Blockquote/callout cards within articles

**Where grid does NOT appear:**
- Full article prose (long-form text — grid distracts from reading)
- Page background (DotGrid canvas handles this)
- Navigation / footer

### B. Global Paper Grain on `<body>`

A CSS `::after` pseudo-element on `body`:
- Inline SVG `feTurbulence` filter
- `opacity: 0.025`
- `position: fixed; inset: 0; pointer-events: none; z-index: 9999`
- Makes the parchment background (#F0EBE4) feel like actual paper
- One-time global CSS — zero per-component cost

### C. Warm Shadow Design Tokens

Added to `global.css` `@theme inline`:

```css
--shadow-warm-sm:  0 1px 2px rgba(42, 36, 32, 0.05);
--shadow-warm:     0 2px 8px rgba(42, 36, 32, 0.07), 0 1px 3px rgba(42, 36, 32, 0.04);
--shadow-warm-lg:  0 4px 16px rgba(42, 36, 32, 0.10), 0 2px 6px rgba(42, 36, 32, 0.05);
```

Brown-tinted, not gray. Matches brand rule: "warm shadows, not gray."

### D. Card Hover Interaction

Cards that link (InvestigationCard, FieldNoteEntry, ProjectCard, ShelfItem) pass `hover={true}` to RoughBox.

On hover:
- Shadow: `--shadow-warm-sm` -> `--shadow-warm`
- Transform: `translateY(-1px)`
- Title: already transitions to terracotta (exists)
- Transition: `box-shadow 0.2s ease, transform 0.2s ease`

Feels like picking up a document from a stack.

---

## Part 2: Richer Color Usage

### Section Header Labels

Each content section gets a monospace label above the heading, in a **section-specific color**:

| Section | Label Text | Color | Hex |
|---------|-----------|-------|-----|
| Investigations | `INVESTIGATION FILE` | Terracotta | #B45A2D |
| Field Notes | `FIELD OBSERVATION` | Teal | #2D5F6B |
| Projects | `PROJECT ARCHIVE` | Gold | #C49A4A |
| Toolkit | `REFERENCE MATERIALS` | Teal | #2D5F6B |
| Shelf | `THE SHELF` | Gold | #C49A4A |

Format: Courier Prime, 11px, uppercase, letter-spacing 0.1em.

### Tag Chips — Content-Type Tinting

Tags get a faint background tint based on content type:

| Content Type | Tag Background | Tag Border |
|-------------|---------------|------------|
| Investigations | `rgba(180, 90, 45, 0.06)` | `rgba(180, 90, 45, 0.15)` |
| Field Notes | `rgba(45, 95, 107, 0.06)` | `rgba(45, 95, 107, 0.15)` |
| Projects | `rgba(196, 154, 74, 0.06)` | `rgba(196, 154, 74, 0.15)` |
| Default | Current neutral border | `var(--color-border)` |

### Evidence Callout Labels

Blockquotes within articles gain a monospace label:
```
FIELD NOTE — SOURCE DOCUMENT
```
- Courier Prime, 10px, uppercase, terracotta
- Sits above the quote text inside the callout box
- Matches the brand guide's evidence-tagging pattern

### DateStamp Enhancement

DateStamp component gets a subtle color upgrade:
- Currently: plain monospace in `ink-muted`
- New: monospace in `ink-muted` with a faint `terracotta-light` (#D4875A) tint
- Gives timestamps a "case file stamp" presence

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/styles/global.css` | Shadow tokens, paper grain, surface utility classes |
| `src/components/rough/RoughBox.tsx` | Add grid, grain, elevated, hover props; surface background |
| `src/components/InvestigationCard.tsx` | Pass `hover={true}`, section label color |
| `src/components/FieldNoteEntry.tsx` | Pass `hover={true}`, section label color |
| `src/components/ProjectCard.tsx` | Pass `hover={true}` |
| `src/components/ShelfItem.tsx` | Pass `hover={true}` |
| `src/components/TagList.tsx` | Accept `tint` prop for content-type coloring |
| `src/components/DateStamp.tsx` | Subtle color enhancement |
| `src/app/page.tsx` | Section labels with per-section colors |
| `src/app/investigations/page.tsx` | Section label |
| `src/app/field-notes/page.tsx` | Section label |
| `src/app/projects/page.tsx` | Section label |
| `src/app/toolkit/page.tsx` | Section label |
| `src/app/shelf/page.tsx` | Section label |

## Files NOT Modified

- `DotGrid.tsx` — untouched, dot grid stays as page background
- `TopNav.tsx` — no changes needed
- `Footer.tsx` — no changes needed
- Article prose pages — no grid on reading surfaces

---

## Design Principles Guiding This Work

From the brand guide CLAUDE.md:

1. Paper texture over flat color
2. Blueprint grids as subtle card-level patterns (NOT page background)
3. Warm shadows, not gray
4. Cards should feel like layered documents
5. Never flat/sterile — always some texture, depth, or material quality
6. Monospace labels for metadata in Courier Prime uppercase
7. Broader use of teal (#2D5F6B), gold (#C49A4A), and accent variants
