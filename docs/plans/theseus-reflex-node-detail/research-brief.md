# Research Brief: Double-click Theseus graph node opens Reflex node-detail surface

_Generated 2026-04-24 for: "double-click on a Theseus graph node should open a Reflex site/tab dedicated to that node, showing its epistemic weight, contributors, and connections."_

## Codebase findings

### Canvas, click handlers, and the existing double-click hook

- `src/components/theseus/explorer/CosmosGraphCanvas.tsx` already declares a `onPointDoubleClick?: (pointId: string) => void` prop (lines 55-58) and a `DOUBLE_CLICK_MS = 320` window (line 86). A manual single-vs-double detector lives inside the cosmos.gl `onClick` config callback (lines 2310-2341): if the same `pointId` is clicked twice within `DOUBLE_CLICK_MS`, `onPointDoubleClickRef.current` fires; otherwise the click falls through to `onPointClick`.
- cosmos.gl `Graph` itself does not expose a native `onDoubleClick` — the double-click is synthesized here from successive `onClick(index)` calls by mapping `index -> pointId` via `indexToIdRef`.
- The prop is only consumed in one place today: `src/components/theseus/chat/parts/SimulationPart.tsx:692-695` wires double-click to `requestExplanation(pointId, 'double_click')`, which POSTs to `/api/v2/theseus/explain_node/` (`src/lib/theseus-api.ts:1394`). This is the chat-inline simulation subgraph, not the main Explorer.
- The main Explorer shell (`src/components/theseus/explorer/ExplorerShell.tsx:273-281`) passes only `onPointClick={setSelectedId}` to `CosmosGraphCanvas` and does NOT pass `onPointDoubleClick`.
- `ExplorerShell.tsx:79-93` attaches its OWN container-level `dblclick` listener, but only to switch the lens to `'atlas'` when the double-click lands on an empty canvas area (it early-returns if `target.tagName !== 'CANVAS'`). This fires in parallel with (not instead of) cosmos.gl's synthesized per-point double-click: the cosmos.gl handler runs off its internal pointer routing, while this listener listens to the DOM `dblclick` event. Both can coexist but they compete for the same physical gesture.
- Other `onClick` wiring in the explorer chrome (`ArtifactExporter`, `ConnectionList`, `DirectiveBanner`, `StructurePanel`, `NeighborhoodSummary`, `GraphLegend`, `AtlasLensSwitcher`, `ObjectInspectorTabs`, `ContextPanel`, `AnswerReadingPanel`) is all normal button UI: not relevant to canvas-node interactions but flagged for collision awareness.

### Existing node-detail surfaces (client side)

Three distinct detail surfaces already exist; none is a dedicated per-node page:

1. `src/components/theseus/explorer/NodeDetailPanel.tsx` (232 lines): right-rail aside, 460px wide. Takes a `NodeDetailData` shape already materialized from `CosmoPoint` (so it only shows whatever the graph payload contains: `id`, `label`, `type`, `description`, `pagerank`, `community`, `confidence`, `degree`). Does NOT fetch — it is a pure presentation of cached canvas data. Has two actions: "Ask about this" dispatches a `theseus:prefill-ask` event; "Open in Notebook" dispatches `theseus:switch-panel` (panel='notebook').
2. `src/components/theseus/explorer/atlas/AtlasNodeDetail.tsx` (232 lines): parchment-glass variant of the same panel, floats top-right (340px). Same `NodeDetailData` shape, same two actions. Currently rendered by `ExplorerShell.tsx:347` when `selectedId` is set.
3. `src/components/commonplace/shared/ObjectDrawer.tsx` (1367 lines): a Vaul slide-in drawer mounted at the `(commonplace)` layout level. Uses `useDrawer()` context, calls `fetchObjectDetail(slug)` or `fetchObjectById(id)` against `/api/v1/notebook/objects/<slug-or-pk>/`, renders four tabs (Overview, Info, Connections, History). This is the only surface that actually hits the Django backend for a single Object and is only reachable from CommonPlace, NOT from the Theseus Explorer.

