# Research Brief: Theseus Graph View Redesign

_Generated 2026-04-24 for redesign of the 3K-node / 83K-edge cosmos.gl Explorer canvas that currently renders as an unreadable hairball._

## Axis 1. Knowledge-graph / network UIs that work at similar scale

- **Obsidian Graph view** ([Obsidian Help](https://help.obsidian.md/plugins/graph)) : depth slider, tag/search filters, "link distance + repel strength" tuning; hides node labels until hover at low zoom. Pleasant because default is a sparse subgraph, not the whole vault. Fit for studio-journal aesthetic: yes (quiet, uncolored by default).
- **Bluesky Atlas / 13M-user visualization** ([jaz atlas](https://bsky.jazco.dev/), [Gustafson 2024](https://joelgustafson.com/posts/2024-11-12/visualizing-13-million-bluesky-users/)) : ForceAtlas2 + community coloring, click-to-focus with context panel to the side; pauses simulation on select. Shows a cloud, not edges, at scale. Fit: partial (coloring-by-community is editorial).
- **Nomic Atlas** ([atlas.nomic.ai](https://atlas.nomic.ai/), [docs](https://docs.nomic.ai/atlas/embeddings-and-retrieval/guides/how-to-visualize-embeddings)) : UMAP points on semantic map with hierarchical topic labels that appear / disappear at zoom levels; colored regions instead of edges. Edges are de-emphasized or absent. Fit: high (map metaphor, no hairball).
- **InfraNodus** ([infranodus.com](https://infranodus.com/)) : betweenness-centrality-sized nodes, Leiden-clustered 2D layout, gap detection surfaces "structural holes" as first-class UI. Fit: medium (color-by-community is bolder than studio palette).

Takeaway: every viable large-scale UI either (a) filters to a subgraph before rendering, (b) hides edges and leans on clusters / density, or (c) uses a pre-computed embedding layout rather than live force.

## Axis 2. Edge-density reduction techniques

- **Disparity filter / multiscale backbone** (Serrano, Boguna, Vespignani 2009, [PNAS 106:6483](https://www.pnas.org/content/106/16/6483), [NetworkX impl](https://github.com/DerwenAI/disparity_filter)) : keeps edges whose weight is statistically non-uniform per node at an alpha threshold; preserves degree distribution, clustering, most of total weight. Proven at 10^5 edges.
- **Hierarchical edge bundling** (Holten 2006, [IEEE TVCG paper](https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Holten06.pdf)) : bundles non-hierarchical edges along a control tree as cubic B-splines. Requires a hierarchy (community tree works). Reduces visual clutter dramatically.
- **k-core decomposition** (Alvarez-Hamelin et al. 2005, [arXiv cs/0504107](https://arxiv.org/abs/cs/0504107)) : prune by minimum degree recursively; layout shells as concentric rings (radius = coreness, angle = cluster). O(n+e). Natural pairing with semantic zoom (inner rings at overview, leaves on zoom-in).
- **Top-K per node + weight thresholding** ([Cambridge Intelligence: Fixing Hairballs](https://cambridge-intelligence.com/how-to-fix-hairballs/)) : simplest and most effective first pass; keep top K edges by weight per node, drop the rest. No paper needed, but combines with backbone extraction.

Takeaway: with 83K edges on 3K nodes (~28 avg degree), top-K (K=3-5) plus disparity filter at alpha ~0.05 is expected to cut edges by 80-95% without losing cluster structure.

## Axis 3. Semantic layouts beyond force-directed

- **UMAP / t-SNE from embeddings** ([UMAP docs](https://umap-learn.readthedocs.io/)) : local + global structure preserved in 2D; fast, scales to 10^6. Fit with Theseus's existing SBERT embeddings (already exported per `Object.layer_positions`). Fit: high.
- **Community-anchored layout** (cosmos.gl `pointClusterStrength`, see cosmos-pro `clustering-force.md`) : fix Leiden / HDBSCAN cluster centers, let local simulation resolve overlap inside. Already a Theseus default at 0.7. Fit: native.
- **Concentric / radial (k-core, hive plots)** ([Hive Plots, Krzywinski](https://hiveplot.com/), [Briefings in Bioinformatics 2012](https://academic.oup.com/bib/article/13/5/627/412507)) : nodes on radial axes by type / property, edges as curves; predictable, comparable across graphs. Fit: medium (rational but geometric, not editorial).
- **Landscape / terrain metaphor** (Chalmers Bead 1993, [ThemeView / VxInsight](https://www.dcs.gla.ac.uk/~matthew/papers/ecsit93.pdf)) : height = topic density, contours = similarity; no edges at overview. Fit: high for studio aesthetic (paper-map, hand-drawn contour).

Takeaway: Theseus has SBERT + Leiden already; pinned-layer positions + cluster-anchored force (cosmos-pro recipes already codify both) is the lowest-cost path to a readable baseline.

## Axis 4. Visual idioms for dense graphs

- **Alpha-ramped edges to near-invisibility** (cosmos-pro `dynamic-filtering.md` uses 0.15 out-of-filter opacity; Cosmograph defaults): edges recede; clusters do the work. Fit: yes.
- **GPU density heatmap** (Cosmograph `heatmap` overlay; cosmos-pro `gpu-heatmap-overlay.md`) : density texture behind points; hotspots read at overview. Luma.gl pinned at 9.2.6 already. Fit: editorial only if ramp is warm-to-parchment, not rainbow.
- **Point-cloud / scatter aesthetic** (Nomic Atlas, Gustafson Bluesky) : edges absent or under 0.05 alpha; labels appear only in viewport focus. Fit: high.
- **De-emphasize edges, let clusters carry the signal** ([eagereyes "Graphs Beyond the Hairball"](https://eagereyes.org/blog/2012/graphs-hairball), Kumu community coloring [docs.kumu.io](https://docs.kumu.io/guides/clustering)) : edges only drawn for focused node + neighbors. Fit: native to existing cosmos-pro `focus-and-fit.md` recipe.

## Axis 5. Theseus-specific context

- **Existing design language** (Website `CLAUDE.md`) : studio-journal, parchment, rough.js hand-drawn, terracotta / teal / gold / green section tints. No rainbow category palettes. No em / en dashes. No mock data or "try asking" decorative UI.
- **Existing stack** : `@cosmos.gl/graph` 3.0-beta (WebGL force), luma.gl 9.2.6 pinned, `@uwdata/mosaic-*` + `@duckdb/duckdb-wasm` (cross-filter), `@tensorflow/tfjs` (SceneDirector GNN, ~12K params).
- **SceneDirective v3** (`src/lib/theseus-viz/SceneDirective.ts`) : 7 intelligence jobs (Salience, Topology, ContextShelf, ForceConfig, Camera, Sequence, Hypothesis). Layouts module already has `Force / Geo / Hierarchy / Scatter / Temporal / Tension`. Redesign plugs into this contract, not a new one.
- **Cosmos-pro recipes already present** (`~/.claude/plugins/.../cosmos-pro/recipes/`) : `clustering-force` (Leiden + SBERT default pointClusterStrength 0.7), `pinned-layer-positions` (simulation off, upstream UMAP positions as truth), `mixed-position-weight-edges` (ControlDock composition), `gpu-heatmap-overlay` (density layer), `dynamic-filtering` (Mosaic Selection alpha ramp 0.15), `histogram-timeline-brush` (vgplot cross-filter), `focus-and-fit` (600ms ease, padding 1.2), `empty-state-and-loading` (booting / hydrating / warmup / empty / errored).
- **Route scoping** : `(commonplace)` has own layout.tsx, `--cp-*` tokens only inside `.commonplace-theme`. Explorer renders inside this theme.

## Axis 6. Anti-patterns (with evidence)

- **Default-render all edges** ([eagereyes hairball post](https://eagereyes.org/blog/2012/graphs-hairball), [Cambridge Intelligence](https://cambridge-intelligence.com/how-to-fix-hairballs/)) : at > ~10K visible edges on screen, pattern recognition fails.
- **Labels on every node** (Obsidian defaults off at large graph sizes; Bluesky Atlas defers labels to hover): occludes structure, kills readability.
- **Rainbow color-by-id** ([Graphs Beyond the Hairball](https://eagereyes.org/blog/2012/graphs-hairball)) : perceptually misleading; no ordering interpretation; clashes with editorial palette.
- **Live force on >5K nodes at overview zoom** (Cosmograph docs, Gustafson 13M Bluesky) : simulation never settles, motion is noise. Pin layout from embeddings; optionally run gentle sim only for overlap.

## Key Constraints

- Must render inside `(commonplace)` route group using `--cp-*` tokens and rough.js idiom (studio-journal, not editorial data-viz).
- Must not introduce new WebGL / canvas dependencies; cosmos.gl 3.0-beta + luma.gl 9.2.6 are pinned.
- Must conform to SceneDirective v3 contract; redesign is a new layer / directive profile, not a new renderer.
- Must not ship mock data or decorative UI; every control must be wired to real filter state or removed.
- Must honor cosmos.gl init-only config (`enableSimulation`, random seed): swapping layouts = destroying and recreating the Graph instance.
- 3K nodes / 83K edges is reachable today; design must also degrade gracefully as both counts grow.
- All cross-filtering must flow through Mosaic Selections per existing recipes, not component-to-component props.
- No em / en dashes in any copy, label, comment, or markdown.

## Approaches worth pursuing (ranked)

1. **Edge-reduction pipeline + de-emphasized edges + cluster-anchored pinned layout.** Precompute disparity-filter backbone (server-side, research_api) or top-K-per-node (client-side), render remaining edges at alpha ~0.05, drive position from SBERT UMAP (already exported), anchor to Leiden clusters via `pointClusterStrength: 0.7`. Lowest-risk: every piece exists in the codebase or recipes.
2. **Semantic zoom with k-core / community tiers.** Overview = cluster centroids only (labeled), mid-zoom = backbone edges + sized nodes, close-zoom = full local neighborhood with labels. Maps onto existing `SceneDirective` focus mechanic and `focus-and-fit` recipe.
3. **Landscape / density overlay behind a sparser node layer.** `gpu-heatmap-overlay` recipe with a parchment-warm ramp (not rainbow); nodes rendered on top with alpha-ramped edges. Fits studio aesthetic more than any force-graph does.
4. **Cross-filter-first UI (histogram + timeline drives graph).** Per `histogram-timeline-brush.md`: visible node count is a *result* of filter, not an input. Default view is "empty until filtered" or "this week's activity only."
5. **Hive plot / radial-by-type as alternate lens.** Rational, comparable, reads at scale; pairs with SceneDirective's `HierarchyLayout`. Secondary view, not the default (geometric feel is further from studio-journal).

## Approaches to reject

- **Live force-directed over full 3K / 83K at overview.** Evidence: every large-scale reference above pins layouts or drops to density; simulation on this many edges never settles and eats the GPU.
- **Rainbow community coloring.** Evidence: Theseus section-color language is four warm tints with semantic meaning; a per-cluster rainbow destroys that vocabulary and is also a documented perceptual anti-pattern.
- **Hierarchical edge bundling as primary.** Evidence: requires a stable hierarchy (Theseus clusters evolve nightly via `evolve_edges`) and produces a dense bundle aesthetic that reads as "chart," not "journal." Keep as a later lens if a stable community tree is adopted.

## Open Questions (for brainstorm phase)

- Which of Theseus's existing node metadata (PageRank, community ID, tension status, recency, IQ axis scores) should drive size vs. color vs. position vs. visibility? Recipes assume this mapping is known; it isn't yet.
- Is the primary user task "explore the whole graph" or "see what changed this week" (graph-weather surface)? The two goals point at different defaults.
- Should edges be computed server-side (disparity filter in research_api, surfaced as a new edge layer) or client-side (top-K in DuckDB)? Server-side is more reusable across surfaces.
- What is the default empty state? "No filter active, showing top 50 by PageRank" is honest; "full graph" is a hairball by design.
- How does the redesign coexist with the existing Inline Ask composer (streaming SSE directive -> `applySceneDirective`)? Does Ask always narrow to a focused subgraph, or can it also paint the overview?
