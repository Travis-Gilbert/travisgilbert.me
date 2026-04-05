# Stippling Engine: Universal Dot-to-Shape Rendering

**Date:** 2026-04-05
**Status:** Ready for implementation
**Scope:** New rendering pipeline that converts any visualization into dot target positions via weighted Voronoi stippling

## The Idea

The 30K datadot grid is not a graph renderer. It is a universal display medium. The dots are pixels. Any answer Theseus produces (comparison, timeline, argument tree, portrait, bar chart) should construct itself as a recognizable shape formed by dots flowing from galaxy positions into stippled positions.

The missing piece is a **stippling engine**: render the "ideal" answer visualization as a hidden offscreen canvas, then use Lloyd's relaxation over Voronoi cells (d3-delaunay) to convert that image into weighted dot positions. The construction sequence IS the convergence: dots flowing from chaos into recognizable form.

## Architecture

```
Query arrives
  -> vizPlanner classifies answer type (USE + KNN, already built)
  -> Backend generates answer + SceneDirector produces directive
  -> StipplingDirector (TF.js) decides:
       - How many dots to recruit (salience + viewport size)
       - Which galaxy dots to recruit (theatricality-controlled distance)
       - Reveal order (phase template from answer type, 8x8 or 16x16 grid)
  -> Offscreen renderer produces TWO canvases:
       - Visual canvas (high-contrast shapes for stippling placement)
       - ID canvas (flat colors encoding node/section IDs)
  -> StipplingEngine runs Lloyd's relaxation:
       - Seed via rejection sampling weighted by pixel brightness
       - d3.Delaunay.from(points) for Voronoi tessellation
       - Iterate: compute brightness-weighted centroids, move points
       - 3-5 iterations for recognizable shape (construction phase)
       - Remaining iterations as settling animation (crystallize phase)
  -> Each dot inherits semantic ID from the ID canvas at its final position
  -> Dots animate from galaxy positions to stippled positions
  -> Labels and interactive affordances appear at crystallization
```

## Module Structure

```
src/lib/galaxy/
  StipplingEngine.ts       <- Lloyd's relaxation, dual-canvas input
  StipplingDirector.ts     <- TF.js decisions (recruitment, reveal, selection)
  renderers/
    types.ts               <- OffscreenRenderResult interface
    ComparisonRenderer.ts  <- Two clusters + bridge zone
    TimelineRenderer.ts    <- Horizontal axis with state nodes
    HierarchyRenderer.ts   <- Top-down or radial tree
    ExplanationRenderer.ts <- Hub-and-spoke, central concept
    ArgumentRenderer.ts    <- Directed graph, conclusion top, evidence bottom
    DataVizRenderer.ts     <- Vega-Lite JSON -> offscreen canvas via vega-embed
```

## StipplingEngine.ts

**Input:**
- `visual: OffscreenCanvas` (high-contrast shapes, hard edges, flat fills)
- `idMap: OffscreenCanvas` (flat colors, one per semantic region)
- `idLegend: Map<string, { nodeId: string; role?: string }>` (hex color -> semantic ID)
- `dotCount: number` (how many dots to place, from StipplingDirector)
- `options: { iterations?: number; phaseTemplate?: number[][] }`

**Output:**
```ts
interface StippleResult {
  targets: Array<{
    x: number;
    y: number;
    weight: number;
    nodeId: string | null;
    role: string | null;
    phase: number;
  }>;
  iterationSnapshots?: Array<Float32Array>;  // for animated convergence
}
```

**Algorithm:**
1. Read pixel brightness from visual canvas into a Float32Array
2. Seed initial points via rejection sampling (dark pixels = more dots)
3. `d3.Delaunay.from(points)` for Voronoi tessellation
4. For each Voronoi cell, compute brightness-weighted centroid
5. Move each point to its cell centroid
6. Repeat steps 3-5 for N iterations, capturing snapshots for animation
7. Read ID canvas color at each final position, map to nodeId/role via legend
8. Read phase template cell for each position, assign phase index
9. Return targets with full semantic tagging

**Performance:** For 3,000-5,000 dots, d3-delaunay's `update()` method avoids memory allocation per iteration. 10 iterations should complete in under 200ms. The construction sequence shows iterations 1-5, remaining 5 settle during crystallize.

## StipplingDirector.ts (TF.js Integration)

TF.js directs the stippling. It does not perform it. Four decisions:

### Decision 1: Recruitment Count
- Inputs: SceneDirective salience scores, topology confidence, viewport dimensions
- Output: single integer (1,500 to 5,000)
- Mobile multiplier: `Math.min(1, viewportWidth / 1280)` scales down on small screens
- High confidence + clear topology = more dots. Tentative = fewer.

### Decision 2: Reveal Order (Phase Template)
- Selected from answer type, NOT from TF.js analyzing the offscreen canvas
- vizPlanner already knows the type; phase template is a lookup:
  - comparison: left -> right -> bridge (8x8)
  - timeline: left-to-right sweep (8x8)
  - hierarchy: root outward (16x16)
  - explanation: center -> satellites (8x8)
  - argument: bottom-to-top (16x16)
  - data-viz: varies (bars L-R, scatter by cluster, heatmap by intensity)
