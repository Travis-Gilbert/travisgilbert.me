<!-- project-template: 48 -->
# travisgilbert.com

## Project Overview

Personal "creative workbench" site: a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements (rough.js). NOT a traditional portfolio or resume.

## Writing Rules

- **No dashes.** Never use em dashes (`---`) or en dashes (`--`) anywhere: not in code comments, not in UI strings, not in markdown content. Use colons, periods, commas, semicolons, or parentheses instead.
- Applies to all files: `.tsx`, `.ts`, `.css`, `.md`, frontmatter strings, JSDoc comments, JSX comments

## Tech Stack

Next.js 16 (App Router, Turbopack, React Compiler), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), rough.js, rough-notation, `next/font` (Google + local), Zod, gray-matter + remark, Django 5.x (publishing_api + research_api), DRF, spaCy (en_core_web_md), PyTorch (CPU), sentence-transformers, FAISS, django-cotton, django-crispy-forms (`studio` pack), django-tailwind, django-template-partials

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | App Router: `(main)/` site pages, `(commonplace)/` knowledge graph, `(networks)/` research pages, `(studio)/` live preview |
| `src/components/` | React components; `rough/` (hand-drawn visuals), `commonplace/` (split pane UI), `commonplace/objects/` (10 polymorphic renderers) |
| `src/content/` | Markdown collections: essays, field-notes, shelf, toolkit, projects |
| `src/lib/` | Utilities: `content.ts` (Zod + remark), `commonplace-*.ts` (API, layout, capture, graph, context), `siteConfig.ts`, `connectionEngine.ts` |
| `src/styles/` | `global.css` (site tokens, surfaces, prose), `commonplace.css` (scoped `--cp-*` tokens) |
| `src/config/site.json` | Site configuration (tokens, nav, footer, SEO); Django commits updates via GitHub API |
| `src/app/fonts.ts` | 7 fonts: Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, JetBrains Mono, Amarna (local) |
| `publishing_api/` | Django Studio: content management, HTMX editor, video production pipeline. Deployed at draftroom.travisgilbert.me |
| `research_api/` | Django research API: sources, backlinks, Webmentions, notebook (knowledge graph). Deployed at research.travisgilbert.me |
| `research_api/apps/notebook/` | CommonPlace backend: 12 models, DRF API, spaCy connection engine. See its own `CLAUDE.md` |
| `research_api/apps/api/` | API-key-gated product: 22 endpoints, 190 tests |
| `docs/plans/` | Design documents and implementation plans |
| `docs/records/` | Decision logs and feature records |
| `Orchestra MCP/` | YouTube production orchestration (TickTick, YouTube, Ulysses, Resolve, File Bridge MCPs) |

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
python manage.py runserver               # Dev server on port 8000
python manage.py tailwind start          # Tailwind CSS watch mode (run in parallel)
python manage.py import_content             # Import all markdown into Django DB
python manage.py import_content --dry-run   # Parse and report without writing
```

```bash
# Research API (from research_api/)
python3 manage.py runserver 8001          # Dev server (8001 to avoid conflict with publishing_api)
python3 manage.py publish_research        # Publish all research data as JSON to Next.js repo
python3 manage.py seed_commonplace            # Combined seed: ObjectTypes + ComponentTypes + master Timeline
python3 manage.py create_sample_data          # Create ~15 sample Objects with Components for testing
python3 manage.py run_connection_engine        # Process inbox + active nodes through spaCy NER
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

Most components are **Server Components** by default. `'use client'` when needed for: canvas/animation, interactive state, or browser APIs. The directive is the source of truth.

### Font System

`next/font` sets CSS variables on `<html>`. Global CSS bridges to Tailwind via `@theme inline`:
`next/font > --font-vollkorn` -> `global.css > --font-title: var(--font-vollkorn)` -> `Tailwind > font-title`

Key distinction: `--font-code` (JetBrains Mono) for code comments vs `--font-metadata` (Courier Prime) for section labels.

### Content Loading

`src/lib/content.ts`: reads `src/content/{name}/*.md` with gray-matter, validates with Zod, renders with remark. Dynamic routes use `generateStaticParams()`.

### Surface Materiality

Three layers: page (DotGrid + paper grain), card (tint fill + warm shadow + rough.js stroke), content (SectionLabel + TagList). CSS classes: `.surface-elevated`, `.surface-tint-{color}`, `.surface-hover`.

### Section Color Language

| Section | Color | Hex |
|---------|-------|-----|
| Essays / Toolkit | Terracotta | `#B45A2D` |
| Field Notes / Connect | Teal | `#2D5F6B` |
| Projects / Shelf | Gold | `#C49A4A` |
| Video | Green | `#5A7A4A` |

Flows through: SectionLabel, TagList, SketchIcon, RoughBox tint, card borders.

