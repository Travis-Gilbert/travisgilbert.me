# README Page: Patent/README Hybrid About Page

> **For Claude Code. One batch per session. Read entire spec before writing code.**
> **Read every file listed under "Read first" before writing a single line.**
> **Run `npm run build` after every batch. Do not proceed if the build fails.**
> **No em dashes anywhere in code, comments, or copy.**

---

## What This Is

A page at `/readme` on travisgilbert.me that replaces the traditional "about"
page with a README.md / Patent Application hybrid. The page alternates between
two visual registers:

1. **README sections** on a dark slate surface (`#1C1C20`) with cream text,
   using Vollkorn + IBM Plex Sans (the personal voice)
2. **Patent sections** on warm vellum (`#F0EBE4`) with dark text, a teal
   fine-line grid overlay, and JetBrains Mono (the formal institutional voice)

Patent sections include the Theseus patent maze SVG at 8% opacity as a
background texture. The viewer does not need to immediately understand what it
is; it rewards close inspection.

The page includes five full showcase sections (Theseus, Index-API, CommonPlace,
Compliance System, Codex Plugins) with scroll-triggered architecture schematics,
plus six additional projects as compressed Claims with inline mini-schematics.

Architecture schematics use tree-notation matching the existing
`ArchitectureEasterEgg.tsx`: wobble-path SVG connectors via `mulberry32` seeded
PRNG, staggered row-by-row reveal on scroll, section labels with colored pips,
`#` comments, and the terracotta/teal/gold/purple color coding.

## Audience

Everyone: hiring managers, developers, YouTube viewers, researchers. The page
leads with the most complex work (Theseus) and progresses toward simpler
projects. The format does the self-advocacy so the writing does not have to.

---

## Route & File Map

```
src/app/(main)/readme/
  page.tsx                          # Server component, page shell, metadata
  readme-data.ts                    # ALL content: sections, claims, schematics, prior art
  ReadmeHeader.tsx                  # File tab + name + badges (client)
  ReadmeSection.tsx                 # Dark slate README surface wrapper
  PatentSection.tsx                 # Vellum patent surface wrapper + teal grid + maze bg
  PatentMazeBackground.tsx          # The maze SVG at 8% opacity (client, lazy loaded)
  SchematicInterstitial.tsx         # Full-height scroll schematic with tree notation (client)
  SchematicTree.tsx                 # Shared tree-notation renderer (wobble paths, stagger)
  SchematicMini.tsx                 # Compressed inline schematic for Claims column
  ClaimsList.tsx                    # Patent-register claims with mini schematics (client)
  LimitationsGrid.tsx               # Known limitations grid
  InstallBlock.tsx                  # Code block contact section
  PriorArtGrid.tsx                  # Acknowledged influences grid
```

All interactive components are client components (`'use client'`).
The page shell (`page.tsx`) is a server component that imports them.

---

## Dependencies

No new npm dependencies. The page uses only libraries already in the project:

- `rough.js` (already installed, for potential future rough elements)
- `framer-motion` (already installed, for scroll-triggered reveals)
- Existing hooks: `usePrefersReducedMotion`, `useThemeColor`
- Existing utilities: `mulberry32` from `ArchitectureEasterEgg.tsx` (extract
  to shared util)

---

## Design Tokens

### New CSS custom properties (add to `global.css` inside `:root`)

```css
/* README page surfaces */
--color-readme-bg: #1C1C20;
--color-readme-bg-soft: #222226;
--color-readme-border: #2E2E34;
--color-readme-text: #F0EBE4;
--color-readme-text-muted: #B8AFA5;
--color-readme-text-dim: #7A746C;

/* Schematic interstitial surface (distinctly darker than README) */
--color-interstitial-bg: #141416;
--color-interstitial-border: rgba(240, 235, 228, 0.06);

/* Patent surface (reuse existing vellum tokens if they exist, else add) */
--color-patent-bg: #F0EBE4;
--color-patent-text: #2A2420;
--color-patent-text-secondary: #6B6358;
--color-patent-text-tertiary: #9B9488;
--color-patent-border: #D4CFC7;
--color-patent-grid: rgba(45, 95, 107, 0.045);

/* Connector lines for tree schematics */
--color-connector: #2E2E34;
--color-connector-patent: #C8C2B8;
```