- TF.js modulates timing and emphasis WITHIN the template, not the template itself

### Decision 3: Dot Selection
- Given N target positions, select which of 30K galaxy dots get recruited
- Two strategies blended by `theatricality` score (0.0-1.0):
  - Low theatricality: pick dots nearest to targets (fast convergence)
  - High theatricality: pick distant dots (dramatic flight)
- For view transitions ("Show me why" toggle): force low theatricality
  so it feels like the same knowledge rearranging, not a new scene loading
- Assignment uses Hungarian-style nearest-neighbor matching

### Decision 4: Load-Bearing Identification
- Post-crystallize: correlate dot positions with evidence nodes
- Dots tagged via ID canvas already have nodeId and role
- TF.js marks dots as `loadBearing: true` based on:
  - role === 'conclusion' or role === 'premise'
  - Node appears in evidence_path with high confidence edges
- Powers Jenga interaction, argument structure view, Challenge feature

## Offscreen Renderers

### Contract

```ts
interface OffscreenRenderResult {
  visual: OffscreenCanvas;
  idMap: OffscreenCanvas;
  idLegend: Map<string, { nodeId: string; role?: string }>;
  phaseTemplate: number[][];  // 8x8 or 16x16 grid of phase indices
}
```

### Design Principles
- **Embarrassingly simple visually.** No human sees these canvases.
- **Hard edges, flat fills, maximum contrast.** Stippling works best with sharp brightness transitions.
- **No gradients, no anti-aliasing, no rounded corners.** These hurt stippling quality.
- **Bold shapes, strong hierarchy.** Think poster art, not infographics.
- **Canvas resolution:** 256x256 or 512x512 is sufficient. The stippling engine samples brightness; high resolution is wasted.

### Renderer Details

**ComparisonRenderer:** Two filled circles (left, right) with a filled rectangle bridge between them. Each circle is a distinct color in the ID map. Bridge has its own color. Phase: left=0, right=1, bridge=2.

**TimelineRenderer:** Horizontal axis with filled circles at state positions connected by thick lines. Each state circle is a distinct ID color. Phase: left-to-right index.

**HierarchyRenderer:** Top-down tree with thick branches. Each node is a filled circle, branches are thick lines. ID colors per node. Phase: root outward by depth.

**ExplanationRenderer:** Large central circle, smaller satellite circles connected by thick lines. Center is one ID color, each satellite distinct. Phase: center=0, satellites=1.

**ArgumentRenderer:** Directed graph, top-down. Conclusion (large circle, top), premises (medium circles, middle), evidence (small circles, bottom). Thick arrows point upward (evidence -> premise -> conclusion). Each node is a distinct ID color. ID legend includes role: `{ nodeId: "...", role: "conclusion" | "premise" | "evidence" }`. Phase: bottom=0, middle=1, top=2 (evidence resolves first, conclusion last).

**DataVizRenderer:** Takes Vega-Lite JSON spec, renders via vega-embed to an offscreen canvas. The rendered chart (bars, scatter, heatmap) becomes the visual canvas. ID map is trickier: partition the rendered area into semantic regions (each bar, each cluster, each intensity band). Phase template varies: bars L-R, scatter by cluster position, heatmap by intensity band.

### Not Stippled

**Portrait:** Uses existing VisionTracer pipeline (face mesh, body segmentation, Sobel). Does not produce an ID map. Portrait queries don't support Jenga/argument interactions. This is correct: "who is Barack Obama" isn't an argument with load-bearing premises.

**Geographic:** Hands off to D3/Vega renderer stack. Maps need cartographic projection, not dot approximation.

## GalaxyController Integration

The existing `runAnswerConstruction()` in GalaxyController gains a new path:

```
if (answer has image) -> existing VisionTracer/ImageTracer path (portraits)
else if (answer is geographic) -> existing truth map / RenderRouter path
else -> NEW stippling path:
  1. Select offscreen renderer based on vizPlanner type
  2. Render dual canvases (visual + ID map)
  3. StipplingDirector decides recruitment count, reveal order, dot selection
  4. StipplingEngine runs Lloyd's relaxation, returns tagged targets
  5. Assign targets to galaxy dots (using Director's selection strategy)
  6. Animate: iterate through construction phases using phase indices
  7. Crystallize: labels appear, remaining iterations settle
  8. Tag dots with load-bearing status for interaction layer
```

## Success Criteria

A person asks "what's the difference between a Roth IRA and a traditional IRA?" The galaxy dims. Dots begin flowing from scattered positions into two distinct clusters with a bridge between them, forming a recognizable comparison shape before any text appears. Clicking a dot in the left cluster opens a drawer about Traditional IRA properties. The text answer panel appears alongside. They press "Show me why" and the same dots rearrange (low theatricality, minimal distance) into an argument tree showing evidence flow. The dots ARE the answer.
