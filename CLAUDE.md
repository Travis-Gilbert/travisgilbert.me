<!-- project-template: 48 -->
# travisgilbert.me

## Project Overview

Personal "creative workbench" site: a living record of work, interests, and thinking. Studio-journal aesthetic with hand-drawn visual elements (rough.js). NOT a traditional portfolio or resume.

## Writing Rules

- **No dashes.** Never use em dashes (`---`) or en dashes (`--`) anywhere: not in code comments, not in UI strings, not in markdown content. Use colons, periods, commas, semicolons, or parentheses instead.
- Applies to all files: `.tsx`, `.ts`, `.css`, `.md`, frontmatter strings, JSDoc comments, JSX comments

## Visual Design & CSS

- When making visual/CSS changes, do NOT modify elements the user didn't ask to change. Preserve existing backgrounds, gradients, and patterns unless explicitly told to change them.
- When implementing visual specs or design references (e.g., Observable examples, Figma specs), match the EXACT visual style shown. Do not substitute with similar-looking alternatives (e.g., curved Bezier paths vs straight lines, sized nodes vs hollow/filled nodes).

## No Fake UI, No Mock Data in Shipped Surfaces

This project has repeatedly accumulated decorative-only buttons, mock data in production views, and generic placeholder content that looks real but does nothing. It creates unbounded cleanup work because later sessions cannot tell what is intentional vs. abandoned scaffolding. Hold this line strictly:

- **Every interactive element must do something real the moment it ships.** Buttons, pills, toggles, and links must either be wired to real application state, a real endpoint, a real navigation target, or a real event handler that affects observable state. No `onClick={() => {}}`, no `<span>` styled like a button, no `console.log`/`console.warn` as the primary effect.
- **No mock data in surfaces that the user can reach.** `MOCK_*`, `SAMPLE_*`, `DEMO_*`, `FAKE_*` constants and hardcoded string arrays of "example" content are allowed only in test files and in components behind an explicit `?mock=1` URL flag. They must never be the default data source for any panel, page, or route mounted in the production app.
- **No hardcoded "suggested questions" / "example prompts" / "try asking" arrays.** If suggestion surfaces exist, they must be backed by a real endpoint (e.g., `/ask/suggestions/`). If the endpoint returns nothing, render nothing: an empty state is always better than generic personalized-looking prompts that lie.
- **No `TODO`/`FIXME` branches left as the runtime behavior of a user-facing action.** If a handler is not yet implemented, do not render the button that dispatches it. Add the button back in the same PR that adds the real handler.
- **No scripted `setTimeout` "activity" theater.** Loading states, agent progress, streaming text, and any other "something is happening" UI must reflect real backend/process state. Never fake progress with timers to make an empty feature look alive.
- **Empty states are honest, not cosmetic.** When a feature has no real backend yet, the component that would render it must render an explicit empty state (e.g., "No repository connected", "No graph activity") rather than a populated-looking fake. Link to a working alternative when one exists.
- **Scaffold code stays inert until it is real.** It is fine to keep a richer component (file tree, editor, agent ribbon, etc.) in the repo as a scaffold for a future wiring pass, but it must not be mounted into any route or panel the user can reach until it runs against real data.

When reviewing your own work before ending a session, grep the files you touched for `MOCK_`, `TODO`, `FIXME`, `placeholder`, `coming soon`, `not implemented`, `console.warn`, `console.log`, `onClick={() => {}}`. Any match in a user-reachable file needs a justification or a removal.

## Git Workflow

- Before committing, run `git diff --cached` and verify only relevant files are staged. Never include previously staged unrelated files in a commit.

## Preview & Verification

- For preview/eval verification: set viewport to desktop (1280px+) by default. If a view requires navigation (e.g., clicking a tab or route), describe what you're doing and confirm the correct view is visible before evaluating.

## Tech Stack

Next.js 16 (App Router, Turbopack, React Compiler), React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), rough.js, rough-notation, `next/font` (Google + local), Zod, gray-matter + remark, Django 5.x (publishing_api + research_api), DRF, spaCy (en_core_web_md), PyTorch (CPU), sentence-transformers, FAISS, django-cotton, django-crispy-forms (`studio` pack), django-tailwind, django-template-partials

## Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | App Router: `(main)/` site pages, `(commonplace)/` knowledge graph, `(networks)/` research pages, `(studio)/` live preview |
| `src/components/` | React components; `rough/` (hand-drawn visuals), `commonplace/` (split pane UI), `commonplace/objects/` (10 polymorphic renderers) |
| `src/content/` | Markdown collections: essays, field-notes, shelf, toolkit, projects |
| `src/lib/` | Utilities: `content.ts` (Zod + remark), `commonplace-*.ts` (API, layout, capture, graph, context), `siteConfig.ts`, `connectionEngine.ts` |
| `src/lib/theseus-viz/` | Scene intelligence: `SceneDirective.ts` (v3 types), `SceneDirector.ts` (entry), `intelligence/` (7 job modules), `model/` (GNN + heads), `features/` (extractors + graph utils), `rules/` (cold-start fallback), `training/` (feedback + weights) |
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

