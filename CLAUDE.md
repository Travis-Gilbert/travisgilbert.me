# travisgilbert.com

## Project Overview

Personal "creative workbench" site: a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements (rough.js). NOT a traditional portfolio or resume.

## Writing Rules

- **No dashes.** Never use em dashes (`—`) or en dashes (`–`) anywhere: not in code comments, not in UI strings, not in markdown content. Use colons, periods, commas, semicolons, or parentheses instead.
- Applies to all files: `.tsx`, `.ts`, `.css`, `.md`, frontmatter strings, JSDoc comments, JSX comments

## Tech Stack

Next.js 15 (App Router), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), rough.js, rough-notation, `next/font` (Google + local), Zod, gray-matter + remark

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | App Router pages and layouts |
| `src/app/fonts.ts` | All 7 font declarations (`next/font/google` + `next/font/local`) |
| `src/app/layout.tsx` | Root layout (DotGrid, TopNav, Footer, metadata) |
| `src/components/` | React components (Server + Client) |
| `src/components/rough/` | Client Components for rough.js visuals (RoughBox, RoughLine, RoughUnderline) |
| `src/content/` | Markdown content collections (essays, field-notes, shelf, toolkit, projects) |
| `src/lib/content.ts` | Content loading: Zod schemas, `getCollection()`, `getEntry()`, `renderMarkdown()` |
| `src/lib/slugify.ts` | Tag slug utility |
| `src/components/SectionLabel.tsx` | Monospace colored section headers (terracotta/teal/gold) |
| `src/styles/global.css` | Design tokens, surface utilities, prose variants, timeline CSS |
| `docs/plans/` | Design documents and implementation plans |
| `public/fonts/` | Self-hosted Amarna variable font |

## Development Commands

```bash
npm run dev        # Start Next.js dev server
npm run build      # Production build (SSG)
npm run start      # Serve production build locally
npm run lint       # Run Next.js linter
```

## Content Workflow

1. Create a `.md` file in the appropriate `src/content/` subdirectory
2. Fill in frontmatter matching the Zod schema in `src/lib/content.ts`
3. Push to `main` (Vercel auto-deploys)

## Architecture Notes

### Server vs Client Components

Most components are **Server Components** by default. Components needing browser APIs use `'use client'`:

| Client Component | Why |
|-----------------|-----|
| `DotGrid.tsx` | Canvas animation, rAF, mouse/touch events |
| `TopNav.tsx` | `usePathname()`, mobile menu `useState` |
| `ShelfFilter.tsx` | Filter state via `useState` |
| `YouTubeEmbed.tsx` | Click-to-load facade via `useState` |
| `ConsoleEasterEgg.tsx` | `console.log` in `useEffect` |
| `rough/RoughBox.tsx` | Canvas drawing via `useRef` + `useEffect` |
| `rough/RoughLine.tsx` | Canvas drawing |
| `rough/RoughUnderline.tsx` | Canvas drawing |
| `rough/RoughCallout.tsx` | Canvas straight-line callouts |
| `rough/RoughPivotCallout.tsx` | Canvas 45° leader-line callouts |
| `ScrollReveal.tsx` | IntersectionObserver scroll animations |
| `ProjectColumns.tsx` | Role-based column layout with expand/collapse cards |
| `CyclingTagline.tsx` | Typewriter animation via useState/useEffect |
| `ToolkitAccordion.tsx` | Radix Accordion with expand/collapse state |
| `ProjectTimeline.tsx` | Timeline layout with interactive state |
| `MarginNote.tsx` | Positioned margin annotations |
| `SourcesCollapsible.tsx` | Radix Collapsible for essay sources |
| `PatternImage.tsx` | Seeded generative canvas (3 layers: dots, curves, contours) |

Server Components can import and render Client Components; children pass through as a slot without hydrating.

### SketchIcon System

`SketchIcon` (`src/components/rough/SketchIcon.tsx`) is a Server Component that renders hand-drawn SVG section identity icons. Used on all section page headers, replacing Phosphor icons for brand consistency.

10 icon names: `magnifying-glass`, `file-text`, `gears`, `note-pencil`, `briefcase`, `wrench`, `book-open`, `chat-circle`, `tag`, `info`.

