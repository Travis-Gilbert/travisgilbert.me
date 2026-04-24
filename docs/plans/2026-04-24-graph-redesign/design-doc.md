# Theseus Graph Redesign: Three Lenses Over One Graph

_Design doc for the cosmos.gl Explorer canvas redesign. Approved 2026-04-24._

## Problem

The Explorer canvas renders 3,000 nodes and 83,629 edges as an unreadable hairball. Colored clumps are visible (Leiden-anchored force is working) but every other signal is drowned by the edge layer. Prior attempts to make the graph useful have not produced a readable or pleasant result.

## Thesis

The Theseus graph is a major visual feature, not a data readout. The default state is alive and pleasant (a living "worm"). Reader-modes (Atlas, Clusters) are earned by switching lenses, not by decoding a hairball.

## Three Lenses

All three lenses share the same 3,000-node data, the same VIE token palette (terracotta, teal, gold, green, parchment), the same hover-promotes-edges behavior, and the same search / Ask integration. They differ in position source, simulation state, edge visibility, and label density.

### Flow lens (default)

Living worm. Gentle cluster-anchored force sim, never settled. Chromatic color rotation per simulation tick. No labels at rest.

- **Layout.** Real Leiden-anchored force positions. `simulationCluster: 0.7` (kept from current).
- **Simulation tuning.** `simulationGravity: 0.5`, `simulationRepulsion: 1.2`, `simulationLinkSpring: 0.9`, `simulationLinkDistance: 38`, `simulationDecay: Infinity`. Never settles by design.
- **Chromatic flow.** On every `onSimulationTick`, rotate the point-color buffer by one slot within each Leiden cluster (not globally; cluster identity is preserved). Colors cycle through the warm palette in fixed order. `graph.render()` after each rotation.
- **Edges.** Top-K-per-node filter (K=4) in `mapEdge` or `ingestExplorerData` drops edge count from ~83K to ~12K. Width 0.6 to 1.4. Color flows with incident points at half alpha.
- **Labels.** Off at rest. Hover or search / Ask focus resolves labels.
- **Background.** Parchment grain (existing DotGrid tokens), not void.

### Atlas lens

Static map. Pinned SBERT UMAP positions, warm density overlay, labeled regions. Readable and navigational.

- **Positions.** Pinned from `Object.layer_positions["sbert_umap"]` (server-computed, exported per SceneDirective v3). Fallback: current Leiden force positions if the layer is missing (renders the affected points in "pending" visual per claim 70ed7abc215d).
- **Simulation.** Disabled. `enableSimulation: false` via config.
- **Density overlay.** GPU heatmap layer with a parchment to terracotta warm ramp, drawn behind points. Regions read topographically.
- **Edges.** Hidden by default. Hover a node promotes 1-hop incident edges to 0.8 alpha in terracotta tint.
- **Labels.** Community-centroid labels always visible at overview. Individual node labels when zoom greater than 2x and in viewport. Capped at 5,000 per performance claim 017c2a309499.

### Clusters lens

Labeled communities with a resolution slider. Editorial, annotatable, structural.

- **Positions.** Same Leiden-anchored force as Flow, but settled and frozen.
- **Resolution slider.** Three stops: coarse (2 to 8 communities), medium (default, 15 to 20 communities), fine (40+). Values read from server-side `community_ids_by_resolution` (precomputed nightly).
- **Cluster hulls.** Soft rough.js polygons around each community, tinted from palette. Hand-drawn, not crisp.
- **Inter-cluster edges.** Drawn as bundled lines between cluster centroids. Width encodes aggregated edge weight between communities.
- **Labels.** Every cluster is labeled. No per-node labels at rest.

## Shared Architecture

The lens is a **SceneDirective** profile, not a new renderer. The change is additive.