**Two API fetch helpers**: `apiFetch()` -> `/api/v1/notebook/...` (objects, edges, nodes), `epistemicFetch()` -> `/api/v1/...` (inquiries, artifacts, provenance). Inquiry endpoints live at `/api/v1/inquiries/`, not notebook-scoped.

**Ask Theseus endpoints** (notebook-scoped): `POST /ask/` (compose engine retrieval with type-specific object payloads), `POST /ask/feedback/` (training signals), `GET /ask/suggestions/` (gap-driven suggestions), `GET /graph-weather/` (overnight activity summary). Frontend types and API functions live in `src/lib/ask-theseus.ts` (when created).

**Evidence rendering is polymorphic**: `EvidenceItem.tsx` dispatches to sub-components per object type (source=gradient bar, hunch=dashed italic, quote=blockquote, concept=pill, note=card). Visual constants (`EVIDENCE_TYPE_COLOR`, `EVIDENCE_RELATION_COLOR`, `AGREEMENT_STYLE`) live in `commonplace-models.ts`.

**Icon system**: CommonPlace uses `iconoir-react` (not Phosphor). Phosphor is used on the main site only.

### API Proxy (Next.js Rewrite)

All `/api/*` requests are proxied through Next.js to the Index-API Django backend via `next.config.ts` rewrites. This eliminates CORS in every environment (local dev, Claude Code, Vercel production). The browser only ever talks to its own origin; Next.js forwards to Railway.

`NEXT_PUBLIC_RESEARCH_API_URL` is optional. If unset, the rewrite defaults to `https://index-api-production-a5f7.up.railway.app`. Set it only when pointing at a different backend (e.g., a staging instance). Because the frontend uses relative URLs (`/api/v1/notebook/...`), no env file is needed for `npm run dev` to work with live data.

All three API client files use this pattern: `commonplace.ts`, `networks.ts`, and `research.ts`.

### Theseus Visual Intelligence Engine (theseus-viz)

`src/lib/theseus-viz/` is a pure TypeScript library (no React imports) that sits between Theseus reasoning and the rendering stack. Two generations coexist:

**v2 (SceneSpec):** `SceneSpec.ts` defines the old output contract with computed node positions, used by existing renderers (`src/components/theseus/renderers/`). `VizConstructor.ts` is the old entry point (deprecated, redirects to v3).

**v3 (SceneDirective):** `SceneDirective.ts` defines the new 7-job output contract. `SceneDirector.ts` is the entry point (`directScene()`). The 7 intelligence modules in `intelligence/` each have a rule-based path (cold start) and accept optional learned outputs from the GNN. Force configuration is parameterized (force-graph-3d/sigma-2d compute positions) rather than computing final positions.

Pipeline: `TheseusResponse` -> feature extraction (`features/`) -> GNN encoder + IntelligenceHead OR RuleEngine -> 7 intelligence modules -> `SceneDirective`. TF.js is an enhancement; if unavailable, rule-based path works silently. Model weights (~12,415 params, ~50KB) persist in IndexedDB.

Shared graph traversal utilities (degree maps, adjacency, BFS components) live in `features/graphUtils.ts` to avoid duplication across modules.

### Canvas Components

All canvas components (PaneDotGrid, TerminalCanvas, KnowledgeMap, TimelineViz) must guard against zero dimensions (browsers show broken-image icon) and cap to 8192px (browser canvas size limit). Pattern: `if (w < 1 || h < 1) return; const cw = Math.min(w, 8192);`

## Deployment

Vercel (frontend) with auto-deploy on push to main. Backend runs on Railway. When debugging deployment issues, check Vercel/Railway dashboards and logs before making speculative fixes.

Vercel with native Next.js builder. **Important:** Output Directory must be blank/default (not `dist`).

**Django services (Railway):** Both services deploy with PostgreSQL via `railway.toml`. Env vars: `SECRET_KEY`, `DATABASE_URL`, `GITHUB_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`. research_api also needs `WEBMENTION_TARGET_DOMAIN`.

