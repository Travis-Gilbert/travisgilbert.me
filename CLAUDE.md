<!-- project-template: 48 -->
# travisgilbert.com

## Project Overview

Personal "creative workbench" site: a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements (rough.js). NOT a traditional portfolio or resume.

## Writing Rules

- **No dashes.** Never use em dashes (`—`) or en dashes (`–`) anywhere: not in code comments, not in UI strings, not in markdown content. Use colons, periods, commas, semicolons, or parentheses instead.
- Applies to all files: `.tsx`, `.ts`, `.css`, `.md`, frontmatter strings, JSDoc comments, JSX comments

## Tech Stack

Next.js 16 (App Router, Turbopack, React Compiler), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), rough.js, rough-notation, `next/font` (Google + local), Zod, gray-matter + remark, Django 5.x (publishing_api + research_api), DRF, spaCy (en_core_web_md), PyTorch (CPU), sentence-transformers, FAISS, django-cotton, django-crispy-forms (`studio` pack), django-tailwind, django-template-partials

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | App Router pages and layouts |
| `src/app/fonts.ts` | All 7 font declarations: Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, JetBrains Mono (Google) + Amarna (local) |
| `src/app/layout.tsx` | Root layout (DotGrid, TopNav, Footer, DesignLanguageEasterEgg, metadata) |
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
| `research_api/apps/api/` | API-key-gated product: 22 endpoints (search, graph algorithms, export/import, temporal analysis, health monitoring, tensions, sessions, webhooks) + internal promote endpoint. 190 tests in `tests.py` |
| `research_api/apps/api/middleware.py` | API key auth + rate limiting; `EXEMPT_PREFIXES` for public endpoints (notebook, health, admin, webmention) |
| `research_api/apps/api/webhooks.py` | Webhook dispatch service: HMAC-SHA256 signing, delivery tracking, auto-deactivation after 5 consecutive failures |
| `research_api/apps/api/tensions.py` | Contradiction/tension detection across sources (counterargument, publisher divergence, temporal, tag divergence) |
| `research_api/apps/research/graph.py` | Graph algorithms: PageRank, shortest path (BFS), topological reading order |
| `research_api/apps/paper_trail/` | Public browsing pages: explorer (D3 graph), essay trail, threads, community wall with HTMX suggestion form |
| `research_api/apps/publisher/` | PublishLog model, GitHub API client, JSON serializers, publish orchestrator (commits to `src/data/research/`) |
| `research_api/apps/notebook/` | CommonPlace knowledge graph: 12 models (ObjectType, Object, ComponentType, Component, Timeline, Node, Edge, ResolvedEntity, DailyLog, Notebook, Project, Layout), DRF API with 11 ViewSets + 6 custom endpoints |
| `research_api/apps/notebook/engine.py` | Three-pass spaCy connection engine: entity extraction, shared entity edges, topic similarity (Jaccard) |
| `research_api/apps/notebook/signals.py` | DailyLog auto-population via post_save signals on KnowledgeNode, Edge, ResolvedEntity |
| `publishing_api/apps/intake/services.py` | OG metadata scraping (`scrape_og_metadata`) + cross-service source promotion (`promote_to_research` via httpx) |
| `research_api/apps/research/recaptcha.py` | reCAPTCHA v3 server-side verification; single `verify_recaptcha()` returning `(passed, score)` tuple |
| `research_api/apps/research/views.py` | Public submission endpoints (suggest source, suggest connection) with reCAPTCHA + approved suggestions read endpoint |
| `research_api/apps/research/services.py` | `detect_content_type()` (essay vs field_note heuristic), `get_backlinks()`, `get_all_backlinks()` |
| `publishing_api/apps/content/models.py` | VideoProject, VideoScene, VideoDeliverable, VideoSession models (alongside Essay, FieldNote, etc.) |
| `publishing_api/templates/editor/video_edit.html` | Phase-aware video editor (dedicated template, not generic edit.html) |
| `publishing_api/templates/editor/partials/video_scenes.html` | Scene inline editor with HTMX toggle checkboxes |
| `publishing_api/templates/editor/partials/video_deliverables.html` | Deliverable management panel |
| `publishing_api/templates/editor/partials/video_sessions.html` | Session log with start/stop controls |
| `publishing_api/templates/editor/production_dashboard.html` | Video production dashboard: active projects, 30-day heatmap, weekly summary, cumulative output |
| `src/lib/videos.ts` | Video fetch utility: `fetchAllVideos()`, `fetchVideoBySlug()`, `StudioVideo` type; reads from Studio API at build time |
| `src/app/(commonplace)/layout.tsx` | CommonPlace route group layout: warm studio shell with sidebar, blueprint grid, split pane system, scoped CSS tokens |
| `src/app/(commonplace)/commonplace/page.tsx` | CommonPlace home page: timeline landing with stat cards |
| `src/components/commonplace/` | CommonPlace Client Components: capture, timeline, network, split pane, sidebar, ComposeView, TerminalBlock, LibraryView |
| `src/components/commonplace/objects/` | Polymorphic object renderers (v5): NoteCard, SourceCard, QuoteBlock, ConceptNode, EventBadge, HunchSticky, PersonPill, PlacePin, ScriptBlock, TaskRow + ObjectRenderer dispatcher |
| `src/styles/commonplace.css` | CommonPlace theme tokens: cream/parchment surfaces, warm dark sidebar, blueprint grid, paper grain, terracotta glow |
| `src/lib/commonplace.ts` | Shared constants, types, sidebar structure, object type visual identity, view registry |
| `src/lib/commonplace-layout.ts` | Split pane layout: recursive binary tree types, presets, serialization, key bindings |
| `src/lib/commonplace-capture.ts` | Capture logic: local-first object creation, URL detection, optimistic IDs, mock OG enrichment |
| `src/lib/commonplace-api.ts` | API client: typed fetch wrapper, response mappers (feed/graph/capture), `useApiData` hook, error handling, optional Bearer token auth |
| `src/lib/commonplace-graph.ts` | D3 graph data prep: force simulation config, frame serialization, type-based clustering helpers |
| `research_api/apps/notebook/services.py` | Service layer: `enrich_url()` OG metadata fetch, `quick_capture()` object creation from raw input |
| `src/app/(main)/` | Main site route group (essays, field-notes, shelf, toolkit, projects, now, connections) |
| `src/app/(networks)/` | Networks route group: Paper Trail explorer, threads, community wall |
| `src/app/(studio)/` | Studio route group: live editing preview for Django Studio content |
| `src/components/networks/` | Network/research page components (explorer, trail, threads, community wall) |
| `src/components/studio/` | Studio preview components (live content rendering from Django Studio API) |
| `src/components/research/` | Research display components (backlinks, source cards) |
| `src/components/charts/` | D3 chart components (PublicationGraph, connection visualizations) |
| `src/lib/commonplace-context.tsx` | React context provider: object detail, resurface, sidebar state (`sidebarCollapsed`/`setSidebarCollapsed`), click chain navigation |
| `src/lib/networks.ts` | Networks data fetching: research JSON loader, trail builder, thread mapper |
| `src/lib/research.ts` | Research data types and utilities for backlinks, sources, threads |
| `src/lib/studio.ts` | Studio types, route mapping, content preview utilities |
| `src/lib/studio-api.ts` | Django Studio API client: fetch content, config, and preview data |
| `Orchestra MCP/` | YouTube production orchestration system (TickTick, YouTube, Ulysses, Resolve, File Bridge MCPs) |

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start Next.js dev server
npm run build      # Production build (SSG)
npm run start      # Serve production build locally
npm run lint       # Run ESLint (standalone; `next lint` removed in Next.js 16)
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
python3 manage.py seed_node_types             # Create default NodeType records (Person, Source, Concept, etc.)
python3 manage.py seed_object_types           # Create built-in ObjectType records (Note, Source, Person, etc.)
python3 manage.py seed_component_types        # Create built-in ComponentType records (Text, Date, URL, etc.)
python3 manage.py seed_commonplace            # Combined seed: ObjectTypes + ComponentTypes + master Timeline
python3 manage.py create_sample_data          # Create ~15 sample Objects with Components for testing
python3 manage.py create_sample_data --clean  # Delete all notebook data first, then create samples
python3 manage.py run_connection_engine        # Process inbox + active nodes through spaCy NER
python3 manage.py run_connection_engine --all  # Process every node regardless of status
python3 manage.py run_connection_engine --dry-run  # Preview without writing edges
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

