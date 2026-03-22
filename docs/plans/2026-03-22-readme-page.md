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

## Build Order

1. Extract `mulberry32` + `wobblePath` to shared util
2. Create data file + page shell + surface wrappers
3. Create `PatentMazeBackground` + `ReadmeHeader`
4. Create `SchematicTree` + `SchematicInterstitial`
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
/**
 * Seeded PRNG (mulberry32) for deterministic animations.
 * Extracted from ArchitectureEasterEgg.tsx for reuse.
 */
export function mulberry32(seed: number): () => number {
  // Copy exact implementation from ArchitectureEasterEgg.tsx
}

/**
 * Generate a wobble path between two points.
 * Used for hand-drawn connector SVGs in tree schematics.
 */
export function wobblePath(
  x1: number, y1: number,
  x2: number, y2: number,
  seed: number,
): string {
  // Copy exact implementation from ArchitectureEasterEgg.tsx
}
```

Then update `ArchitectureEasterEgg.tsx` to import from `@/lib/prng` instead of
using its local copies. Verify the Easter egg still works identically.

### 1b. Add design tokens

Add the new CSS custom properties listed above to `global.css` inside `:root`.

### 1c. Create the data file

Create `src/app/(main)/readme/readme-data.ts` containing ALL content for the
page. This is the single source of truth. No content strings in components.

The data file exports:

```typescript
export interface ReadmeBadge {
  label: string;
  value: string;
  color: 'green' | 'teal' | 'terracotta';
}

export interface SchematicSection {
  color: 'terracotta' | 'teal' | 'gold' | 'purple' | 'dim';
  label: string;
  sub?: string;
}

export interface SchematicRow {
  name: string;
  comment?: string;
  color: 'terracotta' | 'teal' | 'gold' | 'purple' | 'dim';
  depth: number;
}

export interface SchematicData {
  id: string;
  title: string;
  subtitle?: string;
  accentColor: string;
  complexityLevel: 1 | 2 | 3 | 4 | 5;
  sections: SchematicSection[];
  rows: SchematicRow[];
  footerLeft: string;
  footerRight?: string;
}

export interface ClaimData {
  number: number;
  title: string;
  description: string;
  stack: string[];
  schematic: SchematicData;
  /** URL for project link (GitHub, live site, etc) */
  url?: string;
}

export interface PriorArtItem {
  name: string;
  note: string;
}

export interface LimitationItem {
  label: string;
  description: string;
}

// Exports:
export const BADGES: ReadmeBadge[];
export const TAGLINE: string;
export const ABSTRACT_PARAGRAPHS: string[];
export const DESCRIPTION_PARAGRAPHS: { text: string; muted?: boolean }[];
export const HOW_I_THINK_PARAGRAPHS: { text: string; muted?: boolean }[];

// Five showcase schematics (full-height interstitials)
export const SHOWCASE_SCHEMATICS: SchematicData[];

// All claims (includes the 5 showcases + additional)
export const CLAIMS: ClaimData[];