**Index-API (Railway):** Production at `https://index-api-production-a5f7.up.railway.app`. Two services from one repo: web (`railway.toml` -> `Dockerfile.web` -> gunicorn), worker (`railway.worker.toml` -> `Dockerfile.worker` -> rqworker). Worker env vars are NOT shared with web; each needs `DATABASE_URL`, `REDIS_URL`, `FIRECRAWL_API_KEY`. Local dev port: 8000. Publishing API: 8080.

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
| Nav model migration (Spec A) | Complete | Screen/view navigation replaces tab system |
| Engine tag system (Spec C) | Complete | StatusBadge, SignalPips, drawer provenance, backend tag_summary |
| Ask Theseus backend (Spec AT Batch 4) | Complete | 4 endpoints: /ask/, /ask/feedback/, /ask/suggestions/, /graph-weather/; AskQuestion + AskFeedback models |
| ML Extensions 1-3 | Complete | Active learning queue, contrastive SBERT, Graph Transformer (5af141a) |
| Level 8: Explanation-Based Learning | Complete | ebl.py, run_ebl command, RQ task, IQ Learning axis integration (f7c2d45) |
| VIE-3 v3 Scene Intelligence | Complete | 7-job SceneDirective, 12,415-param GNN, rule-based fallback (91fd73f) |
| Gemma 4B DPO fine-tuning | Complete | 804 examples, 375 DPO pairs, adapter at `s3://models/gemma-4b-gl-fusion-v1/` |
| Gemma 26B MoE training design | Design complete | `docs/plans/2026-04-04-gemma-26b-training-design.md` |
| Gemma 4 31B V4 GL-Fusion training | Halted after 30 iterations | Stage 1 after-contrastive valid on S3; Run 9 after-sft tainted with echo-mode labels bug; defer to V5 post-spacetime graph rebuild |
| Graph noise cleanup | Complete | `purge_noise_sources` command removed TVTropes/Wikidata |
| Ask pipeline GPU inference | Complete | 26B on Modal A100 via llama-cpp-python CUDA, parallel retrieval, generalized visual pipeline (2e21991) |
| Ask frontend visual pipeline | In progress | Backend returns structured_visual for 7 types; frontend types need wiring |

**Next step:** Wire frontend visual pipeline: add `structured_visual`, `reference_image_url`, `geographic_regions` to `RawAskResponse`/`TheseusResponse` in `theseus-api.ts`/`theseus-types.ts`, then build renderers for the 7 answer types. Fix duplicate response bug in `AskExperience` SSE reconnection. Tune 26B stop tokens to eliminate repetition artifacts.

