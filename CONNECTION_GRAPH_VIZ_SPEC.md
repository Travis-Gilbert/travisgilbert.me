# Connection Graph Visualization Spec

> For the travisgilbert.me Next.js frontend.
> Upgrades the existing ConnectionMap and ConnectionGraphPopup components
> to consume live data from the research API's connection engine.

## What Already Exists

Two components use the same two-layer rendering pattern:

**ConnectionMap.tsx** (full-page, used on the connections route)
- Canvas layer (behind): rough.js hand-drawn edges via `rough.canvas()`
- SVG layer (front): React-rendered nodes with hover, click, keyboard nav
- D3 force simulation runs synchronously (300 ticks, instant layout)
- ResizeObserver for responsive width
- Node size scales by `connectionCount`
- Node color by content type (terracotta for essays, teal for field notes, gold for projects, green for shelf)
- Hover dims unconnected nodes and brightens connected edges
- Click navigates to content page

**ConnectionGraphPopup.tsx** (modal, opens from essay pages)
- Same Canvas/SVG pattern at fixed 508x320
- Center node is the current essay (pinned with fx/fy)
- Orbiting nodes are connections
- Portal-based modal with backdrop blur, Escape to close

Both currently consume data from the **build-time** TypeScript `connectionEngine.ts`.
That engine uses frontmatter metadata only (explicit `related` slugs, `connectedTo` fields).

## What Changes

### Data source: build-time to API

The research API now returns richer connection data with four signals and scores.
Replace the build-time computation with a fetch to the API.

**Old data shape** (from connectionEngine.ts):
```typescript
interface Connection {
  id: string;
  type: 'essay' | 'field-note' | 'shelf';
  slug: string;
  title: string;
  summary?: string;
  color: string;
  weight: 'heavy' | 'medium' | 'light';
  date: string;
}
```

**New data shape** (from GET /api/v1/connections/<slug>/):
```json
{
  "slug": "housing-crisis",
  "contentType": "essay",
  "connections": [
    {
      "content_type": "field_note",
      "content_slug": "zoning-observation",
      "content_title": "Zoning Board Meeting Notes",
      "score": 0.73,
      "signals": {
        "shared_sources": { "score": 0.8, "detail": "shares 3 sources" },
        "shared_tags": { "score": 0.5, "detail": "shares tags: housing, zoning" },
        "shared_threads": null,
        "semantic": { "score": 0.72, "detail": "semantic similarity: 0.72" }
      },
      "explanation": "shares 3 sources; shares tags: housing, zoning"
    }
  ]
}
```

**New full graph** (from GET /api/v1/connections/graph/):
```json
{
  "nodes": [
    { "id": "essay:housing-crisis", "type": "essay", "slug": "housing-crisis", "label": "The Housing Crisis" }
  ],
  "edges": [
    {
      "source": "essay:housing-crisis",
      "target": "field_note:zoning-observation",
      "weight": 0.73,
      "explanation": "shares 3 sources; shares tags: housing, zoning",
      "signals": { ... }
    }
  ]
}
```

### Data fetching pattern

For the **full-page ConnectionMap** (connections route):
- Fetch `/api/v1/connections/graph/?semantic=false` at page load (server component or useEffect)
- The `?semantic=false` flag keeps response times fast for the full graph
- Transform the API response into the D3 force simulation input format

For the **popup ConnectionGraphPopup** (individual essay):
- Fetch `/api/v1/connections/<slug>/` when the popup opens
- This endpoint includes semantic similarity and is scoped to one content piece, so it's fast

**Transformation function** (shared utility):
```typescript
// src/lib/graphTransform.ts

interface APINode {
  id: string;
  type: string;
  slug: string;
  label: string;
}

interface APIEdge {
  source: string;
  target: string;
  weight: number;
  explanation: string;
  signals: Record<string, { score: number; detail: string } | null>;
}

interface GraphNode {
  id: string;
  slug: string;
  title: string;
  type: 'essay' | 'field-note' | 'project' | 'shelf';
  connectionCount: number;
  href: string;
  score?: number;           // NEW: connection strength (for popup)
  explanation?: string;     // NEW: human-readable reason
  activeSignals: string[];  // NEW: which signals fired
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  strokeWidth: number;
  weight: number;           // NEW: 0 to 1
  explanation: string;      // NEW
  signalCount: number;      // NEW: how many signals contributed
}
```

The transform maps `content_type: "field_note"` to `type: "field-note"` (hyphenated, matching existing constants).
It maps `weight` (0 to 1 float) to `strokeWidth` (0.5 to 3.0 range).
It counts connections per node for the `connectionCount` used in node sizing.