Props: `name`, `size` (default 32), `color` (default currentColor), `className`. All paths are `fill="none"` with `strokeWidth={1.8}` and round linecap/linejoin for felt-tip pen effect.

**Note:** Phosphor icons are still used for functional UI glyphs (CaretDown, ArrowSquareOut, ArrowRight, List, X) where brand identity isn't needed.

### Font System

`next/font` sets CSS variables on `<html>` via `fontVariableClasses` (from `src/app/fonts.ts`). Global CSS bridges these to Tailwind `@theme inline`:

```
next/font > --font-vollkorn (CSS var on <html>)
global.css > --font-title: var(--font-vollkorn), Georgia, serif
Tailwind > font-title class
```

7 fonts: Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, Space Mono (Google), Amarna (local).

### Content Loading

`src/lib/content.ts` replaces Astro's `getCollection()`:
- Reads `src/content/{name}/*.md` with `gray-matter`
- Validates frontmatter with Zod schemas
- Renders markdown with `remark` + `remark-gfm` + `remark-html`
- Dynamic routes use `generateStaticParams()` (replaces Astro's `getStaticPaths()`)

### RoughBox Pattern

`RoughBox` is the primary card container site-wide: hand-drawn canvas borders with transparent brand-color fills. Props:

| Prop | Default | Description |
|------|---------|-------------|
| `tint` | `'neutral'` | Brand-color fill wash: `'terracotta'` / `'teal'` / `'gold'` / `'neutral'` |
| `elevated` | `true` | Warm brown box-shadow |
| `hover` | `false` | Lift-on-hover animation (opt-in for linked cards) |
| `stroke` | derived from `tint` | rough.js border color; auto-matches tint when not set |

**Architecture:** Surface styles (tint, shadow) go on the wrapper `<div>` via CSS classes. The canvas only draws the hand-drawn stroke. Stroke color is derived from `tint` via `tintStroke` map unless explicitly overridden.

**Color mapping:**

| Card Type | tint | stroke | fill opacity |
|-----------|------|--------|-------------|
| EssayCard | terracotta | `#B45A2D` | 4.5% |
| FieldNoteEntry | teal | `#2D5F6B` | 4% |
| ShelfItem | gold | `#C49A4A` | 5% |
| Toolkit boxes | terracotta | `#B45A2D` | 4.5% |
| Connect box | teal | `#2D5F6B` | 4% |
| Neutral (404, etc) | neutral | `#3A3632` | 2.5% |

### RoughPivotCallout Pattern

`RoughPivotCallout` draws architectural leader lines with a 45° pivot for featured content annotations. Geometry: horizontal segment (~30% of `totalLength`) then an 18px diagonal stub. Text starts right after the pivot point.

| Prop | Default | Description |
|------|---------|-------------|
| `side` | `'right'` | Which side of the card the callout branches from |
| `tint` | `'terracotta'` | Color matching the parent card |
| `offsetY` | `16` | Vertical offset from positioned parent |
| `totalLength` | `187` | Total leader-line length (horizontal + diagonal) |
| `pivotDown` | `true` | Diagonal direction |

Used on homepage featured cards (investigation and working idea). Two callouts max per card, staggered on opposite sides.

### ProgressTracker System

`ProgressTracker` (`src/components/ProgressTracker.tsx`) visualizes content lifecycle stages. Two variants:

| Variant | Usage | Visual |
|---------|-------|--------|
| `ProgressTracker` (default) | Homepage featured card | Connected dots with labels, 3 states (complete/current/upcoming) |
| `CompactTracker` (named export) | Listing cards (EssayCard, FieldNoteEntry) | Dots only + single label for current stage |

**Stage definitions** (also exported):
- `ESSAY_STAGES`: research, drafting, production, published (4 stages, terracotta)
- `NOTE_STAGES`: observation, developing, connected (3 stages, teal)

Generic `stages` array prop; works for any content type. Both are Server Components (no client-side state).

### PatternImage System

`PatternImage` (`src/components/PatternImage.tsx`) is a Client Component that renders deterministic generative art on canvas. Used as visual fallback when essays have no YouTube thumbnail.

**Three rendering layers:**
1. Grid dots with radial fade from center
2. Organic bezier curves with varying thickness
3. Topographic contour lines

**Props:** `seed` (string, determines pattern via PRNG), `height`, `color` (CSS custom property), `className`. Seed from slug ensures same essay always gets same pattern. DPR-aware canvas scaling.

### NowPreview

`NowPreview` (`src/components/NowPreview.tsx`) is a Server Component that reads `src/content/now.md` frontmatter. Displays a 2x2 grid of current activities (Researching, Reading, Building, Listening to) in a neutral RoughBox. Update by editing `src/content/now.md` frontmatter fields.

### EssayCard Image Hierarchy

EssayCard (`src/components/EssayCard.tsx`) uses a 3-tier image system:
1. YouTube thumbnail (when `youtubeId` exists): left-side thumbnail in md:flex layout
2. Curated image (future: `image` frontmatter field): not yet implemented
3. PatternImage fallback: generative canvas header seeded from slug

All variants show CompactTracker in the top-right corner alongside DateStamp.

### ProjectColumns Pattern

`ProjectColumns` is a Client Component that renders projects grouped by role in a responsive column grid. Intentionally does NOT use RoughBox (three-state dynamic rgba tinting is incompatible with RoughBox's fixed CSS classes).

**Role configuration:** Each role has a hex color, rgb string, label, and description. Roles are matched via `slugifyRole()` which does `.toLowerCase().replace(/\s+/g, '-')`. The `&` character is preserved (e.g., "Built & Designed" becomes `"built-&-designed"`).

| Role | Color | Hex |
|------|-------|-----|
| Built & Designed | Teal | `#2D5F6B` |
| Project Managed | Terracotta | `#B45A2D` |
| Organized | Gold | `#C49A4A` |
| Created | Green | `#5A7A4A` |

**Card three-state tinting** (rest/hover/expanded) uses inline `rgba(ROLE_RGB, opacity)`:

| State | Background | Border | Shadow |
|-------|-----------|--------|--------|
| Rest | 5.5% | 0% (invisible) | 2% |
| Hover | 9% | 25% | 5% |
| Expanded | 10% | 35% | 8% |

**Column dividers:** 2px solid dark charcoal (`#3A3632`) at 25% opacity. Uniform color across all columns (not per-role) for visual alignment.

**Content schema:** Projects have an optional `organization` field added to the Zod schema in `content.ts`. The `date` field is serialized to ISO string across the RSC boundary (Server Component passes `.toISOString()`, Client Component receives string).

### Surface Materiality System

The site uses a layered texture system to create skeuomorphic depth:

1. **Page level**: DotGrid canvas (spring physics) + paper grain (`body::after` SVG feTurbulence at 2.5%)
2. **Card level**: Transparent tint fill + warm shadow + rough.js colored stroke
3. **Content level**: SectionLabel (monospace colored headers), TagList with tint-matched colors

**Key CSS classes** (in `global.css`):
- `.surface-elevated`: warm shadow only (no bg-color; tint handles fill)
- `.surface-tint-{color}`: transparent brand-color wash
- `.surface-hover`: lift animation with shadow transition

### Section Color Language

Each content type has a brand color that flows through labels, icons, tags, card tints, and borders:

| Section | Color | Label Text |
|---------|-------|-----------|
| On ... / Toolkit | Terracotta (`#B45A2D`) | ON ... / WORKSHOP TOOLS |
| Field Notes / Connect | Teal (`#2D5F6B`) | FIELD NOTES / OPEN CHANNEL |
| Projects / Shelf | Gold (`#C49A4A`) | PROJECTS / REFERENCE SHELF |

Components: `SectionLabel` (monospace header), `TagList` (tint prop), `SketchIcon` (hand-drawn SVG page icons)

## Deployment

Vercel with native Next.js builder. Git integration auto-deploys on push to `main`. No `vercel.json` needed; Vercel auto-detects Next.js. **Important:** Vercel dashboard Project Settings > Output Directory must be blank/default (not `dist`).

## Status: Three-Phase Buildout

### Phase 1: Foundation + Surface Materiality ✅ Complete

| Item | Status |
|------|--------|
| Astro to Next.js 15 migration | ✅ |
| RoughBox site-wide card borders | ✅ |
| Surface materiality layer (tints, grain, shadows) | ✅ |
| Card tint + colored borders | ✅ |
| Section color system (labels, icons, tags) | ✅ |
| Font system (7 fonts + CSS variable bridging) | ✅ |
| Content pipeline (gray-matter + remark + Zod) | ✅ |
| Vercel deployment | ✅ Auto-deploys on push to main |

### Phase 2: Micro-interactions + Page Redesigns ✅ Complete

| Item | Status |
|------|--------|
| Homepage redesign as creative workbench | ✅ |
| ScrollReveal scroll-triggered animations | ✅ |
| RoughCallout editor's-notes callouts | ✅ |
| Caveat handwritten font + `--font-annotation` token | ✅ |
| RoughPivotCallout 45° leader-line callouts | ✅ |
| Featured essay promoted (no outer box, scale hierarchy) | ✅ |
| Projects page: role-based column layout (ProjectColumns) | ✅ |
| Projects page: past-tense role labels, YouTube "Created" column | ✅ |
| Homepage hero: compact name + CyclingTagline typewriter | ✅ |
| Nav restructure: On ... / Field Notes / Projects / Toolkit / Connect | ✅ |
| Homepage section reorder: On, Projects, Field Notes (shelf removed) | ✅ |
| "Work in Progress" badge on featured card | ✅ |
| Radix UI primitives (Accordion, Collapsible, ToggleGroup) | ✅ |
| Evidence callout labels in article blockquotes | ✅ |
| DateStamp subtle color enhancement (terracotta-light) | ✅ |
| Custom skeuomorphic icons (SketchIcon) replacing Phosphor on pages | ✅ |
| Colophon no-dash rule enforcement | ✅ |
| SketchIcon overflow fix (`overflow="visible"` + `flex-shrink-0`) | ✅ |
| DotGrid interaction tuning (influenceRadius=150, repulsionStrength=15) | ✅ |
| Blueprint grid removal (CSS + RoughBox `grid` prop) | ✅ |
| Taxonomy rename: investigations to essays, working-ideas merged into field-notes | ✅ |
| ProgressTracker (full + compact variants) | ✅ |
| PatternImage generative canvas fallback | ✅ |
| NowPreview /now section on homepage | ✅ |
| EssayCard + FieldNoteEntry compact trackers | ✅ |
| Footer redesign with colophon link | ✅ |
| Content schema updates (essay stage, field note status) | ✅ |
| Redirects for old investigation/working-ideas URLs | ✅ |

Decided during brainstorm: Radix Primitives + fully custom styling (no shadcn/ui).
See `docs/plans/2026-02-15-surface-materiality-layer-design.md` for surface materiality design.
See `docs/plans/2026-02-16-projects-page-redesign.md` for projects column layout design.
See `docs/records/001-site-wide-redesign.md` for full redesign record with user stories.

### Phase 3: Animations + Content + Polish 🔜 Next

| Item | Status |
|------|--------|
| Mobile responsive polish (typography, spacing, breakpoints) | ✅ |
| Caveat font trimmed to single weight (400 only) | ✅ |
| Homepage custom metadata export | ✅ |
| Tag page SEO descriptions | ✅ |
| Open Graph image (`opengraph-image.tsx` via `ImageResponse`) | ✅ |
| Twitter card upgraded to `summary_large_image` | ✅ |
| Nav SketchIcons (replaced Phosphor in TopNav) | ✅ |
| Nav/layout max-width alignment (both `max-w-4xl`) | ✅ |
| ProjectColumns `whitespace-nowrap` overflow fix | ✅ |
| DrawOnIcon animation (SVG stroke animation on scroll/hover) | Not started |
| MarginAnnotation positioned handwritten notes | Not started |
| Nav restructure: 5 items (Essays on.../Field Notes/Projects/Toolkit/Connect) | Not started |
| Essay detail page: full ProgressTracker + related notes sidebar | Not started |
| Field note detail page: CompactTracker in header | Not started |
| Additional content pages and essays | Not started |
| Dark mode (design tokens already prepared in global.css) | Not started |

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| UI library | Radix Primitives (not shadcn/ui) | Full custom styling over brand; shadcn opinionated defaults fight the aesthetic |
| Section color system | terracotta=essays, teal=field-notes, gold=projects | Creates wayfinding language; color tells you where you are on the site |
| No dashes | Colons, periods, parentheses, semicolons | User style preference; applies to all code, comments, and content |
| Projects: no RoughBox | Inline rgba tinting with three states | RoughBox's fixed CSS classes can't handle dynamic rest/hover/expanded opacity |
| Nav restructure | On ... / Field Notes / Projects / Toolkit / Connect | Shelf and Colophon folded into Toolkit; Projects promoted above Field Notes |
| "Essays on ..." naming | "On ..." prefix for essay section | Less institutional; signals essayistic depth; pattern reinforced by individual titles |
| Section icons | SketchIcon (hand-drawn SVG) for pages, Phosphor for UI glyphs | Brand identity icons match rough.js aesthetic; utility icons stay crisp |
| Evidence callouts | `.prose-investigations blockquote::before` with `:has()` selector | Only investigation articles get "NOTE" labels; semantic CSS, no component changes |
| OG image | `opengraph-image.tsx` with `ImageResponse` (Satori) | Auto-generated at build, brand-consistent, no static PNG to maintain |
| Taxonomy rename | investigations to essays, working-ideas merged into field-notes | Less institutional naming; essays signals depth; field-notes consolidates shorter content |
| ProgressTracker | Generic stages array, two variants (full + compact) | Same component serves essays (4 stages) and field notes (3 stages); avoids duplication |
| PatternImage | Seeded PRNG canvas, 3 layers | Deterministic from slug so patterns are stable; fallback when no video/image exists |
| EssayCard image fallback | YouTube > curated > PatternImage (3-tier) | Every card gets a visual header; PatternImage is zero-maintenance generative fallback |

## Gotchas

- **Canvas stacking context**: Body needs `isolation: isolate`, canvas needs `z-index: -1`, `background-color` on `html` (not body); otherwise body bg paints over canvas
- **Canvas DPR scaling**: Multiply canvas dimensions by `devicePixelRatio`, use `ctx.scale(dpr, dpr)`, set CSS size to logical pixels
- **Phosphor icons in Server Components**: Import from `@phosphor-icons/react/dist/ssr` (not default export)
- **Route handlers need force-static**: `sitemap.ts` and `rss.xml/route.ts` require `export const dynamic = 'force-static'`
- **Next.js 15 async params**: Dynamic route `params` is `Promise<{ slug: string }>`; must `await` it
- **Vercel Output Directory**: Dashboard must have Output Directory blank/default. `dist` setting from old Astro config breaks Next.js builds
- **Font variable bridging**: `next/font` vars (e.g., `--font-vollkorn`) are distinct from Tailwind theme aliases (e.g., `--font-title`). Bridge in `global.css` `@theme inline`
- **RoughBox needs `position: relative`** for absolute-positioned children like RoughPivotCallout to anchor correctly
- **ScrollReveal + headless testing**: Elements start at `opacity: 0`; IntersectionObserver won't fire in headless browsers. Force visibility for visual testing
- **Callout overlap**: Two callouts on the same side of a card will overlap if their total heights (canvas + text) exceed the vertical gap between them. Always stagger on opposite sides
- **Zod schema backward compat**: When adding `callouts` array field, keep the existing singular `callout` field. Page component prefers array, falls back to singular
- **ProjectColumns role slug with `&`**: `slugifyRole()` only strips whitespace, so `&` stays in slugs. If you ever add a URL-safe slugifier, the ROLE_CONFIG keys will break
- **Date serialization across RSC boundary**: `projects/page.tsx` passes `.toISOString()` because Date objects can't cross the Server/Client Component boundary
- **OG image via `opengraph-image.tsx`**: Next.js auto-injects `og:image` meta tag from this file. Do NOT also set `metadata.openGraph.images` in `layout.tsx` or it will conflict
- **Satori (OG image) CSS limitations**: Only flexbox layout, no grid. Every element needs `display: 'flex'`. No `position: relative` on children without it
- **PatternImage CSS color parsing**: Uses a temporary DOM element to resolve CSS custom properties (e.g., `var(--color-terracotta)`) to hex. Runs in useEffect so SSR returns empty canvas; hydration fills it
- **ProgressTracker stage defaults**: EssayCard defaults missing `stage` to `'published'`; FieldNoteEntry only shows CompactTracker when `status` prop is present (graceful degradation for content without status field)
