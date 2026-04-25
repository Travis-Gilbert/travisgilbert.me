# Theseus Reflex Node Detail: Design Doc

_Slug: `theseus-reflex-node-detail`. Written 2026-04-24 from `research-brief.md`._

## 1. User-facing behavior

When a user double-clicks any node on the cosmos.gl canvas in `ExplorerShell` (route `(commonplace)/theseus/explorer` on travisgilbert.me), a new browser tab opens at `https://node.travisgilbert.me/n/<pk>`. The tab shows a dedicated node-detail page rendered by the Reflex service. The originating Explorer tab is unchanged: no lens switch, no focus change, no graph re-layout.

Behavior specifics:

- `window.open(url, '_blank', 'noopener,noreferrer')` is the open call. Browsers focus the new tab by default; the Explorer tab remains mounted and the cosmos.gl simulation continues uninterrupted.
- The Reflex page header includes a "Back to Explorer" link pointing at `https://travisgilbert.me/theseus/explorer?focus=<pk>`. When clicked, ExplorerShell reads `?focus=<pk>` from `useSearchParams`, resolves the node in its current graph data, and calls `applySceneDirective` to focus that node and zoom via `GraphAdapter.zoomToNode`.
- Mobile (touch graph): cosmos.gl does not emit double-tap as `onPointDoubleClick`. v1 ships desktop-only on the gesture. The Reflex page itself is fully responsive and reachable via direct URL.

### Gesture-conflict resolution

The existing DOM-level `dblclick` handler on the canvas wrapper (`ExplorerShell.tsx:79-93`) toggles the lens to `'atlas'`. The new per-node double-click is dispatched by cosmos.gl's synthesized `onPointDoubleClick` callback, which fires *before* the DOM `dblclick` bubbles up.

Resolution: in `ExplorerShell.tsx`, the new `onPointDoubleClick` handler calls `event.stopPropagation()` (and short-circuits the lens-toggle path via a ref-flag if the event API does not allow stopping bubbling cleanly). The DOM-level lens-switch handler then only fires when the double-click lands on empty canvas space. Empty-canvas double-click = lens toggle. On-node double-click = open Reflex detail.

## 2. The Reflex page surface

Single full-width column with five sections. All data comes from one HTTP call to `GET /api/v1/notebook/objects/<pk>/` plus optional companion calls noted in section 4.

### Header

- Title (`Object.title` or `display_title`)
- Type chip (`Object.object_type` colored per the CommonPlace section color language: source=Teal, hunch=Gold, quote=Terracotta, concept=Green, note=neutral)
- Body excerpt: first 280 chars of `Object.body`, ellipsized
- Metadata strip: `created_at` (relative: "3 days ago"), `updated_at`, `acceptance_status`, `is_hypothetical` rendered as a "Hypothetical" badge if true
- "Back to Explorer" link to `/theseus/explorer?focus=<pk>` on the main site

### Section A: Epistemic weight

A single composed numeric value plus a four-row decomposition table.

The composed value is `Object.epistemic_weight` (a model property at `apps/notebook/models/graph.py:770-805`, derived from `knowledge_content`, `acceptance_status`, `is_hypothetical`). Day-1 the Reflex page reads the four constituent fields from the existing serializer payload and computes `epistemic_weight` client-side using the same formula as the model property. A follow-up backend task adds `epistemic_weight` directly to `ObjectDetailSerializer` so the computation is server-authoritative.