### Existing tokens to reference (do NOT duplicate)

```
--color-terracotta, --color-teal, --color-gold
--color-bg (parchment), --color-ink-primary, --color-ink-secondary
```

---

## Interstitial Isolation (CRITICAL LAYOUT RULE)

Schematic interstitials MUST read as their own distinct visual events, not as
extensions of the content sections above or below them. Without explicit
isolation, they visually merge with adjacent ReadmeSections (same dark
background) or collide with each other (back-to-back interstitials).

### The problem

The page has three surface types side by side:
```
PatentSection  (vellum #F0EBE4)
Interstitial   (transparent = dark slate leaks through = #1C1C20)
ReadmeSection  (dark slate #1C1C20)    <-- SAME COLOR, no separation
Interstitial   (transparent = #1C1C20)  <-- merges with above
ReadmeSection  (dark slate #1C1C20)    <-- merges with above
```

Two interstitials back-to-back (Compliance + Codex Plugins after Claims) are
even worse: two 85vh sections with nothing distinguishing them.

### The fix: three layers of isolation

**1. Own background color.** Interstitials get `--color-interstitial-bg: #141416`,
which is noticeably darker than the README slate (`#1C1C20`). This creates a
visible darkening when you scroll from a ReadmeSection into an interstitial.
The schematic tree notation, rendered in cream and accent colors, floats on
this darker ground. The effect is similar to a dimmed stage before a spotlight
comes on.

**2. Top and bottom border lines.** Each interstitial has `border-top` and
`border-bottom` of `1px solid var(--color-interstitial-border)` (cream at 6%
opacity). These are faint but visible, creating a "this is a different zone"
signal. On the vellum-to-interstitial transition (Patent section above), the
top border reinforces the surface change. On the slate-to-interstitial
transition (ReadmeSection above), the border + background shift together
create separation.

**3. Generous internal padding.** Each interstitial has `padding: 80px 0`
in addition to the `min-height: 85vh` and flex centering. This ensures the
tree notation never visually touches the border lines, and the border lines
never visually touch the adjacent section's content. The padding creates
at least 80px of breathing room on each side.

### Back-to-back interstitials

When two interstitials are adjacent (Compliance + Codex Plugins), they share
a single border between them (the bottom border of the first doubles as the
top border of the second). Between them, insert a thin spacer element:

```html
<div className="interstitial-divider" />
```

Styled as:
```css
.interstitial-divider {
  height: 1px;
  background: var(--color-interstitial-border);
  margin: 0;
}
```

This prevents the two interstitials from reading as one giant empty space.

### Transition between surfaces

The page reads as a rhythm of three distinct surfaces:

```
DARK SLATE    (README: content you read)
DEEP BLACK    (Interstitial: architecture you watch build)
WARM VELLUM   (Patent: formal claims you inspect)
DEEP BLACK    (Interstitial: architecture you watch build)
DARK SLATE    (README: content you read)
```

Each transition should be perceptible but not jarring. The background color
differences are subtle (slate #1C1C20 to deep #141416 is a 5% luminance
drop), but combined with the border lines and the change in content type
(prose to animation), the viewer registers "I'm in a different zone."

---

## Animation Choreography (CRITICAL)

The schematic build animation is the visual centerpiece of this page. The user
should be able to watch each line materialize and read it before the next one
appears. This is not a fast stagger; it is a deliberate, readable unfold.

### Purpose Test (animation-design)

1. **Relationship**: The build order reveals the architecture's structure.
   Sections appear first, establishing categories; then rows fill in beneath
   them, showing what each category contains.
2. **Orientation**: The top-to-bottom build direction mirrors how someone
   reads a file tree, reinforcing that this IS a codebase you're looking at.

### Build Sequence for Full-Height Schematics

The build has four phases. Each phase completes before the next begins.
All timing is from the moment the schematic enters the viewport.