- **SceneDirective.** Add `render_target.lens: "flow" | "atlas" | "clusters"` to `src/lib/theseus-viz/SceneDirective.ts`. Default: `"flow"`.
- **applySceneDirective.** Handler for the `lens` field is added to `src/lib/theseus/cosmograph/adapter.ts`. Current adapter covers 2 of 7 SceneDirective jobs (per claim 1b8f4f10c172); this closes the `render_target` gap.
- **One Graph instance.** Lens switches call `setConfigPartial` for runtime options and reseat `setPointPositions` / `setLinks` / `setPointColors` / `setPointClusterStrength` from pooled `Float32Array` buffers (claims ef406b2dff71, 9d94e0e528c3). Never `setConfig`. Never `new Graph` on lens switch.
- **Atlas exception.** Because `enableSimulation` is init-only, switching to Atlas destroys and recreates the Graph instance (claim 8cceb062a8cf: pair `new Graph` with `graph.destroy()`). This happens inside a 600ms opacity crossfade so it reads as intentional.
- **Ask integration.** `ExplorerAskComposer` still routes streamed directives through `applySceneDirective`. Answers paint into whichever lens is active.
- **Colors.** All point and link colors pull from `--cp-*` or `--vie-*` tokens via `cssVarToRgba` (claim 681ecc1b702b). No hex or float triplets in config or adapter.

## Interaction

### Lens switcher

Bottom-left of the canvas, next to the existing Fit / Reset / Labels / Measure buttons. Three small text toggles in the existing studio typography.

```
FLOW · ATLAS · CLUSTERS
```

- Active lens underlined with a rough.js stroke.
- Keyboard: `1`, `2`, `3` switch directly. `Tab` cycles.
- Transitions run 600ms ease (reuses cosmos-pro `focus-and-fit` recipe timing) with opacity crossfade.

### Double-click shortcut (Flow → Atlas)

A double-click on empty canvas in Flow lens transitions directly to Atlas. Implemented in `CosmosGraphCanvas` via a click-timestamp guard: if two `onClick` events fire within 300ms without an intervening `onPointClick`, dispatch a `theseus:set-lens` event with payload `"atlas"`. Single-click on empty canvas remains a no-op.

### Hover

Hover on a point in any lens promotes incident edges to 0.8 alpha in a terracotta tint. Point grows by 1.2x with a 120ms ease. Existing hover ring stays.

### Search and Ask

Unchanged contract. A focus directive from search or the Ask composer paints into the active lens: in Flow, the focal subgraph becomes opaque and the rest dims; in Atlas, the focal neighborhood edges draw in; in Clusters, the owning cluster highlights.

## Data Pipeline

### Edge reduction

Top-K-per-node filter implemented in `useGraphData` (or in `ingestExplorerData` if we prefer to cut at DuckDB ingest time for Mosaic filter consistency). K=4 default, exposed as a dev constant for tuning.

```typescript
function topKPerNode(links: CosmoLink[], K: number): CosmoLink[] {
  const perNode = new Map<string, CosmoLink[]>();
  for (const link of links) {
    const push = (key: string) => {
      const list = perNode.get(key) ?? [];
      list.push(link);
      perNode.set(key, list);
    };
    push(link.source);
    push(link.target);
  }
  const kept = new Set<CosmoLink>();
  for (const list of perNode.values()) {
    list.sort((a, b) => b.weight - a.weight);
    for (let i = 0; i < Math.min(K, list.length); i++) kept.add(list[i]);
  }
  return Array.from(kept);
}
```

### Position sources

- **Flow.** `undefined` (cosmos.gl seeds random then simulation resolves with cluster anchoring).
- **Atlas.** `Object.layer_positions["sbert_umap"]` from the backend. Fallback to Flow positions with pending-visual markers for uncovered points.
- **Clusters.** Frozen Flow positions (capture after first `onSimulationEnd`).

### Color source

Per-point base color from `object_type_color` (existing, via VIE token pipeline). Flow lens rotates these within each Leiden cluster per tick; Atlas and Clusters render them static.

## Visual Language

- **Palette.** VIE tokens only: `--vie-terra`, `--vie-teal`, `--vie-gold`, `--vie-green`, `--vie-parchment`, `--vie-text-dim`. No rainbow, no hex.
- **Typography.** Cluster labels in `--font-metadata` (Courier Prime), ALL CAPS, letter-spacing 0.14em. Matches existing `AtlasPlateLabel`.
- **Motion.** Flow is continuous. Atlas and Clusters are still. Transitions between lenses are 600ms opacity crossfade plus 300ms position ease where positions change.
- **Backdrop.** Existing parchment + DotGrid combination, unchanged.
- **Rough.js.** Cluster hulls (Clusters lens) and the lens-switcher underline are rough-stroked. Nothing else. The graph itself stays WebGL-crisp.

## Empty / Loading / Error States