Related helper `src/components/theseus/explorer/useExplorerSelection.ts` defines `selectedNodeId` + `selectNode()` helpers but is not used by the current ExplorerShell (ExplorerShell tracks selection with a plain `useState<string | null>`).

### Per-node URL routes in Next.js

- No dynamic Object route exists. `find src/app -type d -name "[*]"` yields only `(main)/essays/[slug]`, `(main)/field-notes/[slug]`, `(main)/tags/[tag]`, `(studio)/studio/[type]`, `(studio)/studio/[type]/[slug]`, `api/comments/[id]`, `api/auth/[...nextauth]`. No `/objects/[id]`, `/n/[id]`, `/theseus/[id]`, or similar.
- `/theseus/` has fixed routes: `page.tsx`, `artifacts/`, `ask/`, `code/`, `library/`, `models/`, `plugins/sdk/` — all static paths, no `[id]`.
- `/commonplace/` is a single `page.tsx` that delegates to `ScreenRouter`; detail is exposed only via the drawer overlay.

### Backend endpoints for a single Object

- `apps/notebook/urls.py:21` registers `router.register('objects', views.ObjectViewSet, basename='object')`, exposing `GET /api/v1/notebook/objects/<slug-or-pk>/`.
- `apps/notebook/views/graph.py:81-113` — `ObjectViewSet.get_serializer_class()` returns `ObjectDetailSerializer` for retrieve. `get_object()` (lines 95-106) accepts numeric PK or string slug as the lookup.
- `apps/notebook/serializers.py:492-601` — `ObjectDetailSerializer` fields: `id`, `id_prefixed` (`object:<pk>`), `title`, `display_title`, `slug`, `sha_hash`, `object_type`, `object_type_data`, `body`, `url`, `properties`, OG fields, `status`, `is_pinned`, `is_starred`, `epistemic_role`, `knowledge_content`, `justification_source`, `is_hypothetical`, `notebook`, `project`, `related_essays`, `related_field_notes`, `promoted_source`, `captured_at`, `capture_method`, `created_at`, `updated_at`, `word_count`, `read_time`, `entity_count`, `edge_count`, `connection_count`, `component_count`, `components`, `entities`, `edges` (compact), `recent_nodes`, `connections` (top-20 by strength, via `ObjectConnectionSerializer`), `history` (20 recent timeline nodes), `projects`, `notebooks`, `object_claims` (top-30 with `evidence_links`).
- Companion endpoints that feed a "full" per-node view:
  - `GET /api/v1/notebook/objects/<slug>/lineage/` (`views/provenance.py:24`): 1-hop ancestor/descendant edges with `reason` and `strength`.
  - `GET /api/v1/notebook/objects/<pk>/provenance/` (`views/provenance.py:70`): full provenance trace + narrative (ancestor chain + engine runs that produced the object).
  - `GET /api/v1/notebook/objects/<int>/what-if-remove/` (`urls.py:75`): counterfactual impact analysis.
  - `GET /api/v1/notebook/objects/<pk_a>/path-to/<pk_b>/` (`urls.py:70`): path between two nodes.
  - `/claims/`, `/tensions/`, `/models/` viewsets provide the downstream epistemic objects referenced by the detail payload.

### What "epistemic weight" concretely maps to

Two distinct model properties named `epistemic_weight`:

1. `Object.epistemic_weight` (`apps/notebook/models/graph.py:770-805`): a computed float derived from `knowledge_content` (acquaintance=0.0, propositional=1.0, procedural=1.0, explanatory=1.2, phenomenal=0.8, meta=0.3, axiomatic=1.5) multiplied by `is_hypothetical` (x0.5) and `acceptance_status` (provisional x0.4, contested x0.6, retracted x0.0). Property, not a column.
2. `Edge.epistemic_weight` (`apps/notebook/models/graph.py:1220-1222`): derived from `Edge.acceptance_status` (accepted=1.0, proposed=0.5, contested=0.3, retracted=0.0).