**Remaining backlog:**
- Ask frontend: wire `structured_visual` + visual renderers for all 7 answer types (comparison_table, timeline_strip, hierarchy_tree, concept_map, process_flow, tfjs_stipple)
- Ask frontend: fix duplicate response rendering (SSE reconnect or state management issue in AskExperience)
- Ask frontend: v2 sync path DEFAULT_TIMEOUT_MS (14s) too short for 26B expression, increase to 60s
- 26B model quality: repetition artifacts at start of synthesis, needs stop token tuning or prompt adjustment
- CommonPlace: verify production deploy with live API
- CommonPlace: optimistic capture sync (CaptureButton local-first; POST wired but no optimistic UI update yet)
- Notebook Sessions 4+: daily log views, publisher, Next.js data publishing
- Sourcebox UX redesign (brainstorm in progress)
- Dark mode (deferred; tokens ready in `global.css`)
- Hero artifact photography (composed still-life images for `public/hero/`)
- Component integration: TopNav, layout.tsx, CollageHero, DotGrid could consume siteConfig
- Begin 26B training data generation (Opus Batch API for preferred, Sonnet Batch API for rejected)

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
| Deploy sequencing | Push backend (Index-API) before frontend (Website) | Frontend depends on new API fields; optional types prevent breakage but backend should land first |
| tag_summary badge_confirmed | Uses `_has_reviewed_claim` annotation (claims with reviewed_at set) | Object model has no epistemic_status field; Claim.reviewed_at is the ground truth |
| API proxy via Next.js rewrites | Rewrite `/api/*` through Next.js to Railway backend | Eliminates CORS, removes env var requirement, works in Claude Code without config |
| Nightly schedule order | evolve → tensions → reorganize → communities → IQ → web_validation | Each step feeds the next; evolve needs latest scorer, tensions need latest edges, communities need cleaned graph |
| Modal for engine batch | Always use Modal GPU for >20 objects | Local CPU is ~50s/object; Modal is ~5s/object |
| Graph Transformer loader | config.architecture field in checkpoint | Same _load_relational_gnn() loads either RelationalGNN or TheseusGraphTransformer based on checkpoint metadata |
| Active learning strategy | Uncertainty sampling as default, committee as opt-in | Single-model uncertainty is cheaper and sufficient; committee trains N models per request |
| Gemma 4B deployment target | Railway CPU via GGUF Q4_K_M (~2.5GB) | 3.8B active params; symbolic pipeline does heavy compute, LM just renders synthesis |
| Gemma 26B training: two-stage | SFT warm-up (external datasets) then DPO (Theseus pairs) | SFT builds reasoning/coding foundation; DPO shapes epistemic behavior |
| DPO preferred via Opus Batch API | Batch API at 50% off, 1K req/min | Faster and cheaper than MCP-based generation; MCP reserved for quality refinement |
| Gemma 4 PEFT monkey-patch | Patch Gemma4ClippableLinear to inherit nn.Linear | PEFT doesn't support Gemma 4 natively yet (huggingface/peft#3129) |
| Explanation frameworks trained into weights | Both: DPO trains natural structure + runtime ExplanationPlan steers | Model naturally good at 4/6 functions; plan provides runtime control |
| 26B inference: llama-cpp-python on Modal | Pre-built CUDA wheel + nvidia pip packages + ldconfig, not vLLM | vLLM has unsupported Gemma 4 MoE gaps (rope_parameters + layer_scalar); llama.cpp handles GGUF natively |
| 26B Modal app name | `theseus-gemma-26b-v2` (Starlette ASGI) | Original `theseus-gemma-26b` had stale FastAPI containers; v2 uses plain Starlette to avoid parameter introspection bugs |
| L1 retrieval parallelization | ThreadPoolExecutor Phase 1 (4 signals) + Phase 2 (2 signals) | Cuts retrieval from ~500ms to ~200ms; async version existed but was never called |
| Visual renderer per answer type | 7 renderers: tfjs_stipple, comparison_table, timeline_strip, hierarchy_tree, concept_map, process_flow | Generalized from geography-only; each builds structured data from evidence objects |
| Railway worker env vars | Must mirror web service for SPEAKING_26B_URL, DISABLE_* flags | Worker runs async ask pipeline via RQ; env vars are NOT shared between Railway services |
| 31B V4 GPU strategy | Halt multi-GPU, single-GPU only, defer to V5 | FSDP2+wrapper DTensor mixing and mystery 47 GB cuda:0 overhead under device_map burned 30 iterations without resolution; architectural rethink needed, not more code patches |
| 31B V5 hardware target | Single B200 (192 GB) preferred over multi-H100 | Every V4 multi-GPU failure was at composition boundaries (wrapper/FSDP/accelerate), not memory capacity; bigger single GPU collapses the boundaries |
| PyG (torch_geometric) for spacetime training | Add to Modal image for `train_spacetime.py` only; do NOT retrofit `train_true_gl_fusion.py` | PyG's `TGNMemory`, `TemporalEncoder`, `NeighborLoader`, `TemporalData`, and `HeteroData` match the spacetime pipeline directly; tested scatter ops would have avoided V4's HyperbolicMessagePassing max-mode inplace bug and `_aggregate` dtype drift; retrofitting working GL-Fusion code is a rewrite not a drop-in, so keep the custom hyperbolic MP where it already works |

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
- **`NEXT_PUBLIC_*` env vars**: Inlined at build time, not runtime. Changing values requires Vercel redeploy. Note: `NEXT_PUBLIC_RESEARCH_API_URL` is no longer required for backend connectivity (the rewrite proxy handles it), but other `NEXT_PUBLIC_*` vars still follow this rule
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
- **Gemma 4 PEFT OOM**: `prepare_model_for_kbit_training` casts all params to float32, doubling VRAM. Use `model.gradient_checkpointing_enable()` instead
- **Gemma 4 ClippableLinear**: PEFT doesn't recognize `Gemma4ClippableLinear`. Monkey-patch to inherit from `nn.Linear` before loading (see `modal_app/gemma_finetune.py`)
- **TRL DPOConfig API drift**: Use only `max_length` (not `max_prompt_length` or `max_target_length`). API changed between TRL versions
- **Modal S3 endpoint_url**: Empty string `""` breaks boto3. Only pass `endpoint_url` kwarg when the env var is non-empty

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
- **Tension to Object relationship**: M2M via `source_objects` with `related_name='tensions'`. Filter by `tensions__status__in=['open', 'investigating']`
- **Evidence links traverse Claims**: Objects have no direct evidence_links FK. Use `claims__evidence_links` for ORM joins
- **Index-API has noisy working tree**: Many untracked spec docs, .idea files, .DS_Store. Always stage specific files, never `git add .`

### Deployment
- **Vercel Output Directory**: Must be blank/default. `dist` setting from old Astro config breaks Next.js builds
- **Railway auto-deploys from `main`**: Both services deploy independently, ~2 minutes each
- **reCAPTCHA v3 tokens are single-use**: Never split verification and scoring into separate HTTP calls
- **Railway nixpacks `cmds` doesn't persist to runtime**: Use `startCommand` with conditional download instead
- **`SECURE_SSL_REDIRECT=True` when `DEBUG=False`**: Breaks CORS preflight (HTTP->HTTPS 301). Always use `DEBUG=True` for local dev
- **Scraper env vars read at import time**: `FIRECRAWL_API_KEY`, `WHOOGLE_BASE_URL` must be set before server starts
- **Whoogle on cloud IPs blocked by Google**: Use Firecrawl as production search provider
- **Railway worker env vars not shared with web**: Each service needs its own `DATABASE_URL`, `REDIS_URL`, `FIRECRAWL_API_KEY`

