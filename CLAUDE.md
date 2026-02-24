<!-- project-template: 48 -->
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
| `publishing_api/` | Django Studio: writing interface and GitHub publish pipeline (see Record 002) |
| `publishing_api/apps/editor/widgets.py` | Custom form widgets: TagsWidget, SlugListWidget, JsonObjectListWidget for JSON field rendering |

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

## Status

Phases 1 through 4 (Foundation, Micro-interactions, Animations, Polish) are **all complete**. See `docs/records/001-site-wide-redesign.md` for full history.

**Publishing API (Django Studio):** Scaffolded. All models, views, templates, publisher pipeline, StudioShortcut integration, and `import_content` management command are written. Django check passes (0 issues). Existing content (22 files) can be imported into Django via `python manage.py import_content`. Bug fix applied: all JSON fields (tags, sources, urls, related, callouts, annotations) now have custom widgets and render in edit.html, preventing silent data loss on save. Not yet deployed or tested end-to-end. See `docs/records/002-publishing-api.md`.

**Next step:** Deploy publishing_api to Railway, create superuser, test publish pipeline with a draft essay, set `NEXT_PUBLIC_STUDIO_URL` in Vercel. Consider design improvements for the Draftroom editor (richer split-pane, markdown preview, autosave).

**Remaining backlog:**
- Additional content pages and essays (not started)
- Dark mode (deferred; tokens ready in `global.css`)
- Collage hero fragment library (desk item photography, `public/collage/`)

## Recent Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| UI library | Radix Primitives (not shadcn/ui) | Full custom styling over brand; shadcn opinionated defaults fight the aesthetic |
| Section color system | terracotta=essays, teal=field-notes, gold=projects | Creates wayfinding language; color tells you where you are on the site |
| No dashes | Colons, periods, parentheses, semicolons | User style preference; applies to all code, comments, and content |
| Projects: no RoughBox | Inline rgba tinting with three states | RoughBox's fixed CSS classes can't handle dynamic rest/hover/expanded opacity |
| Nav restructure | Essays on... / Field Notes / Projects / Toolkit / Shelf / Connect | 6 items; Shelf promoted to top-level nav; Colophon in footer only |
| Section icons | SketchIcon (hand-drawn SVG) for pages, Phosphor for UI glyphs | Brand identity icons match rough.js aesthetic; utility icons stay crisp |
| Taxonomy rename | investigations to essays, working-ideas merged into field-notes | Less institutional naming; essays signals depth; field-notes consolidates shorter content |
| PatternImage | Seeded PRNG canvas, 3 layers | Deterministic from slug so patterns are stable; fallback when no video/image exists |
| MarginAnnotation approach | Frontmatter array + CSS-only rendering (no Client Component) | Zero JS overhead; `::after` pseudo-elements + `attr()` read data attributes directly |
| MarginAnnotation breakpoint | xl (1280px) for margin positioning, not lg (1024px) | At 1024px only ~128px margin space; at 1280px ~192px |
| Related field notes | Two-tier resolution: explicit `related` slugs, then shared-tag fallback | Curated relationships preferred; automatic fallback ensures no empty section |
| Dark mode | Deferred to separate future effort | Tokens ready in global.css but scope was too large |
| Collage hero aesthetic | Editorial collage (Blake Cale / The Atlantic), dark olive ground, cream serif type | Tactile, layered, uncontained; spec in `docs/plans/collage-hero-implementation-plan.md` |
| DotGrid zone-aware rendering | Cream dots over hero zone, dark dots over parchment, 50px crossfade | Hero component reports height to `--hero-height` via ResizeObserver; DotGrid reads it |
| Comment system | File-based JSON in `data/comments/`, reCAPTCHA v3, sticky notes in margin | Low-infrastructure reader engagement; matches the handwritten margin note aesthetic |
| Publishing delivery | GitHub Contents API commits from Django (not runtime API or direct git) | Preserves SSG architecture; Vercel auto-deploys; no changes to Next.js data fetching |
| Studio editor tech | Django templates + HTMX (not React SPA) | Avoids second SPA; HTMX gives interactivity; simpler than building API + React client |
| Studio owner shortcut | Invisible keyboard shortcut Ctrl+Shift+E (not nav link or FAB) | Zero visual footprint for visitors; Django auth still protects the editor |
| JSON field widgets | Custom widgets (TagsWidget, JsonObjectListWidget) at widget layer, not form clean | Serialization in `format_value()`/`value_from_datadict()` keeps forms and views clean; avoids overriding `clean_*` methods |

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
- **CSS `ch` unit is font-relative in `::after`**: Margin annotation `::after` inherits `font-annotation` (Caveat), making `calc(65ch + ...)` resolve differently than `65ch` in the prose body font. Use `calc(100% + ...)` for font-agnostic positioning
- **Hero grid alignment math**: The `1fr 118px 1fr` grid in the hero (max-w-6xl, 1152px) aligns with the RoughLine label gap inside max-w-4xl (896px) because each hero `1fr` extends exactly `(1152-896)/2 = 128px` beyond the content area. The `lg:pl-[128px]` on the left column shifts the name to align with the content area's left edge. If either max-width changes, both values must be recalculated
- **StudioShortcut `NEXT_PUBLIC_STUDIO_URL`**: Defaults to `http://localhost:8000`. Must be set in Vercel environment when Django Studio is deployed to Railway. The `NEXT_PUBLIC_` prefix means the value is inlined at build time, not runtime
- **Django JSONField silent data loss**: If a JSONField is in `Meta.fields` but not rendered in the template, Django treats absent POST data as empty and resets the field on save. Every JSONField must have both an explicit widget in the form AND a rendering slot in the template
- **ShelfEntry uses `annotation` not `body`**: The main content field for ShelfEntry is `annotation` (textarea in writing area), not `body` like other content types. The edit.html template falls back: `{% if form.body %}...{% elif form.annotation %}...{% endif %}`