**Phase 1: Container entrance (0ms to 800ms)**
The entire schematic container fades in and slides up.
- `opacity: 0 -> 1`, `translateY(40px) -> 0`
- Duration: 800ms
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` (smooth deceleration)
- Nothing inside is visible yet. The container is a blank space that settles
  into position.

**Phase 2: Header builds (800ms to 1300ms)**
After the container has settled, the header materializes:
- The colored pip slides in from the left (translateX(-8px) -> 0, 400ms)
- The title text fades in simultaneously (opacity 0 -> 1, 400ms)
- The subtitle fades in 150ms after the title (opacity 0 -> 1, 300ms)
- Total phase duration: ~500ms

**Phase 3: Tree rows build, one by one (1300ms onward)**
This is the main event. Each tree element (section headers and node rows)
appears sequentially with a 120ms gap between each.

For each **section header**:
- The colored pip appears (opacity 0 -> 1, 100ms)
- The label and subtitle fade in (opacity 0 -> 1, 350ms, ease-out)
- An extra 200ms pause follows before the next element (breathing room
  between groups). This pause is critical: it separates logical groups
  visually, so the viewer perceives the architecture's structure.

For each **node row**:
- The wobble connector SVG draws itself via `stroke-dashoffset` animation:
  set `stroke-dasharray` to the path length, animate `stroke-dashoffset`
  from path-length to 0 over 350ms with `ease-out`. The line appears to
  be drawn from top-left toward the node name.
- The node name fades in as the connector reaches it (opacity 0 -> 1,
  `translateX(-6px) -> 0`, 350ms, ease-out). Start 100ms after the
  connector begins drawing, so there is a slight overlap.
- The `#` comment text fades in 150ms after the node name starts appearing
  (opacity 0 -> 1, 300ms, ease-out). This secondary stagger makes the
  comment feel like an annotation added after the structure, not part of it.

For **[REDACTED] rows** specifically:
- The connector draws as dashed (stroke-dasharray pattern, not solid)
- The `[REDACTED]` text appears in dim color
- The strikethrough comment fades in at lower opacity (0.4 instead of 1)
- The whole row takes the same timing but feels visually muted

**Phase 4: Footer materializes (last row + 300ms)**
- 300ms gap after the last tree row finishes
- Footer left text fades in (opacity 0 -> 0.6, 400ms)
- Complexity pips fill one by one with 80ms between each (opacity 0 -> 1,
  scale(0.8) -> scale(1), 200ms each)

### Total build time examples

- Theseus (15 rows + 4 sections): ~1300ms + (19 * 120ms) + (4 * 200ms extra)
  + 300ms footer = ~4680ms (~4.7 seconds)
- CommonPlace (10 rows + 3 sections): ~1300ms + (13 * 120ms) + (3 * 200ms)
  + 300ms footer = ~3760ms (~3.8 seconds)
- Compliance (5 rows + 2 sections): ~1300ms + (7 * 120ms) + (2 * 200ms)
  + 300ms footer = ~2640ms (~2.6 seconds)

These durations are intentional. The viewer should have time to read each line
as it appears. The Theseus schematic in particular should feel like watching
an engineering document being typed out.

### Connector SVG Stroke Animation (implementation detail)

Each wobble connector SVG path needs:
```typescript
// On mount or when becoming visible:
const pathRef = useRef<SVGPathElement>(null);

useEffect(() => {
  if (!pathRef.current || !isVisible) return;
  const length = pathRef.current.getTotalLength();
  pathRef.current.style.strokeDasharray = `${length}`;
  pathRef.current.style.strokeDashoffset = `${length}`;
  // Trigger draw animation after the row's stagger delay
  requestAnimationFrame(() => {
    pathRef.current!.style.transition =
      `stroke-dashoffset 350ms ease-out ${delayMs}ms`;
    pathRef.current!.style.strokeDashoffset = '0';
  });
}, [isVisible, delayMs]);
```

### Reduced Motion Strategy

When `prefers-reduced-motion: reduce`:
- Skip all four phases. Everything is visible immediately at full opacity.
- No stroke-dashoffset animation on connectors.
- No translateY/translateX on any element.
- The schematic simply appears, fully formed, when it enters the viewport.
- This is an **instant cut**, not a reduced-speed version.

### Section fade-ins (non-schematic content)

README and Patent text sections use a simpler reveal:
- `opacity: 0 -> 1`, `translateY(16px) -> 0`
- Duration: 500ms, ease
- Triggered by IntersectionObserver (threshold 0.08, rootMargin `0px 0px -30px 0px`)
- These are NOT the showcase. Keep them simple so the schematics stand out.