Adjacent stored scalars on `Object` that a detail surface would likely want alongside weight: `pagerank` (db-indexed FloatField, `graph.py:378-388`), `novelty_score` (`graph.py:365-377`), and the computed `edge_count` / `connection_count` / `entity_count` / `component_count` already exposed by `ObjectDetailSerializer`. The `ObjectDetailSerializer` does NOT currently emit `epistemic_weight` (the property is not in the `fields` list).

### What "contributors" concretely maps to

There is no field literally called `contributors` on `Object`. Candidates discovered:

- `Object.promoted_source` (FK, referenced in `ObjectDetailSerializer.fields`): the Source object that was promoted into this Object. Closest thing to an "upstream author / origin".
- `Object.related_essays`, `Object.related_field_notes` (M2M).
- `Object.fiction.author_object_ids` (`apps/notebook/models/fiction.py:51`): JSON list of author Object PKs for fictional-world objects only.
- Timeline `Node.created_by` (`apps/notebook/models/epistemic.py:1131`): a CharField on the Node model (who produced the event). Nodes are append-only and reachable via `obj.timeline_nodes`.
- Engine / provenance chain: `ProcessRecord` rows and `Edge.engine` field record which engine pass produced a given edge (shared_entity, SBERT, BM25, NLI, KGE, GNN, etc.). `trace_provenance()` in `apps/notebook/provenance.py:12` walks this chain and `object_provenance_view` returns it.
- `Claim.evidence_links` point to `Artifact` rows, and artifacts trace back to Sources. So "contributors" in an epistemic sense = Sources that provided claim evidence for this Object.
- No `created_by` user FK on `Object` itself; workspace scoping is by `notebook` / `project`, not by user.

The Object serializer has no single "contributors" key today. Any such view composes from: `promoted_source`, `timeline_nodes[].created_by` (values via `recent_nodes` / `history`), `claims[].evidence_links[].artifact_id -> Source`, and `edges[].engine`.

### What "connections" concretely maps to

- `ObjectDetailSerializer.get_connections` (`serializers.py:547-553`): top-20 edges by strength, both `edges_out` + `edges_in`, serialized via `ObjectConnectionSerializer` (`serializers.py:182-211`). Each row: `connected_object` (id, type, color, title, slug), `explanation` (Edge.reason), `is_manual` (`not edge.is_auto`), `created_at`, `edge_type`.
- `Edge.edge_type` has 27 choices including code edges (imports, calls, inherits, has_member), semantic edges (supports, contradicts, similar_to, cites, etc.).
- `Edge.strength`, `Edge.is_auto`, `Edge.acceptance_status`, `Edge.engine`, and `Edge.reason` (plain English sentence per the notebook CLAUDE.md gotcha: "Every Edge.reason must be a plain English sentence, not a keyword list") are all stored and available.
- MCP exposure: `theseus_find_connections` tool corresponds to this same surface.

### API auth posture

- `apps/api/middleware.py:27-55`: `/api/v1/notebook/` is in `PRIVATE_WORKSPACE_PREFIXES` which is merged into `EXEMPT_PREFIXES`. Comment on line 25: "Workspace/epistemic routes are currently open (no API key required)." So today any Next.js rewrite or external Reflex service can call `/api/v1/notebook/objects/<pk>/` without a Bearer token.
- For CommonPlace traffic from the browser, all calls flow through the Next.js rewrite at `next.config.ts:46-56`: `/api/*` proxied to `${backendUrl}` (defaults to `https://index-api-production-a5f7.up.railway.app`). No CORS is in play because the browser only sees same-origin.

### Existing events bus + panel switching

- `src/lib/theseus/events.ts` exposes `dispatchTheseusEvent(name, detail)` / `onTheseusEvent(name, fn)`.
- Known event names observed: `theseus:switch-panel`, `theseus:prefill-ask`, `explorer:apply-directive`. The "Open in Notebook" button on both `NodeDetailPanel` and `AtlasNodeDetail` fires `theseus:switch-panel` with `{ panel: 'notebook' }` — but this only switches the in-app panel, it does NOT carry the node ID through. There is no existing "open Object in drawer" event reachable from Explorer today (the drawer lives in the `(commonplace)` layout, not the Theseus layout).