Most components are **Server Components** by default. A component uses `'use client'` when it needs: canvas/animation (rough.js, rAF, IntersectionObserver), interactive state (useState, usePathname), or browser APIs (ResizeObserver, pointer events). The `'use client'` directive is the source of truth; no separate list is maintained.

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

**CollageHero** (`src/components/CollageHero.tsx`): Unified homepage hero. Two-column grid (`55% 1fr`) on desktop (lg+), single stack on mobile. Left column: Zone A (identity: h1 name, CyclingTagline, PipelineCounter) + Zone B (featured essay: "CURRENTLY WRITING" label, title linking to essay, summary, DateStamp, TagList, CompactTracker). Right column: HeroArtifact (composed image + HeroAccents SVG overlay) + NowPreviewCompact below. Background color from `heroColor` prop (default `#4A4528`), 56px gradient fade to parchment. Breaks out of content width via `marginLeft: calc(-50vw + 50%); width: 100vw`. Pulls into main's padding via negative top margin reading `--main-pad-y`.

**EssayHero** (`src/components/EssayHero.tsx`): Essay detail page header. YouTube thumbnail (via `next/image` with `fill`) or PatternImage as background with dark overlay (`--color-hero-overlay` at 70%). Category label (first tag, Courier Prime 11px, uppercase, terracotta with short rule). Date + reading time in top-right corner (9px, cream 50%). Large cream title, summary, inverted TagList and ProgressTracker slots. Same breakout and height-reporting pattern as CollageHero.