### RoughBox

Primary card container. Props: `tint` (terracotta/teal/gold/neutral), `elevated`, `hover`, `stroke`. Surface styles go on wrapper div; canvas only draws the hand-drawn stroke.

### Hero System

CollageHero (homepage) and EssayHero (essay pages) share: dark ground, `--hero-height` on `<html>`, gradient fade to parchment. DotGrid reads `--hero-height` to render cream dots over dark zone. Both use deterministic PRNG (djb2 + LCG, no `Math.random()`).

### CommonPlace Architecture

Scoped route group `(commonplace)` with own layout.tsx (warm studio theme, not main site DotGrid/TopNav/Footer). Split pane system uses recursive binary tree. API calls go through `commonplace-api.ts` anti-corruption layer. Sidebar collapse is reactive via context (`SplitPaneContainer` is sole writer). See `docs/records/004-commonplace-v5-dark-chrome.md`.

**Evidence rendering is polymorphic**: `EvidenceItem.tsx` dispatches to sub-components per object type (source=gradient bar, hunch=dashed italic, quote=blockquote, concept=pill, note=card). Visual constants (`EVIDENCE_TYPE_COLOR`, `EVIDENCE_RELATION_COLOR`, `AGREEMENT_STYLE`) live in `commonplace-models.ts`.

**Icon system**: CommonPlace uses `iconoir-react` (not Phosphor). Phosphor is used on the main site only.

### Canvas Components

All canvas components (PaneDotGrid, TerminalCanvas, KnowledgeMap, TimelineViz) must guard against zero dimensions (browsers show broken-image icon) and cap to 8192px (browser canvas size limit). Pattern: `if (w < 1 || h < 1) return; const cw = Math.min(w, 8192);`

## Deployment

Vercel with native Next.js builder. Auto-deploys on push to `main`. **Important:** Output Directory must be blank/default (not `dist`).

**Django services (Railway):** Both services deploy with PostgreSQL via `railway.toml`. Env vars: `SECRET_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`. research_api also needs `WEBMENTION_TARGET_DOMAIN`.

## Status

| Milestone | Status | Reference |
|-----------|--------|-----------|
| Site redesign (4 phases) | Complete | `docs/records/001-site-wide-redesign.md` |
| Branding overhaul (8 phases) | Complete | `docs/plans/plan-01-branding-homepage-interactions.md` |
| Hero redesign | Complete | CollageHero + EssayHero + HeroArtifact |
| Django Studio | Complete, deployed | `docs/records/002-publishing-api.md` |
| Research API (Batches 0-8) | Complete, deployed, 190 tests | `docs/records/003-research-api.md` |
| Notebook backend (Sessions 1-3) | Complete | 12 models, DRF API, spaCy engine |
| YouTube Pipeline (7 batches) | Complete | `docs/plans/plan-03-studio-youtube-production.md` |
| CommonPlace frontend (Sessions 5-9) | Complete | API integration, split pane, capture, timeline, network |
| CommonPlace v5 Dark Chrome (9 batches) | Complete | `docs/records/004-commonplace-v5-dark-chrome.md` |
| CommonPlace v5.1 Lego Composition (5 batches) | Complete | PinnedBadge, drag/drop, layout presets, tab drag |
| Model View v6 redesign | Complete | Polymorphic evidence, two-column workspace, timeline-style assumptions |

**Next step:** Verify production deploy with live API, then optimistic capture sync. Also pending: train KGE embeddings for production (`export_kge_triples` + `train_kge.py`), verify production API connectivity end to end.

**Remaining backlog:**
- CommonPlace: verify production deploy with live API
- CommonPlace: optimistic capture sync (CaptureButton local-first; POST wired but no optimistic UI update yet)
- Notebook Sessions 4+: daily log views, publisher, Next.js data publishing
- Sourcebox UX redesign (brainstorm in progress)
- Dark mode (deferred; tokens ready in `global.css`)
- Hero artifact photography (composed still-life images for `public/hero/`)
- Component integration: TopNav, layout.tsx, CollageHero, DotGrid could consume siteConfig

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Deterministic PRNG | djb2 hash + LCG (not Math.random()) | SSG builds must produce identical output across runs |
| Notebook v4 architecture | Objects + Components, Nodes (immutable), explained Edges | Everything is an Object; changes are Nodes; edges carry `reason` field |
| CommonPlace: scoped route group | Own layout.tsx, not sharing root shell | Different visual language (warm studio vs parchment site) |
| CommonPlace: split pane system | Recursive binary tree (not fixed panels) | Arbitrary nesting; JSON-serializable; 4 presets |
| CommonPlace: API anti-corruption layer | Mapping functions in `commonplace-api.ts` | Components unchanged when data source changes |
| CommonPlace: sidebar collapse | Reactive via context (not user toggle) | `SplitPaneContainer` is single writer; sidebar is pure reader |
| Canvas dimension guards | Min 1px, max 8192px on all canvas components | Prevents broken-image icons (0px) and browser crashes (>16384px) |
| CommonPlace: Models placement | Under Library (not Views) | Models are a creation surface, not a view |
| CommonPlace: Model View v6 | Two-column layout, no drag reorder, polymorphic evidence | White card repetition was poor UI; timeline rows + type-specific rendering is more information-dense |

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
- **`NEXT_PUBLIC_*` env vars**: Inlined at build time, not runtime. Changing values requires Vercel redeploy
- **Default array/object props cause infinite loops**: `dotColor = [26, 26, 29]` in function signature creates a new ref each render. Use `useMemo` or module-level constant