## Visual Upgrades

### 1. Edge thickness encodes connection strength

Currently all edges have the same strokeWidth or a fixed per-type width.
With the API data, edge thickness reflects the combined connection score (0 to 1).

```
strokeWidth = 0.5 + (weight * 2.5)
```

A connection scoring 0.9 gets a thick, confident line.
A connection scoring 0.2 gets a thin, tentative line.

In the rough.js rendering, also vary the `roughness` parameter:
- Strong connections (score > 0.7): roughness 0.8, bowing 0.5 (cleaner line, more "certain")
- Moderate connections (0.4 to 0.7): roughness 1.5, bowing 1.5 (default hand-drawn feel)
- Weak connections (score < 0.4): roughness 2.5, bowing 3.0 (sketchy, uncertain line)

This creates a visual metaphor: strong connections look drawn with confidence,
weak connections look like they were sketched tentatively. The roughness IS the data.

### 2. Edge color encodes signal type

Currently edges are a single warm gray.
With multi-signal data, color the edge by its dominant signal:

```
shared_sources  -> terracotta (#B45A2D) at 40% opacity
shared_tags     -> gold (#C49A4A) at 40% opacity
shared_threads  -> teal (#2D5F6B) at 40% opacity
semantic        -> muted purple (#6B5A7A) at 40% opacity
```

When multiple signals fire, use the color of the signal with the highest individual score.