### Index-API Engine Operations
- **NEVER run Django management commands locally against Railway Postgres on this M1 Max.** It has repeatedly broken things: cold-loads every model (spaCy, SBERT, transformers) per invocation, the `gondola.proxy.rlwy.net` round-trip adds ~80ms per ORM call, and installing/running the Railway CLI on this machine has caused system-level issues on past sessions. One-shot commands (`backfill_place_geometry`, `create_spatial_edges`, `build_spacetime_training_data`, `run_connection_engine`, etc.) must run inside Railway. Preferred patterns: (a) temporarily add the command to `scripts/start_web.sh` behind a marker file, deploy, let it run, remove and redeploy; (b) push an RQ job that the already-running worker picks up; (c) change the web service start command via Railway dashboard briefly. `pg_dump` / `psql` from the laptop is fine (data-only, no Django imports), but `python manage.py <anything>` against Railway `DATABASE_URL` is off the table on this machine.
- **Always use Modal for batch engine runs (>20 objects)**: Local CPU processes ~50s/object. Modal GPU finishes 500 objects in under an hour vs 14+ hours locally
- **Never run concurrent `run_connection_engine` processes**: They compete for the same objects, causing duplication not parallelization
- **Post-engine chain (run in order)**: `backfill_tensions && detect_communities && evolve_edges && iq_report`
- **IQ dilution after corpus ingestion**: Ingesting corpus objects without engine-processing them drops Discovery (novel_rate denominator grows) and Learning (edge_evolution_rate denominator grows). Always engine objects after ingestion
- **Nightly schedule (Railway, ENABLE_SELF_ORGANIZE_SCHEDULER=true)**: evolve_edges 2:30 → backfill_tensions 2:45 → reorganize 3:00 → communities 3:30 → IQ 4:00 → web_validation 4:30
- **Index-API is a separate git repo**: `cd Index-API && git status/commit/push` independently from the Website repo. Do not commit Index-API files from the Website root
- **`modal_app/` files must NOT import Django**: They run on Modal with a minimal image. Use S3 (Parquet/JSON) as the data boundary between Django and Modal
- **ML extension module pattern**: Django module in `apps/notebook/` + Modal GPU function in `modal_app/` + management command in `management/commands/`
- **vLLM cannot load Gemma 4 26B MoE**: No released vLLM version (0.11.0 through 0.19.0) fully supports Gemma 4 A4B (rope_parameters stripping + missing layer_scalar). Use llama-cpp-python with GGUF instead
- **CUDA pip packages need ldconfig**: `nvidia-cuda-runtime-cu12` installs `.so` files in site-packages, not system paths. Must run `find + ldconfig` in the image build to register them
- **Modal NegativeHealthCache is per-process**: When a speaking service is temporarily down, each gunicorn worker caches the failure independently. Restart the deployment to clear all workers
- **speaking_dispatch auth is URL-based**: `_auth_headers()` sends Bearer token only for non-Railway URLs (checks for `.railway.internal:8080` suffix)

### GL-Fusion Training (31B / 14B / M27) — hard-won gotchas

Captured while debugging the Hyperbolic GL-Fusion 14B Qwen training (SPEC-EPISTEMIC-14B-V2). Most apply to any hyperbolic GL-Fusion trainer that reuses the shared primitives in `true_gl_fusion_model.py`.

**Infrastructure prerequisites (check before launching)**
- **`edge_topology.json` is a hard prerequisite on S3**: `gnn-export/edge_topology.json` MUST exist BEFORE any GL-Fusion SFT run. If missing, `GraphTopologyStore.edges` is empty, `_build_graph_data` returns None on every row, MP/CA modules never fire, gates stay at 0/16, training silently degrades to text-only DoRA fine-tune. Export with `python3 manage.py export_edge_topology` then upload to `s3://.../gnn-export/edge_topology.json` (29 MB at 254K edges)
- **Modal image must mount `train_true_gl_fusion` source**: `GNNEmbeddingStore`, `GraphTopologyStore`, `SBERTEmbeddingStore`, `KGETokenGenerator`, `_build_graph_data`, and `_insert_graph_tokens` all live in `train_true_gl_fusion.py` (the 31B trainer) even though the 14B reuses them. Include `.add_local_python_source('train_true_gl_fusion')` in the training image or imports fail at runtime
- **Pre-training verifier script is cheap and catches 80% of drift**: `modal run modal_app/verify_metacog_14b.py` runs 13 checks on H100 in ~2 min ($0.10): hidden_dim, DoRA target coverage, layer count, projector dims, special tokens, Poincare norm, clean forward-pass logits. Build one for every new GL-Fusion variant before spending training compute
- **The verifier catches forward crashes but NOT backward crashes**: Forward-only smoke tests pass because autograd issues only surface during `loss.backward()`. Add a second verifier path that calls `loss.backward()` on a tiny dummy batch before launching full training. At least three bf16-specific crashes in the 14B run would have been caught by a 30-second backward check