---

## Build Order

1. Extract `mulberry32` + `wobblePath` to shared util
2. Create data file + page shell + surface wrappers
3. Create `PatentMazeBackground` + `ReadmeHeader`
4. Create `SchematicTree` + `SchematicInterstitial` (with full choreography)
5. Create `ClaimsList` + `SchematicMini` + remaining sections
6. Responsive + reduced-motion + final polish

---

## Batch 1: Foundation

### Read first
- `src/styles/global.css` (first 200 lines for existing token names)
- `src/app/(main)/layout.tsx` (to understand the main layout wrapper)
- `src/components/ArchitectureEasterEgg.tsx` (lines 1-100 for `mulberry32`,
  `wobblePath`, color map; lines 260-386 for `ConnectorSVG`)
- `src/hooks/usePrefersReducedMotion.ts`

### 1a. Extract shared utilities

Create `src/lib/prng.ts`:
```typescript
export function mulberry32(seed: number): () => number {
  // Copy exact implementation from ArchitectureEasterEgg.tsx
}

export function wobblePath(
  x1: number, y1: number,
  x2: number, y2: number,
  seed: number,
): string {
  // Copy exact implementation from ArchitectureEasterEgg.tsx
}
```

Then update `ArchitectureEasterEgg.tsx` to import from `@/lib/prng`.
Verify the Easter egg still works identically.

### 1b. Add design tokens

Add the new CSS custom properties listed above to `global.css` inside `:root`.
This includes the new `--color-interstitial-bg` and `--color-interstitial-border`
tokens.

### 1c. Create the data file

Create `src/app/(main)/readme/readme-data.ts` with ALL content.
(See data file type definitions and content descriptions from original spec.)

### 1d. Create the page shell

Create `src/app/(main)/readme/page.tsx` as a server component.

**CRITICAL: Page shell must include interstitial-divider elements between
back-to-back interstitials.**

```tsx
{/* Claims (patent) */}
<PatentSection>
  <PatentLabel>Claims</PatentLabel>
  <h2>What is Claimed is:</h2>
  <ClaimsList claims={CLAIMS} />
</PatentSection>

{/* Schematic interstitial: Compliance */}
<SchematicInterstitial data={SHOWCASE_SCHEMATICS[3]} />

{/* Divider between back-to-back interstitials */}
<div className="interstitial-divider" />

{/* Schematic interstitial: Codex Plugins */}
<SchematicInterstitial data={SHOWCASE_SCHEMATICS[4]} />
```

### 1e. Create surface wrapper components

**ReadmeSection.tsx**: Dark slate wrapper (`--color-readme-bg`).

**PatentSection.tsx**: Vellum wrapper with teal grid + maze background.