export const PRIOR_ART: PriorArtItem[];
export const LIMITATIONS: LimitationItem[];
export const LOOKING_FOR_PARAGRAPHS: { text: string; muted?: boolean }[];
```

**Content for the data file:**

#### Badges
```
build: passing (green)
subscribers: 30k (teal)
status: building in public (terracotta)
videos: 70+ (teal)
```

#### Tagline
"Writer, researcher, self-taught developer. I build tools that think about
information and I make videos about whatever makes me curious."

Sub-line (dim): "I don't have a computer science degree. I do have projects."

#### Abstract (patent register)
3 paragraphs. See Content: Patent Abstract section below.

#### Five showcase schematics (complex to simple)

**1. Theseus Engine** (5/5 complexity)
See Content: Theseus Schematic section below for full tree with redactions.

**2. Index-API** (4/5 complexity)
Sections: APPS (Django + DRF), EPISTEMIC, INFRA
Rows: commonplace/ # core models, connections/ # edge manager,
claims # extracted assertions, epistemic_models # belief structures,
questions # open threads, tensions # stored contradictions,
pgvector # semantic search, PostGIS # geographic queries,
Redis / RQ # task queues
Footer: "Railway, PostgreSQL"

**3. CommonPlace** (4/5 complexity)
Sections: FRONTEND (Next.js + React 19), API (Index-API), DESIGN
Rows: Library/ # cluster cards + D3 graphs, ObjectRenderer/ # polymorphic by type,
Compose/ # authoring + engine terminal, Sidebar/ # Cmd+K + Resurface,
objects/ # notes sources hunches, connections/ # Theseus-generated edges,
epistemic/ # models claims tensions,
rough.js # hand-drawn elements, D3 force # cluster visualization,
DotGrid # spring-physics canvas
Footer: "Tailwind v4, Vercel + Railway"

**4. Compliance.Thelandbank.org** (2/5 complexity)
Sections: DJANGO, INTEGRATION
Rows: compliance/ # tracking engine, models.py # 2K+ homes,
views.py # SOP automation, filemaker/ # fixed connection, postgresql
Footer: "7 steps to 4 buttons"

**5. Codex Plugins: Epistemic ML** (4/5 complexity)
Sections: TWO-SURFACE ARCHITECTURE, EPISTEMIC LAYER, PLUGINS (11 specialists)
Rows: chat_skills/ # planning surface, claude_code/ # implementation surface,
knowledge/ # claims.jsonl + tensions, confidence # Bayesian updating,
session_log/ # per-session observations,
ml-pro # PyTorch + GNNs, scipy-pro # NLP + graph theory,
ui-design-pro # 140 claims @ 0.667 conf, django-engine-pro # 111 claims,
d3-pro # Observable canon, animation-pro # spring physics
Footer: "Self-improving development tools"

#### 12 Claims (complex to simple)

1. Theseus: Epistemic Intelligence Engine
2. Index-API: Knowledge Backend
3. CommonPlace: Knowledge Management Interface
4. Codex Plugins: Epistemic ML Development Tools
5. Publishing API: Writing Studio Backend
6. GitHub-MCP: Custom MCP Server
7. GCLBA Property Sales Portal
8. Compliance.Thelandbank.org
9. Compliance Inspection Tracker
10. travisgilbert.me
11. Curious Tangents: YouTube Channel (30K subs, 70+ videos)
12. Porchfest: Community Music Festival (3,000 people, 30+ acts, 50+ vendors)

Each has a compressed SchematicData for the mini schematic in the third column.

#### Prior Art
Claude Shannon, Vannevar Bush, Edward Tufte, Jane Jacobs

#### Limitations
ADHD, OCD, Dyslexia, No CS Degree, Resources

#### What I'm Looking For
3 paragraphs: "Mentally stimulating work. Reasonable people. Fair compensation."
Then specifics. Then "If you have something that fits..."

### 1d. Create the page shell

Create `src/app/(main)/readme/page.tsx` as a server component.
See the page shell structure in the spec body above.

### 1e. Create surface wrapper components

**ReadmeSection.tsx**: Dark slate wrapper.
**PatentSection.tsx**: Vellum wrapper with teal grid + maze background.
**PatentLabel**: Section header with trailing line.
See full specifications in the spec body above.

### Verification
- `npm run build` passes
- Page renders at `/readme` with alternating dark/light sections

---

## Batch 2: Patent Maze Background + Header

### Read first
- The `theseus-patent-maze.jsx` artifact (WALLS, LABELS arrays)
- `src/components/ArchitectureEasterEgg.tsx` (for `roughLine` pattern)

### 2a. PatentMazeBackground.tsx

Client component. Simplified patent maze SVG at 8% opacity.
Renders WALLS as SVG paths with slight jitter, LABELS as text elements.
No mouse path, foxing, splatter, or cross-hatching.
Tinted teal for wall strokes. See full specification above.

### 2b. ReadmeHeader.tsx

File tab + name + version + tagline + badges. See full specification above.

### Verification
- `npm run build` passes
- Patent sections show faint maze texture at 8% opacity
- Maze is tinted teal, not black

---

## Batch 3: Schematic Tree + Interstitials

### Read first
- `src/lib/prng.ts`
- `src/components/ArchitectureEasterEgg.tsx` (lines 293-386 for ConnectorSVG)
- `src/hooks/usePrefersReducedMotion.ts`

### 3a. SchematicTree.tsx

Shared tree-notation renderer with full and mini variants.
Wobble connector SVGs, stagger animation, redacted row styling.
See full specification above.

### 3b. SchematicInterstitial.tsx

Full-height scroll container wrapping SchematicTree.
85vh min-height, IntersectionObserver trigger, fade+slide entrance.
See full specification above.

### Verification
- `npm run build` passes
- Five interstitials render and animate on scroll
- Reduced motion shows all rows immediately

---

## Batch 4: Claims + Mini Schematics + Remaining Sections

### Read first
- `src/app/(main)/readme/readme-data.ts`
- `src/app/(main)/readme/SchematicTree.tsx`

### 4a-4e: SchematicMini, ClaimsList, PriorArtGrid, LimitationsGrid, InstallBlock

See full specifications above.

### Verification
- `npm run build` passes
- Claims section shows 12 claims with mini schematics
- All sections render correctly

---

## Batch 5: Responsive + Reduced Motion + Polish

### Read first
- All files from Batches 1-4
- `src/styles/global.css`
- `src/components/TopNav.tsx`

### 5a-5e: Responsive audit, reduced motion, scroll animations, nav integration, SEO

See full specifications above.

### Verification
- `npm run build` and `npm run lint` pass
- Page renders at 375px, 430px, 768px, 1024px, 1440px, 1920px
- Reduced motion works
- WCAG AA contrast

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

### Animation timing

| Animation | Duration | Easing | Delay pattern |
|-----------|----------|--------|---------------|
| Section fade-in | 450ms | ease | None |
| Schematic entrance | 600ms | cubic-bezier(0.22, 1, 0.36, 1) | None |
| Tree row stagger | 250ms | ease | +40ms per row |
| Tree section stagger | 300ms | ease | +40ms per row |
| Tree footer | 400ms | ease | +150ms after last row |

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