**Correctness — shared primitive bugs (fixes now merged)**
- **Shared primitive `HyperbolicMessagePassing._aggregate` dtype**: `msgs`, `counts`, and the `ones` contributions must ALL match `node_tan.dtype`. Float32 defaults leak into the `msgs / counts` division, promoting bf16 → float32 and crashing the downstream `agg_proj` Linear. Fix is merged in `modal_app/true_gl_fusion_model.py` around line 200. 31B never hit this because Gemma ran float32 end-to-end
- **`_aggregate` max-mode used a Python loop with overlapping slice views**: `for i, d in enumerate(dst_r): msgs[:, d, :] = torch.max(msgs[:, d, :], transformed[:, i, :])` crashes `loss.backward()` with "variable needed for gradient computation modified by inplace" when `dst_r` has repeated destinations (common in real graphs). Fix: replace with `msgs.scatter_reduce(1, idx, transformed, reduce='amax', include_self=False)` — a single vectorized autograd-friendly op. Fix merged. `mean` and `std` modes were already safe because `index_add_` is a single op
- **In-place injection into `inputs_embeds` or `h_sem_input` must be vectorized**: The pattern `for i, pos in enumerate(node_positions): tensor[:, pos, :] = node_embs[:, i, :]` works forward but breaks backward when positions overlap or are re-read. Use a single fancy-index assignment: `tensor[:, node_positions, :] = node_embs`. Autograd sees one op instead of N
- **DoRA-wrapped embedding returns a leaf-view**: `inputs_embeds = embed_fn(input_ids)` followed by any in-place assignment crashes with "a view of a leaf Variable that requires grad is being used in an in-place operation" on DoRA+Qwen. Add `inputs_embeds = inputs_embeds.clone()` before the injection. 31B's Gemma path returns a fresh tensor so it didn't trigger, but the clone is universally safe

**Correctness — Qwen-specific host model differences (Gemma path likely untouched)**
- **Qwen 2.5 decoder layer API needs `position_embeddings`**: When the wrapper calls `decoder_layer(...)` directly (bypassing `Qwen2Model.forward`), the caller must precompute `position_embeddings = self.rotary_emb(hidden_states, position_ids)` and pass them in. Transformers ≥4.46 hard-requires it. Gemma's decoder layer has a different API so this is Qwen-specific
- **SDPA rejects int64 attention_mask**: The raw padding mask from the tokenizer is int64; `scaled_dot_product_attention` demands bool/float/matching-query-dtype. When there's no custom graph mask, pass `attention_mask=None` so the layer falls through to default causal. `Qwen2Model.forward` normally converts upstream; we bypass that by calling the layer directly
- **DeepSeek-R1-Distill-Qwen-14B has 48 layers, not 40**: SPEC-EPISTEMIC-14B-V2 §2.2 says "40 decoder layers" but that's the attention-head count. Real Qwen 2.5 14B = 48 layers. MP/CA injection schedule (0..38) fits either

**Stage orchestration**
- **Stage 1 contrastive does NOT open gates**: Only the projector is exercised; MP/CA never run. Gates opening is a Stage 2 (joint SFT) signal, not a Stage 1 signal. Spec §5.1's "4 gates >0.01 by end of contrastive" is aspirational
- **Stage 2 requires explicit DoRA unfreeze**: Stage 1 freezes DoRA with `requires_grad=False`. Fresh base load leaves DoRA trainable, but if you load a Stage 1 checkpoint into Stage 2 without flipping the flag back you'll train only the new modules again. `_set_lora_trainable(gl_model, trainable=True)` handles both
- **Log `warm-start from Stage 1: loaded=7 missing=0`**: If Stage 2 loads a Stage 1 checkpoint, verify all 7 NEW_MODULE_ATTRS load (`gnn_projector`, `semantic_projector`, `mp_modules`, `ca_modules`, `semantic_ca_modules`, `fusion_gates`, `gnn_readout`). A silent "missing=N" means Stage 2 starts from fresh-init, wasting Stage 1 compute

