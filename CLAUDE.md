<!-- project-template: 48 -->
# travisgilbert.com

## Project Overview

Personal "creative workbench" site: a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements (rough.js). NOT a traditional portfolio or resume.

## Writing Rules

- **No dashes.** Never use em dashes (`—`) or en dashes (`–`) anywhere: not in code comments, not in UI strings, not in markdown content. Use colons, periods, commas, semicolons, or parentheses instead.
- Applies to all files: `.tsx`, `.ts`, `.css`, `.md`, frontmatter strings, JSDoc comments, JSX comments

## Tech Stack

Next.js 15 (App Router), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), rough.js, rough-notation, `next/font` (Google + local), Zod, gray-matter + remark, Django 5.x (publishing_api + research_api), DRF, django-cotton, django-crispy-forms (`studio` pack), django-tailwind, django-template-partials

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | App Router pages and layouts |
| `src/app/fonts.ts` | All 7 font declarations: Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, JetBrains Mono (Google) + Amarna (local) |
| `src/app/layout.tsx` | Root layout (DotGrid, TopNav, Footer, ArchitectureEasterEgg, metadata) |
| `src/components/` | React components (Server + Client) |
| `src/components/rough/` | Client Components for rough.js visuals (RoughBox, RoughLine, RoughUnderline) |
| `src/content/` | Markdown content collections (essays, field-notes, shelf, toolkit, projects) |
| `src/lib/content.ts` | Content loading: Zod schemas, `getCollection()`, `getEntry()`, `renderMarkdown()`, `estimateReadingTime()`, `injectAnnotations()` |
| `src/lib/slugify.ts` | Tag slug utility |
| `src/lib/comments.ts` | Comment CRUD: file-based JSON storage in `data/comments/` |
| `src/lib/paragraphPositions.ts` | Maps paragraph indices to Y offsets for sticky note positioning |
| `src/lib/recaptcha.ts` | reCAPTCHA v3 server-side token verification |
| `src/app/api/comments/` | REST endpoints: GET/POST comments, POST flag |
| `src/components/SectionLabel.tsx` | Monospace colored section headers (terracotta/teal/gold) |
| `src/styles/global.css` | Design tokens, surface utilities, prose variants, timeline CSS |
| `docs/plans/` | Design documents and implementation plans |
| `public/fonts/` | Self-hosted Amarna variable font |
| `src/config/site.json` | Site configuration (tokens, nav, footer, SEO, pages); Django commits updates via GitHub API |
| `src/lib/siteConfig.ts` | Zod-validated config loader with in-memory cache; `getSiteConfig()`, `getPageComposition()`, `getVisibleNav()` |
| `src/lib/connectionEngine.ts` | Graph-based content relationship engine for ThreadLines, ConnectionDots, and ConnectionMap |
| `src/app/connections/page.tsx` | Connection Map page: pre-computed D3 graph data for content relationships |
| `publishing_api/` | Django Studio: full site management control panel (content, tokens, nav, composition, SEO). See design doc in `docs/plans/` |
| `publishing_api/apps/editor/widgets.py` | Custom form widgets: TagsWidget, SlugListWidget, StructuredListWidget, ColorPickerWidget, JsonObjectListWidget |
| `publishing_api/apps/editor/context_processors.py` | Injects `studio_nav` context (content types, compose pages, settings links) into all templates |
| `publishing_api/apps/publisher/github.py` | GitHub Contents API (single file) + Git Trees API (atomic multi-file commits) |
| `publishing_api/templates/cotton/` | 7 Cotton components: card, btn, badge, section_label, toast, stage_pill, field |
| `publishing_api/crispy_studio/` | Custom crispy-forms template pack (`studio`): field, fieldset, input, select, textarea, checkbox templates |
| `publishing_api/theme/` | django-tailwind theme app: `static_src/` with brand tokens config, Tailwind input CSS |
| `research_api/` | Django research API: source tracking, backlinks, Webmention receiver, DRF read-only API. Sibling service to publishing_api |
| `research_api/apps/research/` | Source, SourceLink, ResearchThread, ThreadEntry models + backlink computation service |
| `research_api/apps/mentions/` | Webmention model + W3C webhook receiver |
| `research_api/apps/api/` | DRF read-only viewsets (sources, links, threads, mentions, backlinks, graph, activity) + internal promote endpoint |
| `research_api/apps/paper_trail/` | Public browsing pages: explorer (D3 graph), essay trail, threads, community wall with HTMX suggestion form |
| `research_api/apps/publisher/` | PublishLog model, GitHub API client, JSON serializers, publish orchestrator (commits to `src/data/research/`) |
| `publishing_api/apps/intake/services.py` | OG metadata scraping (`scrape_og_metadata`) + cross-service source promotion (`promote_to_research` via httpx) |
| `research_api/apps/research/recaptcha.py` | reCAPTCHA v3 server-side verification; single `verify_recaptcha()` returning `(passed, score)` tuple |
| `research_api/apps/research/views.py` | Public submission endpoints (suggest source, suggest connection) with reCAPTCHA + approved suggestions read endpoint |
| `research_api/apps/research/services.py` | `detect_content_type()` (essay vs field_note heuristic), `get_backlinks()`, `get_all_backlinks()` |

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start Next.js dev server
npm run build      # Production build (SSG)
npm run start      # Serve production build locally
npm run lint       # Run Next.js linter
```

```bash
# Django Studio (from publishing_api/)
python manage.py import_content             # Import all markdown into Django DB
python manage.py import_content --dry-run   # Parse and report without writing
python manage.py import_content --type essays  # Import one content type only
```

```bash
# Django Studio dev server (from publishing_api/)
python manage.py runserver               # Dev server on port 8000
python manage.py tailwind start          # Tailwind CSS watch mode (run in parallel)
python manage.py tailwind build          # Production Tailwind build
```

```bash
# Research API (from research_api/)
python3 manage.py runserver 8001          # Dev server (8001 to avoid conflict with publishing_api)
python3 manage.py publish_research        # Publish all research data as JSON to Next.js repo
python3 manage.py publish_research --dry-run  # Preview without committing
```

## Content Workflow

**Manual (current):**
1. Create a `.md` file in the appropriate `src/content/` subdirectory
2. Fill in frontmatter matching the Zod schema in `src/lib/content.ts`
3. Push to `main` (Vercel auto-deploys)

**Via Django Studio (when deployed):**
1. Create/edit content in Studio's editor (markdown toolbar, autosave, split-pane)
2. Move through visual pipeline: Draft -> Review -> Published
3. Studio commits `.md` to GitHub via Contents API; Vercel auto-deploys
4. Site config changes (tokens, nav, SEO) commit to `src/config/site.json` via Git Trees API

## Architecture Notes

### Server vs Client Components

Most components are **Server Components** by default. Components needing browser APIs use `'use client'`:

| Client Component | Why |
|-----------------|-----|
| `DotGrid.tsx` | Canvas animation, rAF, mouse/touch events |
| `TopNav.tsx` | `usePathname()`, mobile menu `useState` |
| `ShelfFilter.tsx` | Filter state via `useState` |
| `YouTubeEmbed.tsx` | Click-to-load facade via `useState` |
| `ConsoleEasterEgg.tsx` | `console.log` in `useEffect`; props from layout (stats, latest essay, fun facts) |
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
| `rough/DrawOnIcon.tsx` | IntersectionObserver SVG stroke draw animation for page headers |
| `CollageHero.tsx` | Full-bleed dark-ground homepage hero, ResizeObserver reports height to `--hero-height` |
| `EssayHero.tsx` | Full-bleed editorial header for essay detail pages, YouTube/PatternImage background |
| `ArticleBody.tsx` | Prose wrapper with paragraph click-to-comment and position tracking |
| `ArticleComments.tsx` | Orchestrates sticky note layer and mobile comment list for essays |
| `CommentForm.tsx` | reCAPTCHA-protected comment submission form (sticky note style) |
| `StickyNote.tsx` | Individual reader comment card with flag/date |
| `StickyNoteLayer.tsx` | Absolute-positioned margin layer that positions sticky notes at paragraph offsets |
| `MobileCommentList.tsx` | Below-article comment list for viewports narrower than xl |
| `ReadingProgress.tsx` | Thin progress bar at top of viewport during article scroll |
| `NowPreviewCompact.tsx` | 2x2 grid /now snapshot (Server Component reading `now.md`, but has `inverted` prop for hero) |
| `StudioShortcut.tsx` | Invisible Ctrl+Shift+E handler; maps current path to Django Studio URL via `NEXT_PUBLIC_STUDIO_URL` |
| `ConnectionDots.tsx` | Interactive paragraph dots in essay margins; click to reveal connection threads; uses `connectionEngine` |
| `ThreadLines.tsx` | rough.js canvas lines connecting related content paragraphs; reads `ThreadPair` data from connectionEngine |
| `DesignLanguageEasterEgg.tsx` | Hidden design language easter egg (replaces ArchitectureEasterEgg); 5-phase state machine, rough.js border, wobble SVG connectors, rAF animation loop |
| `ConnectionMap.tsx` | D3 force-directed graph with rough.js canvas edges for `/connections` page; synchronous 300-iteration layout |
| `StampDot.tsx` | Animated current-stage dot with scatter micro-dots; plays stamp animation on mount, respects prefers-reduced-motion |
| `ParallaxStack.tsx` | Subtle scroll-driven vertical parallax between child layers; capped at +/- 15px, touch devices get 50% intensity |
| `PipelineCounter.tsx` | Live build counter on homepage showing content stats (essays, notes, projects, shelf items, connections) |

Server Components can import and render Client Components; children pass through as a slot without hydrating.

### SketchIcon System

`SketchIcon` (`src/components/rough/SketchIcon.tsx`) is a Server Component that renders hand-drawn SVG section identity icons. Used on all section page headers, replacing Phosphor icons for brand consistency.

10 icon names: `magnifying-glass`, `file-text`, `gears`, `note-pencil`, `briefcase`, `wrench`, `book-open`, `chat-circle`, `tag`, `info`.

Props: `name`, `size` (default 32), `color` (default currentColor), `className`. All paths are `fill="none"` with `strokeWidth={1.8}` and round linecap/linejoin for felt-tip pen effect.

**Note:** Phosphor icons are still used for functional UI glyphs (CaretDown, ArrowSquareOut, ArrowRight, List, X) where brand identity isn't needed.

### DrawOnIcon Animation

`DrawOnIcon` (`src/components/rough/DrawOnIcon.tsx`) is a Client Component that wraps the same SVG paths from SketchIcon but adds an IntersectionObserver-triggered stroke draw animation. Used on all 9 section page headers (replacing SketchIcon in those locations).

**Technique:** `pathLength="1"` normalizes any SVG path to a 0..1 range. `strokeDashoffset` transitions from 1 (hidden) to 0 (drawn) via CSS transition. No `getTotalLength()` measurement needed.

**Props:** `name` (IconName), `size` (32), `color` (currentColor), `className`, `duration` (800ms), `delay` (0ms).

**Accessibility:** Respects `prefers-reduced-motion: reduce` by showing the icon immediately without animation. Observer disconnects after first trigger.

**SketchIcon still used for:** Nav icons (16px, always visible in sticky nav where animation would be distracting).

### Collage Hero System

Two full-bleed editorial hero components share a common pattern: dark ground with cream typography, ResizeObserver reporting height to `--hero-height`, and a multi-stop gradient fade to parchment.

**CollageHero** (`src/components/CollageHero.tsx`): Homepage hero. Dark ground (#2A2824), paper grain overlay, optional PNG fragments (desk objects in `public/collage/`), 3-column grid (1fr 118px 1fr) matching RoughLine label alignment. Name uses Vollkorn 700 (`--font-title`). Receives CyclingTagline and NowPreviewCompact as `inverted` slots. Breaks out of `max-w-4xl` via `margin-left: calc(-50vw + 50%); width: 100vw`. Pulls into main's padding via negative top margin reading `--main-pad-y`.

**EssayHero** (`src/components/EssayHero.tsx`): Essay detail page header. YouTube thumbnail (via `next/image` with `fill`) or PatternImage as background with dark overlay (`--color-hero-overlay` at 70%). Category label (first tag, Courier Prime 11px, uppercase, terracotta with short rule). Date + reading time in top-right corner (9px, cream 50%). Large cream title, summary, inverted TagList and ProgressTracker slots. Same breakout and height-reporting pattern as CollageHero.

**DotGrid zone awareness**: Both heroes set `--hero-height` on `<html>`. DotGrid reads this to render cream dots (`[240, 235, 228]` at 35%) over the dark zone, standard dark dots below, with a 50px crossfade band. Scroll listener redraws static dots so the color boundary moves as the user scrolls.

**Fragment layer** (CollageHero): `FRAGMENTS` array of `CollageFragment` objects with `src`, `alt`, `left`, `top`, `width`, `height`, `rotate`, `z`, `opacity`, `hideOnMobile`. Renders as absolute-positioned `next/image` elements. Currently has 4 fragments; gracefully renders empty.

### MarginAnnotation System

Frontmatter-driven handwritten margin notes on essays, rendered entirely via CSS (no Client Component).

**Architecture:**
1. Essay frontmatter: `annotations: [{ paragraph: 1, text: "..." }]`
2. `injectAnnotations()` utility in `content.ts`: counts `</p>` tags, inserts `<span class="margin-annotation-anchor">` with `data-annotation-text` and `data-annotation-side` attributes
3. CSS `::after` pseudo-elements display the text using `content: attr(data-annotation-text)`
4. Annotations alternate right/left sides automatically

**Responsive behavior:**
- Desktop (xl+, 1280px): absolute positioned in margin beside prose via `left: calc(100% + 1.5rem)`, width `min(450px, calc((100vw - 100%) / 2 - 3rem))`, Caveat font
- Mobile/tablet: inline block below paragraph with subtle terracotta border-top

### Font System

`next/font` sets CSS variables on `<html>` via `fontVariableClasses` (from `src/app/fonts.ts`). Global CSS bridges these to Tailwind `@theme inline`:

```
next/font > --font-vollkorn (CSS var on <html>)
global.css > --font-title: var(--font-vollkorn), Georgia, serif
Tailwind > font-title class
```

7 fonts: Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, JetBrains Mono (Google), Amarna (local). JetBrains Mono replaced Space Mono as `--font-code` for code comments and the `font-code` Tailwind class.

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

**Outer wrapper requires explicit `width: 450`** on the absolutely positioned div. Without it, shrink-to-fit sizing collapses text to one word per line (`max-width` alone has no effect on absolute elements with no `width`). Both callout components also set `maxWidth: calc((100vw - Xpx) / 2 - gap)` to prevent overflow at narrow viewports. `RoughPivotCallout` uses 960px (accounts for featured card's `xl:-mx-8` negative margin); `RoughCallout` uses 896px (standard `max-w-4xl` content width).

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

`NowPreview` (`src/components/NowPreview.tsx`) is a Server Component that reads `src/content/now.md` frontmatter. Displays a 2x2 grid of current activities (Researching, Reading, Building, Listening to) in a neutral RoughBox with a "See more →" link to `/now`. Full page version at `src/app/now/page.tsx` with expanded layout and descriptions. Update by editing `src/content/now.md` frontmatter fields.

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

**Content schema:** Projects have an optional `organization` field added to the Zod schema in `content.ts`. Projects also have an optional `callout` field (string) for handwritten annotations on homepage cards. The `date` field is serialized to ISO string across the RSC boundary (Server Component passes `.toISOString()`, Client Component receives string).

### Surface Materiality System

The site uses a layered texture system to create skeuomorphic depth:

1. **Page level**: DotGrid canvas (spring physics) + paper grain (`body::after` SVG feTurbulence at 2.5%)
2. **Card level**: Transparent tint fill + warm shadow + rough.js colored stroke
3. **Content level**: SectionLabel (monospace colored headers), TagList with tint-matched colors

**Key CSS classes** (in `global.css`):
- `.surface-elevated`: warm shadow only (no bg-color; tint handles fill)
- `.surface-tint-{color}`: transparent brand-color wash
- `.surface-hover`: lift animation with shadow transition

### Site Configuration Cascade

Four-layer system where each layer is optional and overrides the one above:

1. **`global.css` defaults**: Hardcoded CSS custom properties (current source of truth)
2. **`src/config/site.json`**: Design tokens, nav, footer, SEO (Django Studio commits updates here via GitHub API)
3. **Page composition**: Per-page visual overrides (e.g., essays page uses terracotta accent, toolkit uses custom layout)
4. **Content instance composition**: Per-item overrides via `composition` JSONField in frontmatter

`src/lib/siteConfig.ts` loads `site.json` with Zod validation and in-memory caching. Falls back to `DEFAULT_CONFIG` (matching current hardcoded values) if file is missing or malformed. Components can progressively adopt `getSiteConfig()` and `getVisibleNav()` instead of hardcoded values.

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

**Django services (Railway):** Both `publishing_api/` and `research_api/` deploy to Railway with PostgreSQL. Each has `railway.toml` (nixpacks builder, migrate + collectstatic + gunicorn start command). Environment variables: `SECRET_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`. research_api also needs `WEBMENTION_TARGET_DOMAIN`.

## Status

Phases 1 through 4 (Foundation, Micro-interactions, Animations, Polish) are **all complete**. See `docs/records/001-site-wide-redesign.md` for full history.

**Branding Overhaul (plan-01):** Complete (8 phases) on branch `feature/branding-homepage-interactions`, pushed to remote. See `docs/plans/plan-01-branding-homepage-interactions.md` for the full spec. Key changes: font system overhaul (Space Mono removed, JetBrains Mono added as `--font-code`), CodeComment component for workbench annotations, PipelineCounter live build counter on homepage, ParallaxStack subtle scroll parallax, ConnectionMap D3 force graph at `/connections`, DesignLanguageEasterEgg (replaces ArchitectureEasterEgg), StampDot animation on ProgressTracker for recently advanced content. Merge to `main` pending review.

**Django Studio:** Full site management control panel. Brand component library redesign complete. See `docs/plans/2026-02-25-studio-redesign-design.md` for the design doc and `docs/records/002-publishing-api.md` for the original scaffold. Django check passes (0 issues). Not yet deployed to Railway or tested end-to-end.

**Research API:** Deployed to Railway at research.travisgilbert.me. Source promotion pipeline: Sourcebox triage accept in publishing_api calls research_api's `/api/v1/internal/promote/` endpoint via Bearer token auth. See `docs/records/003-research-api.md`.

**Next step:** Deploy publishing_api to Railway, set cross-service env vars (`INTERNAL_API_KEY` on both, `RESEARCH_API_URL`/`RESEARCH_API_KEY` on publishing_api), test promotion pipeline end-to-end, set `NEXT_PUBLIC_STUDIO_URL` in Vercel.

**Remaining backlog:**
- Sourcebox UX redesign (brainstorm in progress)
- Additional content pages and essays (not started)
- Dark mode (deferred; tokens ready in `global.css`)
- Collage hero fragment library (desk item photography, `public/collage/`)
- Component integration: TopNav, layout.tsx, CollageHero, DotGrid could consume siteConfig instead of hardcoded values

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| UI library | Radix Primitives (not shadcn/ui) | Full custom styling over brand; shadcn opinionated defaults fight the aesthetic |
| Section color system | terracotta=essays, teal=field-notes, gold=projects | Creates wayfinding language; color tells you where you are on the site |
| No dashes | Colons, periods, parentheses, semicolons | User style preference; applies to all code, comments, and content |
| Nav restructure | Essays on... / Field Notes / Projects / Toolkit / Shelf / Connect | 6 items; Shelf promoted to top-level nav; Colophon in footer only |
| Section icons | SketchIcon (hand-drawn SVG) for pages, Phosphor for UI glyphs | Brand identity icons match rough.js aesthetic; utility icons stay crisp |
| MarginAnnotation approach | Frontmatter array + CSS-only rendering (no Client Component) | Zero JS overhead; `::after` pseudo-elements + `attr()` read data attributes directly |
| Dark mode | Deferred to separate future effort | Tokens ready in global.css but scope was too large |
| DotGrid zone-aware rendering | Cream dots over hero zone, dark dots over parchment, 50px crossfade | Hero component reports height to `--hero-height` via ResizeObserver; DotGrid reads it |
| Comment system | File-based JSON in `data/comments/`, reCAPTCHA v3, sticky notes in margin | Low-infrastructure reader engagement; matches the handwritten margin note aesthetic |
| Publishing delivery | GitHub Contents API + Git Trees API (not runtime API or direct git) | SSG preserved; Trees API enables atomic multi-file commits (content + config together) |
| Studio editor tech | Django templates + HTMX (not React SPA) | Avoids second SPA; HTMX gives interactivity; simpler than building API + React client |
| Studio owner shortcut | Invisible keyboard shortcut Ctrl+Shift+E (not nav link or FAB) | Zero visual footprint for visitors; Django auth still protects the editor |
| JSON field widgets | Custom widgets at widget layer, not form clean | Serialization in `format_value()`/`value_from_datadict()` keeps forms and views clean |
| Site config cascade | global.css -> site.json -> page composition -> per-instance composition | Four optional layers; site works with zero config (hardcoded defaults are the fallback) |
| Composition JSONField | Added to all content models (Essay, FieldNote, ShelfEntry, Project, ToolkitEntry) | Per-instance visual overrides without schema migration; loose `z.record()` in Zod |
| Studio three-zone sidebar | Content / Compose / Settings navigation groups | Maps to the three concerns: writing, visual design, site-wide settings |
| StructuredListWidget | Row-based JSON editing with add/remove/reorder | Replaces raw JSON textarea for nav items, sources, annotations; prevents syntax errors |
| Backlinks as computed data | `get_backlinks()` derives from SourceLink joins (no Backlink model) | Avoids sync overhead; cheap for single-user scale; backlink graph published as static JSON |
| research_api: admin as authoring UI | Django admin with rich fieldsets and inlines (no custom Studio editor) | Simpler than publishing_api's HTMX Studio; source tracking is data entry, not content editing |
| Source.public + custom managers | `.public()` manager filters to `public=True` across API, publisher, and management commands | Two-layer access: admin sees everything, public sees only curated sources |
| Studio UI library | django-cotton + django-crispy-forms + django-tailwind (replacing 600+ line custom studio.css) | Declarative components, consistent form rendering, utility-first CSS with brand tokens; eliminates all custom CSS |
| Source promotion pipeline | HTTP API call from publishing_api to research_api (not shared DB) | Two separate Railway services with own databases; Bearer token auth, idempotent (409 on duplicate URL), source type inferred from URL domain |
| Graph orphaned nodes | Second query for `Source.objects.public().exclude(...)` after SourceLink iteration | Promoted sources with no SourceLinks yet must still appear in graph and explorer; D3 force simulation floats them naturally |
| Font system overhaul | Removed Space Mono, added JetBrains Mono as `--font-code` | Code comments need monospace with ligatures; Courier Prime stays for labels/metadata |
| StampDot as separate Client Component | Extracted animated dot from Server Component ProgressTracker | Minimizes JS bundle; ProgressTracker stays Server Component, only the animated dot hydrates |
| StampDot 24-hour window | `isRecent()` checks if `lastAdvanced` is within 24 hours | Stamp animation fires only for freshly advanced content; prevents visual noise on every page load |
| ConnectionMap synchronous layout | 300 D3 force iterations computed at render time (not animated) | Instant layout without jank; graph is small enough (<50 nodes) that sync computation is cheap |
| CodeComment over RoughCallout | Static CSS code annotations instead of canvas-drawn callouts for homepage | "Workbench" aesthetic: code comments feel like developer notes; cheaper to render than rough.js canvas |

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
- **MarginAnnotation paragraph counting**: `injectAnnotations()` counts `</p>` tags in rendered HTML. Paragraph indices in frontmatter are 1-based (paragraph 1 = first `</p>`). Headings (`<h2>`, `<h3>`) don't count as paragraphs
- **DrawOnIcon imports ICON_PATHS from SketchIcon**: The `export` on `ICON_PATHS` is the only change to SketchIcon. If new icons are added to SketchIcon, DrawOnIcon picks them up automatically
- **Focus trap in mobile menu**: Tab wraps between first and last focusable items inside `mobileMenuRef`. On Escape, focus returns to the hamburger button via `hamburgerRef`
- **Reading time word count**: `estimateReadingTime()` splits on `/\s+/` which handles tabs, newlines, and multiple spaces in markdown. Always returns at least 1
- **ConsoleEasterEgg dependency array**: All 5 props are in the `useEffect` dependency array. Since they're computed at build time (static), the effect runs exactly once per page load
- **`pre code` word-break reset**: Inline `code` gets `word-break: break-word` but `pre code` resets to `normal` because code blocks should scroll horizontally, not wrap
- **Absolute-positioned callout text needs explicit `width`**: `max-width` alone on absolute elements causes shrink-to-fit (one word per line). Both `RoughPivotCallout` and `RoughCallout` set `width: 450` on the outer wrapper div
- **`overflow-hidden` clips absolute callouts**: Secondary essay cards had `overflow-hidden` on the `group` div which clipped `RoughCallout`. Only put `overflow-hidden` on image wrappers, not card-level containers that host absolute-positioned decorations
- **Phase-aware overflow for hover labels**: ArchitectureEasterEgg uses `overflow: isExpanded ? 'hidden' : 'visible'` so the SITE.MAP hover label can extend below the 72px seed wrapper in seed phase, while expanded panel content stays clipped
- **rAF never fires in headless Playwright**: Preview tool's headless browser doesn't trigger `requestAnimationFrame`. To test rAF-driven animations, use React fiber manipulation (`hook.queue.dispatch()`) to force state, or test in a real browser
- **CSS `ch` unit is font-relative in `::after`**: Margin annotation `::after` inherits `font-annotation` (Caveat), making `calc(65ch + ...)` resolve differently than `65ch` in the prose body font. Use `calc(100% + ...)` for font-agnostic positioning
- **Hero grid alignment math**: The `1fr 118px 1fr` grid in the hero (max-w-6xl, 1152px) aligns with the RoughLine label gap inside max-w-4xl (896px) because each hero `1fr` extends exactly `(1152-896)/2 = 128px` beyond the content area. The `lg:pl-[128px]` on the left column shifts the name to align with the content area's left edge. If either max-width changes, both values must be recalculated
- **StudioShortcut `NEXT_PUBLIC_STUDIO_URL`**: Defaults to `http://localhost:8000`. Must be set in Vercel environment when Django Studio is deployed to Railway. The `NEXT_PUBLIC_` prefix means the value is inlined at build time, not runtime
- **Django JSONField silent data loss**: If a JSONField is in `Meta.fields` but not rendered in the template, Django treats absent POST data as empty and resets the field on save. Every JSONField must have both an explicit widget in the form AND a rendering slot in the template
- **ShelfEntry uses `annotation` not `body`**: The main content field for ShelfEntry is `annotation` (textarea in writing area), not `body` like other content types. The edit.html template falls back: `{% if form.body %}...{% elif form.annotation %}...{% endif %}`
- **Django `.defer()` validates field existence at query time**: Unlike `.only()`, `.defer("field_that_doesnt_exist")` raises `FieldDoesNotExist` when the queryset is evaluated. When deferring fields across heterogeneous models (e.g., ShelfEntry has `annotation` not `body`), use per-model defer tuples instead of a shared skip list
- **siteConfig.ts cache is process-scoped**: `_cached` lives in module scope. Works for SSG (single Node process builds all pages) but would need invalidation if ISR or runtime rendering is added
- **site.json must be valid JSON or getSiteConfig() falls back silently**: Zod `.safeParse()` returns `DEFAULT_CONFIG` on any parse failure. Check server logs if config changes aren't appearing
- **Composition field is `z.record(z.unknown()).optional()`**: Intentionally loose typing so Django can evolve composition schemas without requiring Next.js Zod changes. Consumers must validate the shape they expect
- **ToolkitEntry has no date field**: Unlike other content types, toolkit entries use `category` + `order` for organization. The `_parse_toolkit` function defaults `stage` to `"published"` because existing content is already live
- **`python3 -m pip` required on this machine**: `pip` alone is not found. Use `python3 -m pip install` for all package installs
- **Two Django services share patterns**: `research_api` mirrors `publishing_api` structure (single `config/settings.py`, `railway.toml`, requirements split, GitHub publisher). When updating one, check if the other needs the same change
- **research_api publishes to `src/data/research/`**: Five JSON files (sources.json, links.json, threads.json, backlinks.json) plus per-slug trail files, committed atomically via Git Trees API. Next.js site reads these at build time
- **reCAPTCHA v3 tokens are single-use**: Google's `siteverify` consumes the token on first call; a second call returns `success: false, score: 0.0`. Never split verification and scoring into separate HTTP calls
- **Content-type detection lives in `services.py`**: `detect_content_type(slug)` centralizes the essay-first/field_note-fallback heuristic. Used by trail API, backlinks API, and publisher
- **Source promotion requires 3 env vars**: `INTERNAL_API_KEY` (same value on both services), `RESEARCH_API_URL` and `RESEARCH_API_KEY` on publishing_api. Without these, promotion silently returns `{"error": "Research API not configured"}` and triage still works (just without cross-service sync)
- **httpx required in publishing_api**: The promotion service uses `httpx.post()` (not requests). Ensure `httpx` is in `requirements/base.txt`
- **StampDot CSS custom properties**: `@keyframes scatter-out` uses `--scatter-x`, `--scatter-y`, `--scatter-opacity` set inline per element. Generic keyframe with unique per-dot endpoints
- **ConnectionMap two-layer rendering**: Canvas (behind) for rough.js hand-drawn edges, SVG (front) for colored nodes and hover interactions. Canvas redraws on hover state change
- **DesignLanguageEasterEgg replaces ArchitectureEasterEgg**: Same 5-phase state machine but renamed. Update layout.tsx import if reverting
- **JetBrains Mono `--font-code` vs Courier Prime `--font-metadata`**: Code comments use `--font-code` (JetBrains Mono); section labels and metadata use `--font-metadata` (Courier Prime). Don't swap them