### Styling / Design System
- **Font variable bridging**: `next/font` vars (e.g., `--font-vollkorn`) are distinct from Tailwind theme aliases (e.g., `--font-title`). Bridge in `global.css` `@theme inline`
- **RoughBox needs `position: relative`** for absolute-positioned children like RoughPivotCallout
- **Absolute-positioned callout text needs explicit `width`**: `max-width` alone causes shrink-to-fit
- **`overflow-hidden` clips absolute callouts**: Only put on image wrappers, not card containers hosting absolute decorations
- **Two-layer graph rendering**: Canvas (behind) for rough.js edges + SVG (front) for interactive nodes. Both ConnectionMap and KnowledgeMap use this
- **MarginAnnotation paragraph counting**: `injectAnnotations()` counts `</p>` tags. Indices in frontmatter are 1-based

### Django / Backend
- **Django JSONField silent data loss**: If a JSONField isn't rendered in template, Django resets it on save. Every JSONField needs both widget AND template rendering
- **HTMX CSRF outside `<form>`**: Wrap partial in `<div hx-headers='{"X-CSRFToken": "{{ csrf_token }}"}'>`
- **Two Django services share patterns**: When updating `publishing_api` or `research_api`, check if the other needs the same change
- **Source promotion requires 3 env vars**: `INTERNAL_API_KEY` (same on both), `RESEARCH_API_URL` and `RESEARCH_API_KEY` on publishing_api
- **`python3 -m pip` required on this machine**: `pip` alone is not found
- **spaCy model fallback pattern**: Always try `en_core_web_md` first, fall back to `en_core_web_sm`
- **JSONField `__contains` is PostgreSQL-only**: Use Python-side filtering for SQLite test compatibility
- **Studio CORS allowlist**: `STUDIO_API_ALLOWED_ORIGINS` in `publishing_api/apps/editor/views.py`. Must include all Next.js domains
- **"Loads but can't save" = CORS**: Server Components fetch server-side (no CORS), Client Components POST from browser (CORS preflight)
- **APIKeyMiddleware gates ALL `/api/v1/` paths**: New public endpoints must be added to `EXEMPT_PREFIXES`
- **CPU-only PyTorch on Railway**: `--extra-index-url https://download.pytorch.org/whl/cpu` in requirements.txt

### CommonPlace
- **Route group scoping**: `(commonplace)` has its own layout.tsx, does NOT render html/body. Do not add DotGrid, TopNav, or Footer here
- **CSS tokens are scoped**: `--cp-*` variables only exist inside `.commonplace-theme`. Use site `--color-*` tokens elsewhere
- **Layout presets are index-based**: Reordering or removing presets in `commonplace-layout.ts` breaks saved references. Always append
- **Feed Node vs Object identity**: Use `node-${node.id}` (Node ID) as React key, not Object ID (may duplicate)
- **`commonplace-api.ts` is the single source for all API calls**: No raw fetch in components
- **`useApiData` hook deps**: Passing unstable references (objects, arrays) causes infinite re-fetch loops
- **`sidebarCollapsed` is reactive, not a toggle**: `SplitPaneContainer` writes; sidebar only reads
- **Portal theme escaping**: `createPortal` to `document.body` exits `.commonplace-theme`. Wrap portal content in `<div className="commonplace-theme">` for `--cp-*` token resolution
- **Sidebar dual data sources**: Expanded sidebar reads `SIDEBAR_SECTIONS` from `commonplace.ts`; collapsed rail has a hardcoded array in `CommonPlaceSidebar.tsx`. Both must stay in sync when reordering

### Deployment
- **Vercel Output Directory**: Must be blank/default. `dist` setting from old Astro config breaks Next.js builds
- **Railway auto-deploys from `main`**: Both services deploy independently, ~2 minutes each
- **reCAPTCHA v3 tokens are single-use**: Never split verification and scoring into separate HTTP calls
- **Railway nixpacks `cmds` doesn't persist to runtime**: Use `startCommand` with conditional download instead