On hover (when an edge's nodes are highlighted), increase opacity to 70%.

### 3. Node size encodes centrality

Currently node radius scales by `connectionCount`.
Add an optional mode where radius scales by the *sum of connection scores* instead.
A node connected to 3 items with scores 0.9, 0.8, 0.7 (sum 2.4) would be larger
than a node connected to 5 items with scores 0.2, 0.2, 0.1, 0.1, 0.1 (sum 0.7).

This rewards quality of connections over quantity.

```
totalScore = connections.reduce((sum, c) => sum + c.weight, 0);
radius = 8 + (totalScore / maxTotalScore) * 16;
```

### 4. Hover tooltip shows explanation

Currently hovering a node shows only the title.
With API data, show the connection explanation on hover.

Implementation: position a floating div (not SVG title, which is ugly) near the cursor.
Use the same styling as the existing StickyNote component:
- Warm paper background
- Mono font for the explanation text
- Signal indicators (colored dots) showing which signals fired

```
Example tooltip:

  FIELD NOTE
  Zoning Board Meeting Notes

  shares 3 sources
  shares tags: housing, zoning
  semantic similarity: 0.72

  [source dot] [tag dot] [semantic dot]
```

### 5. Signal filter controls

Add a row of toggle buttons above the graph (same style as ShelfFilter):

```
  [ALL]  [SOURCES]  [TAGS]  [THREADS]  [SEMANTIC]
```

Clicking a signal type filters edges to only show connections where that signal
is present. This lets a viewer ask: "show me only connections based on shared
sources" or "show me only the semantic connections."

When a filter is active, edges without that signal fade to near-invisible (opacity 0.04).
Nodes that become disconnected under the filter shrink to half size and move to
the radial ring (the existing forceRadial behavior for disconnected nodes).

### 6. Cluster overlay (uses /api/v1/clusters/)

Optional mode: fetch `/api/v1/clusters/` and draw semi-transparent convex hulls
around cluster members. Each hull uses the color of the cluster's dominant tag type.

Use D3's `d3.polygonHull()` on the positioned cluster member nodes, then render
the hull as a rough.js polygon on the canvas layer (behind edges, behind nodes).

```
rc.polygon(hullPoints, {
  fill: clusterColor,
  fillStyle: 'cross-hatch',
  fillWeight: 0.3,
  hachureGap: 8,
  roughness: 2,
  stroke: clusterColor,
  strokeWidth: 0.5,
});
```

The cross-hatch fill with wide gap creates a subtle, hand-drawn region indicator
without obscuring the nodes and edges inside it.

### 7. Animated transitions for data changes

When the user toggles a signal filter, animate the graph transition:
- Edges that are being hidden: fade opacity to 0 over 200ms, then remove
- Edges that are being shown: add with opacity 0, fade to target opacity over 200ms
- Nodes that lose all visible connections: animate to radial ring position over 300ms
- Nodes that regain connections: animate back from radial ring over 300ms

For the rough.js canvas layer, this requires redrawing on each animation frame.
Use `requestAnimationFrame` with interpolated positions during the transition.
The synchronous force simulation approach won't work here because the layout
is already computed; only positions are changing.

## Component Architecture

### New files

```
src/lib/graphTransform.ts           Transforms API responses to D3 node/edge format
src/lib/useConnectionGraph.ts       Custom hook: fetches + transforms graph data
src/components/ConnectionTooltip.tsx Hover tooltip with signal breakdown
src/components/SignalFilter.tsx      Toggle buttons for signal filtering
```

### Modified files

```
src/components/ConnectionMap.tsx         Wire to API via useConnectionGraph hook
src/components/ConnectionGraphPopup.tsx  Wire to API, add tooltip
```

### Data flow

```
/connections page (server component)
  -> fetch /api/v1/connections/graph/?semantic=false (server-side)
  -> pass nodes/edges as props to ConnectionMap (client component)
  -> ConnectionMap renders with existing two-layer pattern + new visual features

Essay page (ConnectionGraphPopup)
  -> user clicks "connection map" button
  -> popup mounts, calls useConnectionGraph(slug)
  -> hook fetches /api/v1/connections/<slug>/ (client-side)
  -> transforms response, passes to ConnectionGraphPopup
  -> popup renders with center node + orbiting connections + tooltips
```

### Server-side fetch for the full-page graph

The connections route should fetch the graph data as a server component:

```typescript
// src/app/(main)/connections/page.tsx

const RESEARCH_URL = process.env.NEXT_PUBLIC_RESEARCH_URL;

async function getConnectionGraph() {
  const res = await fetch(`${RESEARCH_URL}/api/v1/connections/graph/?semantic=false`, {
    next: { revalidate: 300 },  // ISR: revalidate every 5 minutes
  });
  if (!res.ok) return { nodes: [], edges: [] };
  return res.json();
}

export default async function ConnectionsPage() {
  const rawGraph = await getConnectionGraph();
  const { nodes, edges } = transformGraphData(rawGraph);
  return <ConnectionMap nodes={nodes} edges={edges} />;
}
```

## Implementation Order

1. **graphTransform.ts**: Write the transformation utility. Test it with hardcoded API response data.
2. **useConnectionGraph.ts**: Hook that fetches and transforms. Handles loading/error states.
3. **Upgrade ConnectionMap.tsx**: Replace build-time data with API data. Add edge thickness/roughness encoding.
4. **Upgrade ConnectionGraphPopup.tsx**: Same data source switch. Add explanation tooltip.
5. **ConnectionTooltip.tsx**: Build the hover tooltip component.
6. **SignalFilter.tsx**: Build the filter toggle buttons.
7. **Wire signal filtering into ConnectionMap**: Add filter state, edge visibility logic, animation.
8. **Cluster overlay**: Fetch clusters, compute convex hulls, render on canvas.

Steps 1 through 4 are the minimum viable upgrade.
Steps 5 through 6 add polish.
Steps 7 through 8 are advanced features.

## Design Tokens (existing, reuse these)

```
Colors:
  --color-terracotta: #B45A2D (essays)
  --color-teal: #2D5F6B (field notes)
  --color-gold: #C49A4A (projects/shelf)
  --color-paper: warm parchment background
  --color-ink: primary text
  --color-ink-secondary: muted text
  --color-ink-muted: very muted text
  --color-border: primary border
  --color-border-light: subtle border

Fonts:
  --font-mono: Courier Prime (monospace, used for labels)
  --font-metadata: metadata/small text
  --font-annotation: annotation text (used in popup headers)

Rough.js defaults (from existing components):
  roughness: 1.3 to 1.5
  bowing: 0.9 to 2.0
  strokeWidth: 1.0 to 1.5
```

## New color (for semantic signal)

Add a muted purple for the semantic connection signal:
```
semantic purple: #6B5A7A
```

This sits between the warm terracotta and cool teal in the palette,
appropriate for a "meaning-based" connection that is neither structural
(like shared sources) nor topical (like shared tags) but conceptual.

## Performance Notes

- The full connection graph at `/connections/graph/?semantic=false` skips embedding computation, keeping response times under 200ms for graphs with fewer than 100 nodes.
- Server-side fetch with ISR (5-minute revalidate) means the graph data is cached and doesn't block page load.
- The synchronous force simulation (300 ticks) runs in ~50ms for 50 nodes. No layout jank.
- Rough.js canvas drawing is the most expensive operation. For graphs over 100 edges, consider reducing roughness to 0.8 and bowing to 0.5 to speed up rendering.
- The signal filter animation requires canvas redraws at 60fps during transitions. Limit animation to 300ms max.