### Prior records touching this area

- `docs/records/004-commonplace-v5-dark-chrome.md`: CommonPlace v5 sidebar + drawer system (mentioned in project CLAUDE.md). Does not cover Explorer-to-Object navigation.
- `Index-API/SPEC-OBJECT-DETAIL-500-FIX (1).md`: spec that hardened the Object detail endpoint (500s → resilient serialization). Relevant because any new surface relying on `/api/v1/notebook/objects/<pk>/` inherits that hardening.
- Project CLAUDE.md "Recent Decisions" row: "CommonPlace: Model View v6 — Two-column layout, no drag reorder, polymorphic evidence. White card repetition was poor UI; timeline rows + type-specific rendering is more information-dense." — any new detail view will be measured against this bar.
- No record, plan, or SPEC in `docs/plans/` or `docs/records/` mentions Reflex, a per-node deep-link URL, or a "contributors" view.

## What's missing

1. **No wiring from Explorer double-click to any navigation action.** The canvas supports `onPointDoubleClick` but `ExplorerShell` does not pass a handler. Adding one is the new code path for this feature.
2. **No per-node URL anywhere.** Neither the Next.js Website nor the research_api Django side renders an HTML page for a single Object. Everything is panel / drawer / JSON.
3. **No "epistemic weight" in the serialized Object payload.** The property exists on the model but is not in `ObjectDetailSerializer.fields`. A detail UI that wants to render it requires either a serializer addition or a client-side recomputation from the existing content/status fields.
4. **No "contributors" concept at the API level.** The backend exposes pieces (promoted_source, timeline node authors, claim-evidence-to-source chain, edge engines), but there is no consolidated "contributors for this Object" field. Either the frontend composes it, or a new endpoint / serializer method computes it.
5. **No collision-safe gesture contract.** `ExplorerShell` already hooks DOM `dblclick` on the canvas (lens switch to `'atlas'`) AND the canvas synthesizes its own per-point double-click. Opening a Reflex tab on point-double-click must not also trigger the lens switch. Current code uses `target.tagName !== 'CANVAS'` as the guard, but both listeners do see the same event.
6. **No Reflex service in the stack.** There is no `reflex/`, `rxconfig.py`, or related directory anywhere in the Website or Index-API repos. A new service would need to be stood up, built, and deployed. No prior `reflex` string in `docs/`, `CLAUDE.md`, or `package.json`.
7. **No cross-origin navigation path from Explorer.** The Explorer is at `https://travisgilbert.me/theseus/...` (Vercel). Reflex would deploy separately and need a known hostname plus a URL scheme the Explorer can `window.open(...)` against.
8. **No auth story for a third consumer.** Today only Next.js rewrite + Django Admin consume `/api/v1/notebook/`. A Reflex service calling the same endpoints would be a new consumer. The middleware currently exempts these paths, but that exemption is a workspace-scope decision that may change.

## External (Reflex framework)