**SchematicInterstitial wrapper styling** (applied in SchematicInterstitial.tsx):
- `background: var(--color-interstitial-bg)` (deep black #141416)
- `border-top: 1px solid var(--color-interstitial-border)`
- `border-bottom: 1px solid var(--color-interstitial-border)`
- `padding: 80px 0` in addition to flex centering and min-height

**PatentLabel**: Section header with trailing line.

### Verification
- `npm run build` passes
- Page renders at `/readme` with three visually distinct surface types
- Interstitials are noticeably darker than README sections
- Faint border lines visible at interstitial boundaries
- Back-to-back interstitials have a divider between them

---

## Batch 2: Patent Maze Background + Header

### Read first
- The `theseus-patent-maze.jsx` artifact (WALLS, LABELS arrays)
- `src/components/ArchitectureEasterEgg.tsx` (for `roughLine` pattern)

### 2a. PatentMazeBackground.tsx

Client component. Simplified patent maze SVG at 8% opacity.
Renders WALLS as SVG paths with slight jitter, LABELS as text elements.
No mouse path, foxing, splatter, or cross-hatching.
Tinted teal for wall strokes.

### 2b. ReadmeHeader.tsx

File tab + name + version + tagline + badges.

### Verification
- `npm run build` passes
- Patent sections show faint maze texture at 8% opacity
- Maze is tinted teal, not black

---

## Batch 3: Schematic Tree + Interstitials (Animation-Critical)

### Read first
- **The Animation Choreography section above (read it in full before coding)**
- **The Interstitial Isolation section above (read it in full before coding)**
- `src/lib/prng.ts`
- `src/components/ArchitectureEasterEgg.tsx` (lines 260-386 for ConnectorSVG
  depth logic, wobble path seeding, L-shape vs T-shape branching)
- `src/hooks/usePrefersReducedMotion.ts`

### 3a. SchematicTree.tsx

Shared client component. Core rendering engine for both full and mini variants.

**Props:**
```typescript
interface SchematicTreeProps {
  data: SchematicData;
  variant: 'full' | 'mini';
  isVisible?: boolean;
  isSettled?: boolean;
}
```

The `isSettled` prop is critical. Tree rows do NOT begin stagger until
`isSettled` is true. Container entrance (Phase 1) must complete first.

Full implementation details for rendering logic, node rows, section headers,
footer, redacted rows, and mini variant are specified in the Animation
Choreography section above. Follow those timings exactly.

### 3b. SchematicInterstitial.tsx

Client component wrapping SchematicTree in a full-height container.

**Container styling (isolation):**
```css
.schematic-interstitial {
  min-height: 85vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  background: var(--color-interstitial-bg);
  border-top: 1px solid var(--color-interstitial-border);
  border-bottom: 1px solid var(--color-interstitial-border);
  position: relative;
}
```

The `background`, `border-top`, and `border-bottom` are what prevent the
interstitial from merging with adjacent sections. Without these, the
schematic floats on the same dark slate as the README text and the viewer
cannot tell where content ends and the schematic zone begins.

**State machine:**
```
hidden -> entering (IntersectionObserver, threshold 0.15)
entering -> settled (800ms timer)
settled -> building (immediate, isSettled passed to SchematicTree)
```

**Responsive:**
- Below 800px: `min-height: 70vh`, padding `60px 20px`, inner width `280px`
- Below 480px: `min-height: 60vh`, padding `48px 16px`, inner width `260px`

### Verification
- `npm run build` passes
- Interstitials are visually distinct from adjacent sections (darker bg, border lines)
- Scroll from a ReadmeSection into an interstitial: the background darkens
  slightly and border lines appear. This is perceptible.
- Two back-to-back interstitials are separated by the divider element
- Schematics build with the full 4-phase choreography
- Connector lines draw themselves
- Reduced motion: instant cut, everything visible at once

---

## Batch 4: Claims + Mini Schematics + Remaining Sections

### Read first
- `src/app/(main)/readme/readme-data.ts`
- `src/app/(main)/readme/SchematicTree.tsx`

### 4a. SchematicMini.tsx

Wrapper around `SchematicTree variant="mini"`. Static, no animation.
Container: `border: 1px solid var(--color-patent-border)`, radius 4px,
background `rgba(255,255,255,0.2)`, padding 10px 8px.

### 4b. ClaimsList.tsx

12 claims in a 3-column grid: `36px 1fr 180px`.
Mini schematic in the third column. Responsive: drops to 2-column below 800px.

### 4c-4e. PriorArtGrid, LimitationsGrid, InstallBlock

Unchanged from original spec.

### Verification
- `npm run build` passes
- Claims show mini schematics alongside descriptions
- All remaining sections render correctly

---

## Batch 5: Responsive + Reduced Motion + Polish

### Read first
- All files from Batches 1-4
- `src/styles/global.css`
- `src/components/TopNav.tsx`

### 5a. Responsive audit

Test at: 375px, 430px, 768px, 1024px, 1440px, 1920px.

Key breakpoints:
- **< 480px**: Name 28px, schematics 260px, claims single-column,
  interstitial padding 48px
- **< 640px**: Name 32px, version tag on own line, prior art single column
- **< 800px**: Claims drop mini schematic column, interstitials 280px,
  interstitial padding 60px
- **>= 1024px**: Full layout, interstitials 340px, padding 80px

### 5b. Reduced motion (instant cut)

When `prefers-reduced-motion: reduce`:
- All animations disabled. Instant visibility.

### 5c. Navigation + SEO

Add "README" to TopNav. Standard metadata.

### Verification
- `npm run build` and `npm run lint` pass
- All 6 test widths render correctly
- Three distinct surfaces are visible at every width
- Reduced motion verified
- WCAG AA contrast on all three surfaces

---

## Styling Rules

### Typography mapping

| Context | Font | Size | Weight |
|---------|------|------|--------|
| README h2 | Vollkorn | 25px | 700 |
| README body | IBM Plex Sans | 15.5px | 400 |
| README dim | IBM Plex Sans | 13px | 400 |
| Patent h2 | JetBrains Mono | 16px | 600 |
| Patent body | JetBrains Mono | 13px | 400 |
| Patent label | JetBrains Mono | 10px | 500 |
| Badges | JetBrains Mono | 11px | 500 |
| Claim number | JetBrains Mono | 13px | 600 |
| Claim title | JetBrains Mono | 13px | 600 |
| Claim desc | JetBrains Mono | 11.5px | 400 |
| Stack tag | JetBrains Mono | 9.5px | 400 |
| Tree name (full) | JetBrains Mono | 11px | 400 |
| Tree comment (full) | JetBrains Mono | 9px | 400 |
| Tree name (mini) | JetBrains Mono | 8px | 400 |

### Color mapping for tree schematics

| Color name | CSS variable | Use |
|-----------|-------------|-----|
| terracotta | var(--color-terracotta) | Theseus, pipeline, frontend |
| teal | var(--color-teal) | Django backends, data layer |
| gold | var(--color-gold) | Infrastructure, design, composition |
| purple | #6B4F7A / #9B84AD | MCP, community projects, plugins |
| dim | var(--color-readme-text-dim) | Data stores, static files, redacted |

### Three-surface system

| Surface | Background | Text | Use |
|---------|-----------|------|-----|
| README (dark slate) | #1C1C20 | #F0EBE4 | Personal voice, prose content |
| Interstitial (deep black) | #141416 | accent colors | Architecture schematics |
| Patent (warm vellum) | #F0EBE4 | #2A2420 | Formal claims, prior art |

---

## Content: Patent Abstract

Paragraph 1:
"A method and apparatus for investigating whatever is interesting, comprising:
a curiosity-driven video production pipeline (70+ videos, 30,000 subscribers),
an epistemic intelligence engine capable of measuring its own cognition across
seven axes, a knowledge management workbench designed for a brain that does
not hold still, a self-improving plugin ecosystem with Bayesian confidence
updating across 250+ typed knowledge claims, a government property sales
portal, a compliance tracking system that consolidated a seven-step
six-software SOP into four button presses, and a community music festival
serving 3,000 attendees with 30+ musical acts and 50+ vendors annually."

Paragraph 2:
"The system operates under persistent resource constraints (see: Known
Limitations) and compensates through the construction of external cognitive
instruments including production pipelines, task management architectures,
writing workflows, and measurement frameworks."

