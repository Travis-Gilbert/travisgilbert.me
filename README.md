# travisgilbert.com

Personal creative workbench: a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements. Not a traditional portfolio or resume.

**Live site:** [travisgilbert.com](https://travisgilbert.com)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack, React Compiler, static site generation) |
| UI | React 19 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), CSS custom properties |
| Hand-drawn visuals | rough.js, rough-notation |
| Typography | 7 fonts via `next/font` (Vollkorn, Cabin, IBM Plex Sans, Ysabeau, Courier Prime, JetBrains Mono, Amarna) |
| UI primitives | Radix UI (Accordion, Collapsible, Tabs, Toggle Group, Tooltip) |
| Icons | Phosphor (functional UI) + custom SketchIcon system (brand identity) |
| Content | Markdown + gray-matter + remark, Zod schema validation |
| Visualization | D3.js (force graphs, timelines), rough.js canvas edges |
| Frontend hosting | Vercel (auto-deploy from `main`) |
| Backend | Django 5.x (publishing_api + research_api), DRF, spaCy |
| Backend hosting | Railway (PostgreSQL, Gunicorn) |
| Production orchestration | Orchestra MCP (Python, FastMCP) in `Orchestra MCP/` |

## Getting Started

```bash
npm install        # Install dependencies
npm run dev        # Start Next.js dev server (Turbopack)
npm run build      # Production build (SSG)
npm run start      # Serve production build locally
npm run lint       # Run ESLint (standalone; next lint removed in Next.js 16)
```

## Project Structure

```
src/
  app/                    App Router pages and layouts
    (main)/               Main site route group (essays, notes, shelf, toolkit, projects, now, connections)
    (commonplace)/        CommonPlace knowledge graph frontend (warm studio theme)
    (networks)/           Paper Trail explorer, threads, community wall
    (studio)/             Live editing preview for Django Studio content
    api/                  REST endpoints (comments, flags)
  components/             React components (Server + Client)
    rough/                Client Components for rough.js visuals (RoughBox, RoughLine, DrawOnIcon)
    commonplace/          CommonPlace UI (capture, timeline, network, split pane, sidebar)
    networks/             Network/research page components
    studio/               Studio preview components
    research/             Research display components (backlinks, source cards)
    charts/               D3 chart components (PublicationGraph, visualizations)
  content/                Markdown content (essays, field-notes, shelf, toolkit, projects)
  lib/                    Content loading, API clients, utilities, Zod schemas
  styles/                 Design tokens, global CSS, CommonPlace theme
  config/                 Site configuration (tokens, nav, footer, SEO)
public/
  fonts/                  Self-hosted Amarna variable font
publishing_api/           Django Studio: full site management control panel
research_api/             Django research API: sources, backlinks, Webmention, knowledge graph
Orchestra MCP/            YouTube production orchestration (TickTick, YouTube, Ulysses, Resolve MCPs)
docs/
  records/                Architecture decisions
  plans/                  Design documents and implementation plans
  notes/                  Session notes (gitignored)
```

## Content Workflow

**Manual:**
1. Create a `.md` file in the appropriate `src/content/` subdirectory
2. Add frontmatter matching the Zod schema in `src/lib/content.ts`
3. Push to `main` (Vercel auto-deploys)

**Via Django Studio (deployed at draftroom.travisgilbert.me):**
1. Create/edit content in Studio's editor (markdown toolbar, autosave, split-pane)
2. Move through visual pipeline: Draft -> Review -> Published
3. Studio commits `.md` to GitHub via Contents API; Vercel auto-deploys
4. Site config changes commit to `src/config/site.json` via Git Trees API

Content types: `essays`, `field-notes`, `shelf`, `toolkit`, `projects`, `now.md`, `videos` (via Studio)

## Django Studio

Full site management control panel. Brand component library with django-cotton, django-crispy-forms, and django-tailwind.

**Deployed:** [draftroom.travisgilbert.me](https://draftroom.travisgilbert.me)

```bash
cd publishing_api
python manage.py runserver               # Dev server on port 8000
python manage.py tailwind start          # Tailwind CSS watch mode (run in parallel)
python manage.py import_content             # Import markdown into Django DB
python manage.py import_content --dry-run   # Parse and report without writing
python manage.py import_content --type essays  # Import one content type
```

See `docs/records/002-publishing-api.md` and `docs/plans/2026-02-25-studio-redesign-design.md`.

## Research API

Source tracking, backlinks, Webmention receiver, and CommonPlace knowledge graph backend (12 models, DRF API, spaCy NER engine).

**Deployed:** [research.travisgilbert.me](https://research.travisgilbert.me)

```bash
cd research_api
python3 manage.py runserver 8001             # Dev server (8001 to avoid conflict)
python3 manage.py seed_commonplace           # Seed ObjectTypes + ComponentTypes + master Timeline
python3 manage.py create_sample_data         # Create sample Objects for testing
python3 manage.py run_connection_engine      # Process nodes through spaCy NER
python3 manage.py publish_research           # Publish research data as JSON to Next.js repo
```

See `docs/records/003-research-api.md`.

## Orchestra MCP

YouTube production orchestration system coordinating multiple MCP servers through a unified Conductor skill. TickTick as state machine, Django Studio for video project management.

```bash
cd "Orchestra MCP"
uv run python -m orchestra_ticktick    # Run TickTick + Studio MCP (22 tools)
uv run python -m youtube_mcp           # Run YouTube MCP (9 tools)
uv run python -m ulysses_mcp           # Run Ulysses MCP (7 tools)
uv run python -m resolve_mcp           # Run Resolve MCP (20 tools)
uv run python -m filesystem_mcp        # Run File System Bridge (6 tools)
uv run pytest                          # Run tests
```

See `Orchestra MCP/CLAUDE.md` for full architecture and phase rules.

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Next.js site | Vercel | [travisgilbert.com](https://travisgilbert.com) |
| Django Studio | Railway | [draftroom.travisgilbert.me](https://draftroom.travisgilbert.me) |
| Research API | Railway | [research.travisgilbert.me](https://research.travisgilbert.me) |

**Vercel:** Native Next.js builder. Auto-deploys on push to `main`. No `vercel.json` needed.

**Railway:** Both Django services use nixpacks builder with `railway.toml` (migrate + collectstatic + gunicorn). PostgreSQL managed databases.

**Environment variables:**
- Vercel: `NEXT_PUBLIC_STUDIO_URL`, `NEXT_PUBLIC_RESEARCH_API_URL`
- Both Railway services: `SECRET_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`
- Cross-service: `INTERNAL_API_KEY` (same value on both), `RESEARCH_API_URL`/`RESEARCH_API_KEY` on publishing_api
- research_api: `WEBMENTION_TARGET_DOMAIN`