Sources:
- [Reflex — Dynamic Routing](https://reflex.dev/docs/pages/dynamic-routing/)
- [Reflex — Self Hosting](https://reflex.dev/docs/hosting/self-hosting/)
- [Reflex — GitHub README (reflex-dev/reflex)](https://github.com/reflex-dev/reflex)
- [Reflex Blog — Self Hosting Reflex with Docker (2024)](https://reflex.dev/blog/2024-10-8-self-hosting-reflex-with-docker/)
- [GeniePy — How to run Reflex apps in production](https://geniepy.com/blog/how-to-run-reflex-apps-in-production/)
- [Reflex Blog — Designing a Pure Python Web Framework (architecture)](https://reflex.dev/blog/2024-03-21-reflex-architecture/)

Findings (no opinions):

- **Language / runtime.** Reflex is Python-only from the developer's perspective. Requires Python 3.10+ per the GitHub README.
- **Compile target.** A Reflex app compiles to two artifacts at runtime: a Next.js frontend (the UI is rendered as React) and a FastAPI backend that holds the Python app state and event handlers. `reflex run` starts both (default ports 3000 for frontend, 8000 for backend).
- **Dynamic routing syntax.** Square-bracket path segments: `/users/[id]` or `/node/[node_id]`. Path parameters are available on the Reflex state (e.g. `rx.State.node_id`). Declared via `app.add_page(component, route="/node/[node_id]")` or equivalent decorator.
- **External REST calls.** Event handlers are plain Python, so calling an external Django REST endpoint is just `httpx.get(...)` or `requests.get(...)` in a handler. No built-in integration required.
- **Deployment shapes.**
  - Docker: the project has a `docker-example/` directory; community patterns run the Reflex frontend behind a static reverse proxy and run the FastAPI backend as a standard uvicorn worker.
  - Static export: `reflex export` produces a static frontend bundle; `reflex run --env prod --backend-only` runs the FastAPI side alone. Frontend can be deployed to Vercel/GitHub Pages/any static host; backend must point at a publicly reachable URL via `api_url` in `rxconfig.py`.
  - Reflex Cloud is a managed hosting option (separate commercial service).
- **Implication for this project's stack.** Railway already hosts Index-API (web + worker) and Vercel hosts the Next.js frontend. Reflex would be a third deployment artifact. Whether it runs as one service (frontend-only, hitting the existing Django API directly) or two (frontend + its own FastAPI backend for internal state) is an unresolved design choice, not a fact about Reflex.

## Constraints

- **No mock data on user-reachable surfaces.** Project CLAUDE.md is explicit: every interactive element must be wired to real state; no `MOCK_*`, `DEMO_*`, or placeholder arrays outside tests / `?mock=1`. Any Reflex page that exposes "epistemic weight / contributors / connections" must be backed by real API data from day one. An empty state is required if data is missing.
- **No `TODO`/`FIXME` branches left in shipped handlers; every button must do something real.** This rules out a "click-through placeholder" Reflex page while the data is still being plumbed.
- **No dashes in any written content.** Applies to Reflex page strings, tooltips, copy, and code comments.
- **Next.js rewrite covers `/api/*` only.** `next.config.ts:46-56` forwards `/api/v2/theseus/:path*` and `/api/:path*` to Railway. A Reflex service hosted on a different origin (e.g. `theseus-node.travisgilbert.me`) does NOT share the Next.js origin and will not benefit from this rewrite: it must either call the Railway URL directly (CORS in play) or be proxied.
- **APIKeyMiddleware.** `/api/v1/notebook/` is currently exempt (open). If that exemption ever flips, the Reflex backend needs its own API key handling. No `INTERNAL_API_KEY` equivalent is currently set up for a Reflex consumer.
- **Deployment platforms in use.** Vercel for Next.js, Railway for Django (web + worker + embedders + Redis + Modal dispatchers). A Reflex addition is a net-new service on one of these platforms (Railway is stack-consistent for Python) or elsewhere.
- **Existing panel-nav model.** The project CLAUDE.md notes a completed "Nav model migration (Spec A) — Screen/view navigation replaces tab system." Adding a true new browser tab (Reflex on a different origin) is a departure from the in-app panel/screen pattern, not an extension of it. No record exists for this pattern.
- **cosmos.gl / luma.gl pinning.** `luma.gl` pinned to `9.2.6` in package.json (Website CLAUDE.md gotcha). Any change to CosmosGraphCanvas that alters the gesture wiring must respect the pinned versions and the mount-race / ResizeObserver gate (documented at `CosmosGraphCanvas.tsx` around construction).
- **Existing double-click gesture in ExplorerShell.** The DOM-level `dblclick -> lens=atlas` handler (`ExplorerShell.tsx:79-93`) fires on canvas empty space. cosmos.gl fires its own per-point double-click. A new per-point double-click handler must not race the lens switch (today the lens listener early-returns when `target.tagName !== 'CANVAS'` but the canvas is a CANVAS tag, so there is latent overlap to resolve).
- **Node ID shape.** `CosmoPoint.id` is a string but the backend uses integer PKs + slugs. `ObjectConnectionSerializer` emits `id: 'object:<pk>'` prefixed form. Any URL scheme must pick one and be consistent. Django's `ObjectViewSet.get_object()` already accepts both.
- **The graph is a mix of corpus + personal + code objects** (per `useGraphData.ts` scope). Any node-detail URL has to work for code objects too (`source_system='codebase'`), which have sparse Components and no Claims in the usual sense.
- **Multi-tenant pitfalls.** `_scoped_object_queryset` in `views/_shared.py` applies workspace scoping. A Reflex page hitting the API without the same scope headers may see different data than the Explorer (which uses internal-key scope).

## Open design questions

1. **Destination: new browser tab vs in-app panel.** The ask is "opens a Reflex site/tab". Is the target a hard `window.open('https://...','_blank')` to a separately-deployed origin, or an iframe embed inside the Explorer, or a same-origin `/theseus/n/[id]` route that happens to be generated by Reflex? Each has different deployment + auth consequences.
2. **Relationship to existing `ObjectDrawer`.** The CommonPlace drawer already fetches and renders a full Object detail (Overview/Info/Connections/History). Is the Reflex page a replacement, a peer (served to a different audience), or a deeper view that the drawer links out to? If it replaces, what happens to the 1367-line `ObjectDrawer`?
3. **URL scheme.** `/n/[pk]`? `/object/[slug]`? `/theseus/node/[id]`? What identifier is canonical (PK vs slug)? Does the URL survive renames? Prior art: `ObjectViewSet.get_object()` accepts both.
4. **Why Reflex specifically?** There is no prior Reflex usage in either repo; Next.js is the shipped frontend framework and Django Studio (django-cotton + HTMX) is already the Python render layer. The choice of Reflex is external to the current stack and its justification affects how much infra to build.
5. **"Epistemic weight" display form.** Is it the computed `Object.epistemic_weight` (float), the decomposition (knowledge_content + acceptance_status + is_hypothetical), pagerank, or a fused score? All exist; none is currently shown to end users except pagerank in `NodeDetailPanel`.
6. **"Contributors" definition.** Which of {promoted_source, timeline node authors, claim-evidence Sources, Edge.engine values} counts? Is it a single composed list, or tabbed categories? Does it include the engines that discovered edges (spaCy, SBERT, BM25, NLI, KGE, GNN) as "automated contributors"?
7. **Connections breadth.** Should the Reflex page show the same top-20-by-strength that `ObjectDetailSerializer.get_connections` returns, or all N edges with pagination, or a mini cosmos.gl graph for the 1-hop neighborhood?
8. **Gesture conflict resolution.** Does this feature require reclaiming the `dblclick` on the canvas from the `lens=atlas` switch, or can both coexist (node-double-click opens Reflex, empty-space-double-click still switches lens)?
9. **Auth for the Reflex consumer.** If `/api/v1/notebook/` exemption is dropped later, what credential does the Reflex service present? A new API key? Shared with Next.js? Per-user session token forwarded from the browser?
10. **Operator story for a Reflex service on Railway.** Dockerfile? `railway.reflex.toml`? What env vars does it need? How does the build pipeline know where to find the Django API (internal Railway URL vs public hostname)?
11. **Mount race + ResizeObserver.** The existing canvas has a documented mount-race gate around `ResizeObserver`. Does opening a new tab / embedding Reflex have any effect on the Explorer's canvas lifecycle, or is it purely additive?
12. **Simulation-chart double-click collision.** `SimulationPart` already uses double-click to trigger `/api/v2/theseus/explain_node/`. The ask is about the main Explorer canvas, not SimulationPart: does the new handler apply there too, or only to `ExplorerShell`? If both, the explain-node UX and the Reflex-tab UX need to be reconciled.