Paragraph 3:
"The inventor is based in Flint, Michigan. The inventor does not have a
computer science degree. The inventor does have projects."

---

## Content: Theseus Schematic (with redactions)

```
THESEUS ENGINE                          IQ 17.6 -> 35.7
---------------------------------------------------
PIPELINE                                7 passes
  1                                     # SBERT embedding
  2                                     # BM25 lexical
  3                                     # NLI classification
  [REDACTED]                            # ~~structural similarity~~
  5                                     # spaCy NER
  6                                     # community detection
  7                                     # IQ measurement
[REDACTED]                              Level 4-8 capabilities
  [REDACTED]                            # ~~GNN link prediction~~
  [REDACTED]                            # ~~counterfactual sim~~
OUTPUT
  knowledge_graph                       # neurons + weights
COMPUTE
  ONNX Runtime                          # frequent inference
  Modal GPU                             # training jobs
  [REDACTED]                            # ~~LoRA fine-tuning~~
---------------------------------------------------
Objects = Neurons, Edges = Weights      [5/5]
```

---

## Reference Prototypes

| Artifact | Version | What it shows |
|----------|---------|---------------|
| readme-patent-prototype.html | v1 | Initial two-register concept, static SVG diagram |
| readme-v2-dark-slate.html | v2 | Dark slate README + vellum patent, margin schematics |
| readme-v3-tree-schematics.html | v3 | Tree-notation schematics matching Easter egg |
| readme-v4-full-height-schematics.html | v4 | Full-height interstitials + compressed inline minis |

All prototypes are HTML files built during the March 22 design session.
The v4 prototype is closest to the final design direction.