- **Loading.** Parchment background, single pulsing dot, "Loading graph · N nodes" in mono. No fake worm, no scripted activity (project rule).
- **Empty.** "No graph data yet. Drop files anywhere on this surface to ingest." (Keeps existing copy.)
- **WebGL2 unsupported.** Existing message unchanged. 2D fallback is out of scope for this redesign.
- **Error.** Existing error card.

## Accessibility

- Lens switcher is keyboard-navigable with visible focus rings.
- All lens transitions respect `prefers-reduced-motion`: opacity crossfade becomes instant, chromatic flow in Flow lens slows to one rotation per 3 seconds instead of per tick.
- Labels use `aria-label` on the Graph container so screen readers announce "Theseus graph, 3000 nodes, flow lens active."
- Keyboard shortcuts documented in the Measure panel help tooltip.

## Phasing

- **Phase 1 core (one week).** Flow lens with top-K edge filter and chromatic rotation. Replaces the current hairball. Ships alone even if Phases 2 and 3 slip.
- **Phase 2 structure (one week).** Lens switcher, Atlas lens with SBERT UMAP positions and density overlay, double-click Flow to Atlas shortcut.
- **Phase 3 navigation (one week).** Clusters lens with resolution slider and rough.js hulls.

Phase 1 alone solves the "graph shows nothing intelligible" problem. Phases 2 and 3 raise the ceiling from "pleasant" to "navigable."

## Out of Scope

- Server-side disparity-filter backbone (defer; client-side top-K is enough for Phase 1).
- Dark mode (tokens ready, not wired).
- 2D fallback renderer (separate recipe).
- Hierarchical edge bundling (needs stable community tree).
- Mosaic cross-filter redesign (existing Measure bar stays).

## Open Questions and Defaults

1. **Color rotation scope (Flow).** Default: rotate within each Leiden cluster, not globally. Preserves community identity. Revisit after seeing it live.
2. **Atlas density ramp.** Default: single warm ramp (parchment to terracotta). No teal highlight on densest cores in Phase 2; revisit if the overlay reads flat.
3. **Clusters default resolution.** Default: medium (15 to 20 communities).
4. **K for top-K edge filter.** Default K=4. Exposed as a constant at the top of `useGraphData.ts` for easy tuning.

## Risks

- **Flow simulation never settles.** This is the point. Monitor GPU / battery impact on low-end hardware. Mitigation: in `prefers-reduced-motion`, drop decay to a finite value and let it rest.
- **Lens switch to Atlas destroys and recreates the Graph.** Well-understood cosmos.gl constraint. Handled by crossfade and by resetting any local state that depends on the old `Graph` instance (zoom listeners, indexToIdRef).
- **SBERT UMAP coverage may be partial.** Points without `layer_positions["sbert_umap"]` render in pending visual (cluster-centered, desaturated, 0.6x size, hollow) per claim 70ed7abc215d. Document this in the Atlas lens README.
- **Color rotation in WebGL could cause visual seizure on high-contrast palettes.** Warm-only palette is mild; verify against flash thresholds.

## Success Criteria

- At Phase 1 completion, a first-time visitor describes the graph as "pleasant" or "alive," not "a hairball" or "confusing."
- Edge count rendered at overview drops from 83,629 to under 15,000.
- Lens switcher loads in under 800ms for Flow to Clusters and under 1500ms for Flow to Atlas (includes Graph recreation).
- No hardcoded colors or em / en dashes introduced.
- All new code passes the cosmos-pro critic VERIFY checks (foundations, mosaic-duckdb, recipes, scene-directive, performance).

## References

- Research brief: `docs/plans/2026-04-24-graph-redesign/research-brief.md`
- cosmos.gl worm example: `https://cosmos.gl/?path=/story/examples-clusters--worm`
- cosmos.gl with-labels example: `https://cosmos.gl/?path=/story/examples-clusters--with-labels`
- cosmos-pro recipes: `clustering-force.md`, `pinned-layer-positions.md`, `gpu-heatmap-overlay.md`, `focus-and-fit.md`, `empty-state-and-loading.md`
- Project constraints: `CLAUDE.md` sections "Explorer Canvas (cosmos.gl + Inline Ask)" and "cosmos.gl / luma.gl" gotchas.
- SceneDirective v3: `src/lib/theseus-viz/SceneDirective.ts`