**DotGrid zone awareness**: Both heroes set `--hero-height` on `<html>`. DotGrid reads this to render cream dots (`[240, 235, 228]` at 35%) over the dark zone, standard dark dots below, with a 50px crossfade band. Scroll listener redraws static dots so the color boundary moves as the user scrolls.

**HeroArtifact** (`src/components/HeroArtifact.tsx`): Composed image container with `next/image` fill, static rotation (`-1.5deg`), hover scale (disabled for reduced-motion). Fallback panel when no image (parchment rect with border). HeroAccents renders as absolute SVG layer on top.

**HeroAccents** (`src/components/HeroAccents.tsx`): Deterministic SVG overlay using djb2 hash + LCG PRNG seeded from first tag string. 4 circles (varying radius/opacity in top-right and bottom-left quadrants), 2 thin gold connector lines, up to 2 rotated Courier Prime tag labels. No `Math.random()` (SSG-safe).

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

`ProjectColumns` renders projects grouped by role in a responsive column grid. Does NOT use RoughBox (three-state dynamic rgba tinting is incompatible with RoughBox's fixed CSS classes). Roles: Built & Designed (teal), Project Managed (terracotta), Organized (gold), Created (green). `slugifyRole()` preserves `&` in slugs. Date is serialized to ISO string across RSC boundary.

### Surface and Configuration Systems

**Surface materiality:** Three layers: page (DotGrid + paper grain), card (tint fill + warm shadow + rough.js stroke), content (SectionLabel + TagList). CSS classes: `.surface-elevated`, `.surface-tint-{color}`, `.surface-hover`.

**Site config cascade:** `global.css` defaults -> `site.json` -> page composition -> per-instance composition. `siteConfig.ts` loads with Zod validation, falls back to `DEFAULT_CONFIG` if missing.

### Section Color Language

Each content type has a brand color that flows through labels, icons, tags, card tints, and borders:

| Section | Color | Label Text |
|---------|-------|-----------|
| On ... / Toolkit | Terracotta (`#B45A2D`) | ON ... / WORKSHOP TOOLS |
| Field Notes / Connect | Teal (`#2D5F6B`) | FIELD NOTES / OPEN CHANNEL |
| Projects / Shelf | Gold (`#C49A4A`) | PROJECTS / REFERENCE SHELF |
| Video | Green (`#5A7A4A`) | VIDEO |

Components: `SectionLabel` (monospace header), `TagList` (tint prop), `SketchIcon` (hand-drawn SVG page icons)

## Deployment

Vercel with native Next.js builder. Git integration auto-deploys on push to `main`. No `vercel.json` needed; Vercel auto-detects Next.js. **Important:** Vercel dashboard Project Settings > Output Directory must be blank/default (not `dist`).

**Django services (Railway):** Both `publishing_api/` and `research_api/` deploy to Railway with PostgreSQL. Each has `railway.toml` (nixpacks builder, migrate + collectstatic + gunicorn start command). Environment variables: `SECRET_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`. research_api also needs `WEBMENTION_TARGET_DOMAIN`.

## Status

Phases 1 through 4 (Foundation, Micro-interactions, Animations, Polish) are **all complete**. See `docs/records/001-site-wide-redesign.md` for full history.

**Branding Overhaul (plan-01):** Complete (8 phases), merged to `main`. See `docs/plans/plan-01-branding-homepage-interactions.md` for the full spec. Key changes: font system overhaul (Space Mono removed, JetBrains Mono added as `--font-code`), CodeComment component for workbench annotations, PipelineCounter live build counter on homepage, ParallaxStack subtle scroll parallax, ConnectionMap D3 force graph at `/connections`, DesignLanguageEasterEgg (replaces ArchitectureEasterEgg), StampDot animation on ProgressTracker for recently advanced content.

**Django Studio:** Full site management control panel. Brand component library redesign complete. Deployed to Railway at draftroom.travisgilbert.me. See `docs/plans/2026-02-25-studio-redesign-design.md` for the design doc and `docs/records/002-publishing-api.md` for the original scaffold. Django check passes (0 issues).

**Research API:** Deployed to Railway at research.travisgilbert.me. Product spec complete (Batches 0-8): API key management, full-text search, graph algorithms, multi-format export/import, temporal analysis, source health monitoring, tension detection, research sessions, and webhooks. 189 tests passing. Source promotion pipeline from publishing_api via Bearer token auth. See `docs/records/003-research-api.md`.

**Notebook (Knowledge Graph):** Sessions 1 through 3 complete (Django backend). Evolved from 6 models (v2) to 12 models (v4 Object/Node/Component architecture): ObjectType, Object, ComponentType, Component, Timeline, Node, Edge, ResolvedEntity, DailyLog, Notebook, Project, Layout. Session 3 added full DRF API layer: 11 ViewSets (ObjectType, ComponentType, Object, Component, Node, Edge, Notebook, Project, Timeline, Layout, DailyLog) + 6 custom endpoints (capture, feed, graph, resurface, object export, notebook export). Service layer with URL enrichment and quick capture. Management commands: seed_object_types, seed_component_types, seed_commonplace (combined), create_sample_data. spaCy NER engine with three-pass connection logic preserved from v2.

**YouTube Production Pipeline:** All 7 batches complete. Models, admin, forms, CRUD views, phase-aware editor, HTMX inline panels (Batches 1 through 4). Orchestra API endpoints at `/editor/api/videos/` with 7 JSON views for conductor integration (Batch 5). Next.js frontend: `src/lib/videos.ts` fetch utility, Currently Producing section on `/now`, linked video embeds on essay pages (Batch 6). Process tracking: video metrics in ProcessNotes and PublicationGraph, production dashboard in Studio at `/production/` (Batch 7). Spec: `docs/plan-03-studio-youtube-production.md`.

**Hero Redesign:** Complete, merged to `main`. CollageHero rewritten as unified above-the-fold zone (identity + featured essay + artifact). EruptingCollage and secondary essay grid removed from homepage. HeroArtifact and HeroAccents created. Reading guide line added to ArticleBody (hover-gated, transparent, gradient-edged). Schema extended with `heroColor` and `heroImage` fields.

**CommonPlace Frontend:** Sessions 5 through 9 complete (Django + initial frontend). Full Next.js frontend at `/commonplace` route group with warm studio theme (cream parchment + dark sidebar), wired to live Django API. Session 5: split pane system (SplitPaneContainer, DragHandle, LayoutPresetSelector, CommonPlaceSidebar) with recursive binary tree layout, keyboard shortcuts, 4 layout presets. Session 6 (Capture): CaptureButton with spring animation, ObjectPalette type grid, DropZone drag-and-drop, RecentCaptures sidebar list, local-first capture with optimistic IDs. Session 7 (Timeline): TimelineView with NodeCard, DateHeader, RetroNote reflection prompts, ConnectionLabel edge badges, TimelineSearch with type filters. Session 8 (Network): KnowledgeMap (D3 force graph + rough.js canvas edges), EntityNetwork (Person/Org filtered view), TimelineViz (chronological dot plot with arcs), FrameManager (save/restore view configs), NetworkView (toggle toolbar wrapper). Session 9 (API Integration): created `commonplace-api.ts` anti-corruption layer mapping Django serializer responses to frontend types; replaced all mock data with live API calls to `/api/v1/notebook/` endpoints (feed, graph, capture, retrospective, resurface); `useApiData<T>()` hook for loading/error/refetch; NetworkView lifted to single fetch parent; loading skeleton, error banner, empty state styles added. All components use CommonPlace scoped CSS tokens from `commonplace.css`. Dark Chrome Instrument redesign (v5) Batches 1 through 6 complete (color tokens, object renderers, TerminalBlock, LibraryView, ComposeView, sidebar collapse to 48px icon rail). v5.1 Lego Composition all 5 batches complete: PinnedBadge renderer, drag and drop pin creation, 3 layout presets with keyboard shortcuts, TerminalCanvas background, tab drag between panes. See `docs/records/004-commonplace-v5-dark-chrome.md`.

**Next step:** CommonPlace v5 Batch 7: `ObjectContextMenu` with right-click Stash/Connect/Contain actions. Then Batch 8 (DotGrid canvas migration, remove CSS dot field from PaneFrame) and Batch 9 (cluster + lineage API endpoints + frontend hooks). Also pending: train KGE embeddings for production (`export_kge_triples` + `train_kge.py`), verify production API connectivity end to end (env vars set: `NEXT_PUBLIC_RESEARCH_API_URL`, `NEXT_PUBLIC_STUDIO_URL`, `INTERNAL_API_KEY`, `RESEARCH_API_URL`/`RESEARCH_API_KEY`).

**Remaining backlog:**
- CommonPlace: verify production deploy with live API
- CommonPlace: optimistic capture sync (CaptureButton local-first; POST wired but no optimistic UI update yet)
- Notebook Sessions 4+: daily log views, publisher, Next.js data publishing
- Sourcebox UX redesign (brainstorm in progress)
- Dark mode (deferred; tokens ready in `global.css`)
- Hero artifact photography (composed still-life images for `public/hero/`)
- Component integration: TopNav, layout.tsx, CollageHero, DotGrid could consume siteConfig instead of hardcoded values

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| UI library | Radix Primitives (not shadcn/ui) | Full custom styling over brand; shadcn opinionated defaults fight the aesthetic |
| Section color system | terracotta=essays, teal=field-notes, gold=projects | Creates wayfinding language; color tells you where you are on the site |
| Publishing delivery | GitHub Contents API + Git Trees API | SSG preserved; Trees API enables atomic multi-file commits |
| Studio editor tech | Django templates + HTMX (not React SPA) | Avoids second SPA; HTMX gives interactivity without API + React client |
| Studio UI library | django-cotton + django-crispy-forms + django-tailwind | Declarative components, consistent form rendering, brand tokens |
| Source promotion | HTTP API between Railway services (not shared DB) | Separate databases; Bearer token auth, idempotent |
| Deterministic PRNG | djb2 hash + LCG (not Math.random()) | SSG builds must produce identical output across runs |
| Notebook v4 architecture | Objects (typed + Components), Nodes (immutable events), explained Edges | Everything is an Object; changes are Nodes; edges carry `reason` field |
| CommonPlace: scoped route group | Own layout.tsx, not sharing root DotGrid/TopNav/Footer | Different visual language (warm studio vs parchment site) |
| CommonPlace: split pane system | Recursive binary tree (not fixed panels) | Arbitrary nesting; JSON-serializable; 4 presets |
| CommonPlace: API anti-corruption layer | Mapping functions in `commonplace-api.ts` | Components unchanged; only data source changes from mock to live |
| CommonPlace: NetworkView lifts graph fetch | Single fetch in parent, passes to children as props | Avoids three independent fetches for same data |
| CommonPlace: sidebar collapse | Reactive via context (not user toggle) | `SplitPaneContainer` is the single writer; sidebar is a pure reader |

## Gotchas

### Next.js / React
- **Canvas stacking context**: Body needs `isolation: isolate`, canvas needs `z-index: -1`, `background-color` on `html` (not body)
- **Canvas DPR scaling**: Multiply canvas dimensions by `devicePixelRatio`, use `ctx.scale(dpr, dpr)`, set CSS size to logical pixels
- **Phosphor icons in Server Components**: Import from `@phosphor-icons/react/dist/ssr` (not default export)
- **Route handlers need force-static**: `sitemap.ts` and `rss.xml/route.ts` require `export const dynamic = 'force-static'`
- **Async params (Next.js 16)**: Dynamic route `params` is `Promise<{ slug: string }>`; must `await` it
- **Date serialization across RSC boundary**: Date objects can't cross Server/Client Component boundary; use `.toISOString()`
- **OG image via `opengraph-image.tsx`**: Do NOT also set `metadata.openGraph.images` in `layout.tsx` or it will conflict
- **Satori CSS limitations**: Only flexbox layout, no grid. Every element needs `display: 'flex'`
- **Webpack `.next/` cache corruption**: After major file deletions or renames, fix with `rm -rf .next` and rebuild
- **`NEXT_PUBLIC_*` env vars**: Inlined at build time, not runtime. Changing values requires Vercel redeploy. `NEXT_PUBLIC_STUDIO_URL` defaults to `http://localhost:8000`, `NEXT_PUBLIC_RESEARCH_API_URL` defaults to `http://localhost:8001`

### Styling / Design System
- **Font variable bridging**: `next/font` vars (e.g., `--font-vollkorn`) are distinct from Tailwind theme aliases (e.g., `--font-title`). Bridge in `global.css` `@theme inline`
- **JetBrains Mono `--font-code` vs Courier Prime `--font-metadata`**: Code comments use `--font-code`; section labels and metadata use `--font-metadata`. Don't swap them
- **RoughBox needs `position: relative`** for absolute-positioned children like RoughPivotCallout
- **Absolute-positioned callout text needs explicit `width`**: `max-width` alone causes shrink-to-fit
- **`overflow-hidden` clips absolute callouts**: Only put on image wrappers, not card containers hosting absolute decorations
- **Two-layer graph rendering**: Canvas (behind) for rough.js edges + SVG (front) for interactive nodes. Both ConnectionMap and KnowledgeMap use this pattern; changes to one should be considered for the other
- **MarginAnnotation paragraph counting**: `injectAnnotations()` counts `</p>` tags. Indices in frontmatter are 1-based. Headings don't count

### Django / Backend
- **Django JSONField silent data loss**: If a JSONField isn't rendered in template, Django resets it on save. Every JSONField needs both widget AND template rendering
- **ShelfEntry uses `annotation` not `body`**: Template falls back: `{% if form.body %}...{% elif form.annotation %}...{% endif %}`
- **Django `.defer()` validates field existence at query time**: Use per-model defer tuples for heterogeneous models
- **HTMX CSRF outside `<form>`**: Wrap partial in `<div hx-headers='{"X-CSRFToken": "{{ csrf_token }}"}'>`
- **Two Django services share patterns**: When updating `publishing_api` or `research_api`, check if the other needs the same change
- **Source promotion requires 3 env vars**: `INTERNAL_API_KEY` (same on both), `RESEARCH_API_URL` and `RESEARCH_API_KEY` on publishing_api
- **`python3 -m pip` required on this machine**: `pip` alone is not found
- **spaCy model fallback pattern**: Always try `en_core_web_md` first, fall back to `en_core_web_sm`. Railway downloads md; local dev may have sm. See `embeddings.py` for reference pattern
- **JSONField `__contains` is PostgreSQL-only**: `tags__contains=[value]` fails on SQLite (tests). Use Python-side filtering: `[s for s in queryset if value in (s.tags or [])]`
- **API key feature flags pattern**: `can_import`, `can_sessions`, `can_webhook` on APIKey. Each gated module has a `_require_*()` helper returning `(api_key, error_response)` tuple
- **research_api tests use in-memory SQLite**: `python3 manage.py test apps.api -v 2` runs 190 tests. All JSONField queries must be SQLite-compatible
- **Studio CORS allowlist**: `STUDIO_API_ALLOWED_ORIGINS` in `publishing_api/apps/editor/views.py`. Must include every domain serving Next.js (travisgilbert.me, www, studio.travisgilbert.me, .vercel.app suffix). Also supports `STUDIO_API_ALLOWED_ORIGINS` env var
- **"Loads but can't save" = CORS**: Server Components fetch server-side (no CORS), Client Components POST from browser (CORS preflight). If GETs work but POSTs fail, check the CORS allowlist
- **APIKeyMiddleware gates ALL `/api/v1/` paths**: New public endpoints under `/api/v1/` must be added to `EXEMPT_PREFIXES` in `research_api/apps/api/middleware.py`
- **Railway nixpacks `cmds` doesn't persist to runtime**: Downloaded models (spaCy, etc.) vanish. Use `startCommand` with conditional download instead
- **`--extra-index-url` must be in top-level `requirements.txt`**: Nixpacks doesn't propagate pip options from nested `-r` included files (base.txt is 2 levels deep)
- **CPU-only PyTorch on Railway**: `--extra-index-url https://download.pytorch.org/whl/cpu` in requirements.txt; without it pip pulls ~2GB CUDA wheels or fails

### CommonPlace
- **Route group scoping**: `(commonplace)` has its own layout.tsx, does NOT render html/body. Applies `commonplace-theme` class. Do not add DotGrid, TopNav, or Footer here
- **CSS tokens are scoped**: `--cp-*` variables only exist inside `.commonplace-theme`. Use site `--color-*` tokens elsewhere
- **Layout presets are index-based**: Reordering or removing presets in `commonplace-layout.ts` breaks saved references. Always append
- **Feed Node vs Object identity**: Use `node-${node.id}` (Node ID) as React key, not `String(node.object_ref)` (Object ID, may duplicate)
- **`commonplace-api.ts` is the single source for all API calls**: All fetches to `/api/v1/notebook/` go through `apiFetch()`. No raw fetch in components
- **`useApiData` hook deps**: Passing unstable references (objects, arrays) as deps causes infinite re-fetch loops
- **`sidebarCollapsed` is reactive, not a toggle**: `SplitPaneContainer` is the sole writer via `setSidebarCollapsed(focusedViewType === 'compose')`; `CommonPlaceSidebar` only reads it. Rail icon clicks call `requestView()` which changes the active tab, which auto-re-expands the sidebar. No explicit `setSidebarCollapsed(false)` needed in click handlers.

### Deployment
- **Vercel Output Directory**: Must be blank/default. `dist` setting from old Astro config breaks Next.js builds
- **research_api publishes to `src/data/research/`**: JSON files committed via Git Trees API. Next.js reads at build time
- **reCAPTCHA v3 tokens are single-use**: Never split verification and scoring into separate HTTP calls
- **Railway auto-deploys from `main`**: Both `publishing_api` and `research_api` deploy independently, ~2 minutes each
- **Verify CORS after Railway deploy**: `curl -s -D - -X OPTIONS -H "Origin: https://studio.travisgilbert.me" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" <url>` and check for `access-control-allow-origin` header