Visual: large numeric (Vollkorn, ~48pt) with a horizontal gauge running 0.0 → 1.5 (the formula's empirical range). Below, a four-row decomposition table:

| Component | Source field | Value | Contribution |
|-----------|--------------|-------|--------------|
| knowledge_content | `Object.knowledge_content` | mapping (acquaintance=0.0 ... axiomatic=1.5) | base |
| acceptance_status | `Object.acceptance_status` | mapping (accepted=1.0, provisional=0.4, contested=0.6, retracted=0.0) | multiplier |
| is_hypothetical | `Object.is_hypothetical` | bool | x0.5 if true |
| pagerank | `Object.pagerank` | float | shown alongside (not part of the formula) |

Footnote: "Computed live from engine state at <updated_at>."

### Section B: Contributors

Three subgroups, each rendered as a labeled section with a list of name/link pairs:

- **Promoted source** (singular, if `Object.promoted_source` is non-null): renders `promoted_source.title` plus URL.
- **Timeline contributors**: deduplicated set of `Object.recent_nodes[].created_by` values (CharField on Node, `apps/notebook/models/epistemic.py:1131`). Each shown with a count.
- **Claim evidence sources**: distinct sources reached via `Object.object_claims[].evidence_links[]` (already in the serializer payload). Each rendered as title + favicon if URL is set.
- **Engines** (collapsed by default): distinct `Edge.engine` values across the connections list. Pill chips, only rendered if at least one engine ran.

Day-1 ships with client-side composition. A follow-up backend task adds a composed `contributors` field to `ObjectDetailSerializer` once the composition stabilizes.

### Section C: Connections

Top 12 connections by edge strength, consumed as-is from `ObjectDetailSerializer.get_connections` (which already returns top-20 by strength via `ObjectConnectionSerializer`). Two-column visual layout.

Each row shows:

- Edge type badge (`edge_type` value, colored per existing palette)
- Other-side title, linked to `https://node.travisgilbert.me/n/<other_pk>` (recursive Reflex navigation)
- Edge strength as a tiny gauge bar
- `edge.reason` text (the plain-English sentence; truncated to 140 chars, expand-on-hover)
- `edge.engine` pill (if exposed by the connection serializer; otherwise via a future backend addition)

A "View all N connections" expander reveals up to 50 more. v1 hides the expander unless the backend supports a `?connections=full` query param; the marker is wired but the expander stays disabled until the param ships.

### Section D: Provenance footer

Three small links, right-aligned:

- "Open in Explorer" → `/theseus/explorer?focus=<pk>` (same as header)
- "View raw JSON" → opens `/api/v1/notebook/objects/<pk>/` in a new tab
- "Permalink" → copies `https://node.travisgilbert.me/n/<pk>` to clipboard

### Empty / error states

- `/n/<pk>` for a missing pk: full chrome with "Object not found" centered, plus back-to-Explorer link. No mock data.
- `/n/<pk>` when the API is unreachable: full chrome with "Could not reach the engine. Try again in a moment." plus a retry button that re-runs the loader.

## 3. URL scheme

Chosen: `/n/<pk>` where `<pk>` is the integer Object primary key.

Rationale:

- `ObjectViewSet.get_object()` accepts numeric PK by default (`apps/notebook/views/graph.py:95-106`). No backend change.
- The cosmos.gl point IDs already encode `Object.pk` (per `useGraphData.mapNode`), so the click-to-URL composition is a one-liner: `\`${BASE}/n/${pointId}\``.
- PKs are stable; titles change.
- Short URL, friendly to share.

Reflex route definition:

```python
@rx.page(route="/n/[pk]", on_load=NodeState.load)
def node_page() -> rx.Component:
    ...
```

## 4. Data path

### Day-1 calls (Reflex backend → Index-API)

Single primary call:

- `GET ${RESEARCH_API_BASE_URL}/api/v1/notebook/objects/<pk>/` returns `ObjectDetailSerializer` JSON.

This payload already includes `id`, `title`, `body`, `object_type`, `acceptance_status`, `is_hypothetical`, `knowledge_content`, `pagerank`, `promoted_source`, `recent_nodes`, `object_claims` (with `evidence_links`), and `connections` (top-20 by strength shaped by `get_connections`). Everything section A/B/C needs is present.

Optional companion call (only if `Edge.engine` is not exposed by the existing connection shape):

- `GET ${RESEARCH_API_BASE_URL}/api/v1/notebook/objects/<pk>/lineage/` returns 1-hop ancestor/descendant edges with `reason` and `strength`.

### Backend changes flagged (deferred, not blocking v1)

- Add `epistemic_weight` to `ObjectDetailSerializer`: expose the existing model property as a serializer field. One-line change. Safe because it is a property, not a column.
- Add a composed `contributors` `SerializerMethodField` returning `{promoted_source, timeline_users, claim_sources, engines}` so Reflex no longer composes four sources client-side.
- Add `?connections=full` query param on the detail endpoint to bump the connections cap from default-20 to default-50. Minor DRF param wiring.

All three are deferrable. Day-1 Reflex ships against the current serializer.

### Caching

Reflex backend uses `httpx.AsyncClient` with a 30-second per-PK TTL cache (in-memory, per Reflex worker). Engine state changes slowly (overnight reorganize/communities); 30 seconds absorbs the burst of clicks when a user navigates connection→connection→connection.

## 5. Click → URL contract

### New file: `src/lib/theseus/nodeDetailUrl.ts`

```ts
const BASE =
  process.env.NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL ?? 'https://node.travisgilbert.me';

export function nodeDetailUrl(pk: string | number): string {
  return `${BASE}/n/${pk}`;
}

export function openNodeDetail(pk: string | number): void {
  if (typeof window === 'undefined') return;
  window.open(nodeDetailUrl(pk), '_blank', 'noopener,noreferrer');
}
```

### ExplorerShell wiring

`ExplorerShell.tsx` currently passes only `onPointClick={setSelectedId}` to `<CosmosGraphCanvas>`. New wiring adds:

```tsx
import { openNodeDetail } from '@/lib/theseus/nodeDetailUrl';

<CosmosGraphCanvas
  // ... existing props
  onPointClick={setSelectedId}
  onPointDoubleClick={(pointId, event) => {
    event?.stopPropagation();
    openNodeDetail(pointId);
  }}
/>
```

Inside the existing DOM `dblclick` listener that toggles to atlas (`ExplorerShell.tsx:79-93`), guard against firing when a node was just opened. Pattern: a ref flag `nodeDoubleClickedRef` set true by `onPointDoubleClick` and cleared on a `setTimeout(0)` after the DOM `dblclick` would have fired. The lens-toggle handler early-returns if the ref is set.

### Env vars (Vercel, both preview and production)

- `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL`: `https://node.travisgilbert.me` for production. `http://localhost:3001` for local dev.

## 6. Reflex service shape

### Repository layout

New top-level directory in the Index-API repo: `reflex_node_detail/`.

```
reflex_node_detail/
  rxconfig.py
  requirements.txt
  Dockerfile.reflex
  reflex_node_detail/
    __init__.py
    reflex_node_detail.py        # app entry, registers pages
    api_client.py                # httpx wrapper for Index-API calls
    pages/
      __init__.py
      home.py                    # / : honest landing
      node.py                    # /n/<pk> : main detail page
      not_found.py               # /404 : honest empty state
    state/
      __init__.py
      node_state.py              # NodeState: detail dict + loading + error
    components/
      __init__.py
      header.py
      epistemic_weight.py
      contributors.py
      connections.py
      provenance.py
  tests/
    test_api_client.py
    test_epistemic_weight.py
```

### Mode

Single-service mode: Reflex runs both frontend (compiled Next.js bundle that Reflex generates from Python components) and backend (the FastAPI under the hood) as one process via `reflex run --env prod`. One Railway service, one container, one public URL.

Justification: the page is read-only, no auth, no compute-heavy work. Splitting frontend/backend would only matter for independent scaling at much higher traffic.

### Smoke surfaces

- `/` (home): single paragraph saying "Theseus Node Detail. Open a node from the Explorer." plus a link to `https://travisgilbert.me/theseus/explorer`. No mock data, no fake search box, no example IDs.
- `/n/<pk>` for a non-existent pk: full chrome plus centered "Object not found" empty state.
- `/n/<pk>` on API failure: full chrome plus centered error banner with retry button.

## 7. Auth

`/api/v1/notebook/` is currently exempt from `APIKeyMiddleware` (see `apps/api/middleware.py:27-55`, `PRIVATE_WORKSPACE_PREFIXES`). Day-1 Reflex calls `https://index-api-production-a5f7.up.railway.app/api/v1/notebook/objects/<pk>/` over HTTPS with no auth header.

Future-proofing: `api_client.py` reads `INTERNAL_API_KEY` from env. If set, every request adds `Authorization: Bearer <key>`. If unset, requests go unauthenticated. One-line cost, one operator action when the exemption flips.

```python
import os, httpx

BASE = os.environ["RESEARCH_API_BASE_URL"]
KEY = os.environ.get("INTERNAL_API_KEY")

def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {KEY}"} if KEY else {}

async def get_object(pk: int) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{BASE}/api/v1/notebook/objects/{pk}/", headers=_headers())
        r.raise_for_status()
        return r.json()
```

## 8. Operator story

### Railway service

New service: `reflex-node-detail`, deployed from the Index-API repo. Railway picks `Dockerfile.reflex` via `railway.reflex.toml`:

```toml
[build]
builder = "dockerfile"
dockerfilePath = "reflex_node_detail/Dockerfile.reflex"

[deploy]
startCommand = "cd reflex_node_detail && reflex run --env prod --backend-port $PORT --frontend-port $PORT"
restartPolicyType = "always"
healthcheckPath = "/"
```

### Env vars (Reflex Railway service)

- `RESEARCH_API_BASE_URL=https://index-api-production-a5f7.up.railway.app`
- `INTERNAL_API_KEY=` (empty for now; set when `/api/v1/notebook/` exemption flips)
- `REFLEX_API_URL=https://node.travisgilbert.me` (Reflex requires this so its compiled frontend knows where its own backend lives)
- `REFLEX_DB_URL=sqlite:///reflex.db` (Reflex's internal session table; SQLite-on-disk is sufficient)

### Public hostname

`node.travisgilbert.me` via Railway custom domain. CNAME from the existing DNS provider to the Railway-issued domain. Cert auto-provisioned.

Fallback if custom-domain provisioning is friction: temporarily proxy via the Next.js rewrite at `https://travisgilbert.me/theseus/node/*` to the Railway Reflex URL, set `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL=https://travisgilbert.me/theseus/node`, adjust `nodeDetailUrl()`. Not the v1 plan but a known fallback.

### Smoke verification post-deploy

1. `curl https://node.travisgilbert.me/` returns 200 with home page HTML.
2. `curl https://node.travisgilbert.me/n/1` returns 200 (assuming pk=1 exists; otherwise 200 with not-found surface).
3. From `https://travisgilbert.me/theseus/explorer`, double-click any node, confirm new tab opens at `https://node.travisgilbert.me/n/<pk>` and renders the three sections with real data.
4. Confirm the Explorer tab's lens is unchanged after the double-click (no atlas flip).
5. Confirm an empty-canvas double-click still toggles the atlas lens.
6. Confirm a connection link on the Reflex page navigates to a different `/n/<other_pk>` URL with real data.

## 9. Backwards-compatibility

All existing detail surfaces continue to exist unchanged:

- `NodeDetailPanel` (right-side inline panel inside CommonPlace, `src/components/theseus/explorer/NodeDetailPanel.tsx`): unchanged. Lightweight inline preview triggered by single-click.
- `AtlasNodeDetail` (atlas-lens overlay, `src/components/theseus/explorer/atlas/AtlasNodeDetail.tsx`): unchanged. Lightweight in-canvas preview tied to the atlas lens.
- `ObjectDrawer` (slide-in drawer, `src/components/commonplace/shared/ObjectDrawer.tsx`): unchanged. Lightweight preview for non-Explorer routes.

The Reflex page is the heavyweight peer for double-click. No existing component is modified. Frontend code change is limited to ExplorerShell wiring and the new `nodeDetailUrl.ts` helper.

## 10. Out of scope

- Killing or replacing `NodeDetailPanel`, `AtlasNodeDetail`, or `ObjectDrawer`.
- Server-side rendering for SEO.
- Comments, threaded discussions, social actions.
- Editing the Object from the Reflex page (read-only surface).
- Mobile double-click gesture.
- Pre-rendered OpenGraph share image route.
- Real-time updates (no WebSocket subscription to engine changes).
- Reclaiming the empty-canvas double-click for any new behavior.

## Alternatives considered

- Reflex co-deployed inside Index-API as sibling ASGI: rejected for release-cadence coupling.
- Slug-based URL (`/object/<slug>`): rejected for migration cost without user-stated need.
- Vercel-proxied subpath (`/theseus/node/<id>`): held as fallback.
- Pre-rendered OG share image route: deferred.
- Skip Reflex entirely, use a Next.js route: out of bounds (user explicitly named Reflex).
- Reflex imports Django models directly: rejected for boundary discipline (parallels the `modal_app/` rule).