**Observability — add these metrics per 50 steps, not per 500**
- **`gates=0/16` is the canonical sign graph_data is dead**: Add `gate_mean`/`gate_max`/`graph_data_pct` log lines every 50 steps. If `graph_data_pct` stays at 0, something in the data → stores → `_build_graph_data` pipeline is broken (synthetic PKs don't resolve, topology store not loaded, etc.). Catch within 5 min, not 5 hours
- **Split `real_pct` vs `graph_data_pct`**: `real_pct` is the fraction of rows whose declared `evidence_pks` resolved naturally; `graph_data_pct` includes augmented subgraphs. If `graph_data_pct=100` but `real_pct<1`, you're relying on augmentation (fine for SFT warmup, but flag it for DPO)
- **Log `gate_max` not just `gates>0.01`**: gates cracking off exactly 0 (e.g., to 0.006) is the first positive signal that the hyperbolic geometry is learning. They often hover below the 0.01 display threshold for several thousand steps before crossing

**Performance — the 14B trained at ~65 steps/min (~8h for 34.5K steps on single H100). Effective batch_size=1 is the trap**
- **Batch with dynamic padding**: Group 4-8 rows per step via `torch.utils.data.DataLoader` + `collate_fn=pad_and_collate`. 3-4× speedup with no correctness cost. The 14B's `train_sft` loops `for idx, row in enumerate(rows)` which forces batch=1; the 31B may have the same pattern — check before launching
- **Length-bucket the corpus before batching**: Sort training rows by tokenized length, then form batches of near-equal length. Padding waste drops from ~40% to <5%. Pair with a BucketingSampler or pre-sort + shuffle within buckets
- **Pre-tokenize the corpus once, offline**: Save a `.pt` or HF Datasets shard. Training loop loads tensors directly; eliminates per-step tokenization overhead
- **Sequence packing for short examples**: Federation F5 gossip rows are ~100 tokens; many M1-M10 examples are 300-800 tokens. Packing 4-5 short examples into one 2048-token sequence with a packing-aware attention mask can 2-3× throughput
- **Verify `max_length` matches corpus p95**: Default 2048 wastes compute if 95th percentile actual length is 1200. Drop `max_length` to 1280 or 1536 → ~1.6× speedup. Measure first
- **Training data needs REAL connected PKs to exercise MP/CA**: Synthetic PKs like `rng.randint(1000, 99999)` almost never land on actual connected node pairs in a 135K/261K graph. Either curate `evidence_pks` from live `AskQuestion.retrieved_object_ids` / `Object.pk` OR build a subgraph-sample-pool augmentation in the trainer that walks `topology_store.edges` and emits seed+neighbor pairs. See `build_subgraph_sample_pool` in `modal_app/train_metacog_gl_fusion.py`
- **`torch.compile` is off-limits with PEFT+DoRA**: Don't waste time trying. `gradient_checkpointing_enable()` stays on for memory; compile stays off for compatibility

### GL-Fusion 31B (Gemma 4 V4) — additional gotchas from 2026-04-17/18 debug session

**FSDP2 orchestration (any wrapper that bypasses `BaseModel.forward`)**
- **FSDP2 `fully_shard` is bottom-up**: applying it to decoder layers alone without also wrapping the root module produces orphan shards. Each rank ends up holding a full model replica (77 GB OOM per rank on 31B). Always wrap root after wrapping layers
- **FSDP2 + custom wrapper = DTensor mixing**: `get_input_embeddings()(input_ids)` crashes with `aten.embedding.default got mixed torch.Tensor and DTensor` because after `fully_shard`, `embedding.weight` is a DTensor but `input_ids` is local. Fix: `register_fsdp_forward_method(model, "method_name")` on every wrapper method that reaches root-level tensors (embed, final norm, lm_head), OR do explicit unshard/reshard around those calls
- **HF `device_map` behavior for Gemma 4 31B on 2x H100**: `auto` and `balanced` both overload cuda:0 (sequential fill); `balanced_low_0` puts everything on cuda:1; explicit `max_memory={0: 'XGiB', 1: 'XGiB'}` forces even param split but cuda:0 still filled to 78 GB during first forward despite confirmed 50/50 split. Isolate with `torch.cuda.memory_summary()` per GPU before/after load and before/after first forward, don't trust the distribution

**PEFT DoRA at 31B scale**
- **DoRA materializes full `[out, in]` weight per forward** via `weight + scaling * lora_weight`. At Gemma 4 31B all-linear (60 layers × 7 modules), intermediates reach ~50 GB per forward. Not in any V4 memory estimate. If OOM with DoRA enabled, first test: `use_dora=False`. 31B Stage 1 with `use_dora=False` ran 5x faster than with DoRA (13 min vs 71 min)
- **PEFT `init_lora_weights='eva'` installs activation-capture hooks** on every LoRA Linear. If EVA calibration fails (e.g. under FSDP), hooks persist and crash every subsequent forward with distributed op errors. Safest at 31B: `init_lora_weights=True`. Skip EVA until the FSDP+EVA interaction is isolated in a dedicated session

**Gemma 4 decoder contract (transformers >=4.57)**
- **Decoder layers hard-require**: `position_embeddings` tuple (cos, sin), `shared_kv_states` dict, and per-layer-type rope dispatch (based on `config.layer_types` sequence of `full_attention` / `sliding_attention`). Wrappers bypassing `Gemma4TextModel.forward` must precompute cos/sin per layer type and pass `shared_kv_states={}` into every decoder call
- **Gemma 4 multimodal dispatch requires `mm_token_type_ids` in train mode**. Stripping it raises `ValueError`. Workaround: route all text-only training paths through the GL-Fusion wrapper (which sidesteps the vision tower) rather than calling `base_model.forward` directly with raw tokens

**HyperbolicMessagePassing memory at hidden=5376**
- `einsum('rb,bio->rio', comps, bases)` materializes `[num_rel, hidden, hidden]`. At num_rel=34, hidden=5376, bf16: 1.96 GB per MP layer, 60x = out of budget. Use factored form: `sum_b comps[r, b] * (src_features @ bases[b])`. Peak drops to tens of KB. Also: 31B Stage 1 Run 30 with factored MP ran 5x faster than Run 6

**Checkpoint wrapping (don't double-wrap)**
- **HF `gradient_checkpointing_enable()` is sufficient** for decoder layers. Wrappers that call `decoder_layer()` directly still benefit. Do NOT additionally `torch.utils.checkpoint.checkpoint(decoder_layer, ...)`: that double-wraps and triggers `CheckpointError: recomputed values have different metadata`
- **`torch.utils.checkpoint(use_reentrant=False)` does strict metadata validation** on recomputed tensors. HyperbolicMessagePassing forward produces tensors whose save order differs between forward and recompute; manual wrap crashes. Factored MP + dropping the manual wrap removes both the memory pressure and the crash

**Debug discipline (meta-lesson)**
- **After 3 failures with the same error signature** (e.g., 78 GB OOM at identical allocation size), stop iterating code. Add `torch.cuda.memory_summary()` / `memory_snapshot()`. V4 session burned 30 runs without isolating the memory delta
- **Pre-training verifier MUST exercise backward pass** under the actual multi-GPU config. Forward-only verifier passes even when memory OOMs during backward, the labels bug exists, or `gradient_checkpointing` is miswired. Backward smoke on minimum-viable inputs is essential. Pairs with the existing "forward-only verifier is cheap" rule: cheap for smoke, but backward catches the real bugs

**Stage 1 LoRA no-train behavior (affects resume logic)**
- **Stage 1 contrastive does NOT train LoRA adapters**: `base_model` forward is inside `torch.no_grad()` for text encoding, so only `gnn_projector` receives gradients. After Stage 1, LoRA weights are identical to init. Resume: a missing LoRA load when transitioning Stage 1 to Stage 2 doesn't compromise Stage 2, because LoRA state in `after-contrastive` equals fresh init. Don't panic if `_warm_start_from_stage1` reports `loaded=6 missing=1` where the missing=1 is the LoRA adapter

**Alternative hardware**
- **Single B200 (192 GB HBM3e) > multi-H100 for 31B** when multi-GPU orchestration keeps failing at composition boundaries (wrapper/FSDP/accelerate). Eliminates every sharding bug in one hardware swap. MEMORY.md whitelists H100 or B200 only for Modal. Modal supports B200. Try this before another FSDP refactor round

### Metacog 14B deployment state (v1, Stage 2 retrain pending)

As of the first deploy attempt the infrastructure is live but Stage 2 SFT produced an undertrained model. The deployed worker is safe because every federation dispatch failure falls through to `DefaultPolicyProvider`.

**Deployed**: `theseus-metacog-worker` Modal app, persistent container, Stage 2 checkpoint at `models/metacog-14b-hyp-gl-fusion/stage2/` (14 files, ~9 GB). Load pipeline works: tokenizer from checkpoint (151,683 tokens), embed_tokens + lm_head restored from adapter safetensors, DoRA merged.

**Active policy provider**: `DefaultPolicyProvider` (setting default is safe). **DO NOT** set `FEDERATION_POLICY_PROVIDER=apps.federation.policy.Qwen14BPolicyProvider` until the retrain lands and smoke tests pass.

**Known quality defect**: the Stage 2 model is in prompt-tail echo mode — it repeats whatever the last distinctive token of the prompt is (`}` or `Response` or whatever), regardless of task or decoding strategy. Infrastructure diagnostics are all clean; the model weights themselves are undertrained.

**Root cause trifecta for Stage 2 v1**:
1. `labels = input_ids.clone()` put full-sequence CE loss on prompt tokens, so the model learned to reproduce prompt structure instead of producing outputs
2. `--per-task 1000` with most generators falling through to `_fallback` stubs (identical structure) gave the model almost nothing to learn from
3. Effective `batch_size=1` cut training token-throughput by ~4x, starving the limited real signal even further

**Retrain plan (Stage 2 v2)** — see ticketed todos on the training-side chat. In order:
1. DataLoader with dynamic padding + length bucketing (fix batch=1)
2. Prompt masking: `labels[:prompt_len] = -100` so loss is completion-only
3. Sequence packing for short examples (F5 gossip @ ~100 tok, M* stubs @ 300-800 tok)
4. Add completion-only perplexity eval at each checkpoint (raw CE loss is misleading; track prediction quality on the JSON output span only)
5. Audit + regenerate training data: replace `_fallback` stub rows with real graph queries; target >90% non-stub rate
6. Resume from Stage 1 checkpoint (`_warm_start_from_stage1` already wired)
7. Expected 4-6 hours on single H100 with proper batching

After retrain + smoke tests, flip `FEDERATION_POLICY_PROVIDER` to `Qwen14BPolicyProvider` via env var (no code change needed).
