# Theseus Graph Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the unreadable cosmos.gl hairball with three lenses (Flow, Atlas, Clusters) over one Graph instance. Phase 1 (Flow with top-K edges and chromatic rotation) ships independently and solves the "graph shows nothing intelligible" problem on its own.

**Architecture:** Single `cosmos.gl` Graph managed by `CosmosGraphCanvas`. Lens selection is a SceneDirective field routed through `applySceneDirective` (closes the `render_target` gap noted in claim 1b8f4f10c172). Runtime config changes via `setConfigPartial` only (claim ef406b2dff71). Buffer pool reuse for all `Float32Array` data (claim 9d94e0e528c3). Colors exclusively from `--vie-*` / `--cp-*` tokens via `cssVarToRgba` (claim 681ecc1b702b).

**Tech Stack:** `@cosmos.gl/graph` 3.0-beta, luma.gl 9.2.6 (pinned), React 19 + Next.js 16 App Router, Tailwind v4, TypeScript strict, rough.js (for Phase 3 hulls only), ESLint.

**Testing note:** This project has no unit-test framework (no Vitest, Jest, or Playwright). Verification relies on `npm run lint`, `npm run build` (which runs `tsc`), and visual QA via `preview_*` tools. Where pure utility functions benefit from tests, we introduce a minimal test file only if we also install a lightweight runner; otherwise we verify via an inline dev-only smoke check at the bottom of the module, gated by `if (process.env.NODE_ENV !== 'production')` and stripped in production builds.

**Branch:** All work on a new branch `feat/graph-redesign-v1` created from `main`. The current branch `feat/gl-fusion-v7` is ML-training work and must not mix with this.

**Design doc:** `docs/plans/2026-04-24-graph-redesign/design-doc.md`
**Research brief:** `docs/plans/2026-04-24-graph-redesign/research-brief.md`

---

## Task 0: Create feature branch

**Files:** none (git operation only).

**Step 1: Verify clean working tree on a safe starting point**

Run: `cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && git status -sb`
Expected: the only uncommitted item is untracked `docs/plans/2026-04-24-graph-redesign/`. If other files are modified, stop and ask the user.

**Step 2: Create and switch to the new branch from main**

Run: `git fetch origin main && git checkout -b feat/graph-redesign-v1 origin/main`
Expected: `Switched to a new branch 'feat/graph-redesign-v1'`.

**Step 3: Stage and commit the design doc and research brief so the plan has a home**

Run:
```bash
git add docs/plans/2026-04-24-graph-redesign/
git commit -m "docs(graph): add design doc + research brief for three-lens redesign"
```
Expected: single commit added to `feat/graph-redesign-v1`.

---

## Phase 1 — Flow Lens (ships independently)

Phase 1 delivers the living worm with reduced edges. No SceneDirective changes, no lens switcher. Replaces the current hairball and shipping it alone already solves the stated problem.

### Task 1: Add `topKPerNode` edge-filter utility

**Files:**
- Create: `src/lib/theseus/graph/topK.ts`

**Step 1: Create the utility**

Write:
```typescript
import type { CosmoLink } from '@/components/theseus/explorer/useGraphData';

/**
 * Keep the top-K strongest edges per node (by `weight`). An edge is kept
 * if it is in the top-K of *either* endpoint, so hub nodes don't lose
 * all connections and peripheral nodes keep their few links.
 *
 * At 3000 nodes / 83K edges, K=4 reduces the set to roughly 10-14K
 * without disconnecting any community. Exposed as a parameter for
 * tuning in CosmosGraphCanvas.
 */
export function topKPerNode(links: CosmoLink[], K: number): CosmoLink[] {
  if (K <= 0 || links.length === 0) return links;

  const perNode = new Map<string, CosmoLink[]>();
  const push = (key: string, link: CosmoLink) => {
    const list = perNode.get(key);
    if (list) {
      list.push(link);
    } else {
      perNode.set(key, [link]);
    }
  };
  for (const link of links) {
    push(link.source, link);
    push(link.target, link);
  }

  const kept = new Set<CosmoLink>();
  for (const list of perNode.values()) {
    if (list.length <= K) {
      for (const l of list) kept.add(l);
      continue;
    }
    list.sort((a, b) => b.weight - a.weight);
    for (let i = 0; i < K; i++) kept.add(list[i]);
  }

  return Array.from(kept);
}
```

**Step 2: Verify type-check**

Run: `cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && npx tsc --noEmit`
Expected: no errors related to the new file.

**Step 3: Commit**

Run:
```bash
git add src/lib/theseus/graph/topK.ts
git commit -m "feat(graph): add topKPerNode edge-filter utility"
```

---

### Task 2: Wire `topKPerNode` into `useGraphData`

**Files:**
- Modify: `src/components/theseus/explorer/useGraphData.ts`

**Step 1: Add filter constant and import**

At the top of the file, after the existing imports, add:
```typescript
import { topKPerNode } from '@/lib/theseus/graph/topK';

/** Top-K per-node edge filter for the Flow lens. Tuning knob: raising
 *  this shows more structure at the cost of visual density. */
export const FLOW_EDGE_TOP_K = 4;
```

**Step 2: Apply the filter after `mapEdge` in the fetch effect**

Locate the existing block around line 189-196 (the `.map(mapEdge).filter(...)` chain inside the `try` branch of the async IIFE) and replace:
```typescript
          links: edges.map(mapEdge).filter((l): l is CosmoLink => l !== null),
```
with:
```typescript
          links: topKPerNode(
            edges.map(mapEdge).filter((l): l is CosmoLink => l !== null),
            FLOW_EDGE_TOP_K,
          ),
```

**Step 3: Also apply in the filtered `useMemo` path for consistency**

Locate the `nextLinks` assignment around line 236-238 and wrap:
```typescript
    const nextLinks = state.links.filter(
      (l) => keptIds.has(l.source) && keptIds.has(l.target),
    );
```
(No change needed here: `state.links` is already top-K filtered from the fetch, so the kind-filter step continues to operate on the reduced set.)

**Step 4: Type-check and lint**

Run:
```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website"
npx tsc --noEmit
npm run lint -- --max-warnings=0 src/components/theseus/explorer/useGraphData.ts src/lib/theseus/graph/topK.ts
```
Expected: no errors.

**Step 5: Commit**

Run:
```bash
git add src/components/theseus/explorer/useGraphData.ts
git commit -m "feat(graph): apply top-4 per-node edge filter in Flow lens"
```

---

### Task 3: Tune simulation config for the worm feel

**Files:**
- Modify: `src/components/theseus/explorer/CosmosGraphCanvas.tsx` (lines ~1675-1725)

**Step 1: Replace the simulation constants in the `config: GraphConfig` block**

Find the block that currently reads:
```typescript
        simulationRepulsion: 2.6,
        simulationGravity: 0.15,
        simulationCenter: 0.1,
        simulationLinkSpring: 0.25,
        simulationLinkDistance: 42,
        simulationFriction: 0.85,
        simulationCluster: 0.7,
        simulationDecay: 8000,
```
and replace with:
```typescript
        // Flow-lens worm tuning. Gentler repulsion + stronger spring
        // than the previous "worm-cluster" baseline so points pull into
        // soft interconnected limbs. simulationDecay: Infinity keeps
        // the worm alive instead of freezing (this is the point).
        // prefers-reduced-motion falls back to a finite decay in Task 7.
        simulationRepulsion: 1.2,
        simulationGravity: 0.5,
        simulationCenter: 0.1,
        simulationLinkSpring: 0.9,
        simulationLinkDistance: 38,
        simulationFriction: 0.85,
        simulationCluster: 0.7,
        simulationDecay: Number.POSITIVE_INFINITY,
```

**Step 2: Remove the `onSimulationEnd` fitView trigger at line ~1722-1725**

The worm never ends, so `onSimulationEnd` will not fire. Leave the handler in place (it is defensive against a future finite-decay path), but add a one-shot fitView on first data push. Locate `onSimulationEnd` and leave it unchanged for now; the initial fitView is already covered by `fitViewOnInit: true` + `fitViewDelay: 1400`.

**Step 3: Verify in the dev server**

Run (in a background shell):
```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && npm run dev
```
Then verify visually via preview tools: navigate to the Explorer view, confirm the graph forms visible cluster limbs and continues gentle motion beyond 5 seconds (the old `8000ms` freeze point). Screenshot for the commit trailer.

**Step 4: Commit**

Run:
```bash
git add src/components/theseus/explorer/CosmosGraphCanvas.tsx
git commit -m "feat(graph): tune simulation for Flow-lens worm feel"
```

---

### Task 4: Reduce default edge alpha and width

**Files:**
- Modify: `src/components/theseus/explorer/CosmosGraphCanvas.tsx` (the `writeBaselineLinkStyles` callback around line 361-380, and the `config` block around line 1685-1687)

**Step 1: Drop the baseline edge tint alpha**

In `writeBaselineLinkStyles`, change:
```typescript
      const linkTint = cssVarToRgba('--vie-text-dim', 0.55);
```
to:
```typescript
      // Flow-lens baseline edge tint: near-invisible backdrop hatching.
      // Hover / focus handlers promote incident edges to full alpha;
      // this is only the at-rest ambient layer.
      const linkTint = cssVarToRgba('--vie-text-dim', 0.08);
```

**Step 2: Drop the width multiplier**

Same callback, change:
```typescript
      const w = 0.5 + link.weight * 1.5;
```
to:
```typescript
      const w = 0.4 + link.weight * 0.8;
```

**Step 3: Drop the global link opacity in `config`**

In the `config: GraphConfig` block, change:
```typescript
        linkDefaultColor: cssVarToRgba('--vie-text-dim', 0.55),
        linkDefaultWidth: 1.2,
        linkOpacity: 0.7,
```
to:
```typescript
        linkDefaultColor: cssVarToRgba('--vie-text-dim', 0.08),
        linkDefaultWidth: 0.8,
        linkOpacity: 1.0,
```

Rationale: we have already baked alpha into `linkTint`; driving `linkOpacity` at 1.0 means the per-edge alpha is the truth. This lets Task 6 raise incident-edge alpha via `pool.linkColors` without fighting a global multiplier.

**Step 4: Visual QA via dev server**

With the dev server running from Task 3, confirm in preview that edges now read as a faint backdrop wash rather than a solid hatching. Use `preview_screenshot`.

**Step 5: Commit**

Run:
```bash
git add src/components/theseus/explorer/CosmosGraphCanvas.tsx
git commit -m "feat(graph): reduce Flow-lens edge ambient alpha and width"
```

---

### Task 5: Add chromatic rotation utility

**Files:**
- Create: `src/lib/theseus/graph/chromaticRotation.ts`

**Step 1: Create the utility**

Write:
```typescript
/**
 * Chromatic rotation: shift each point's color by one slot within its
 * Leiden cluster on every tick. Cluster identity is preserved; only
 * the color mapping rotates, so the canvas appears to flow without
 * any structural change.
 *
 * Global rotation (ignoring clusters) is destructive to community
 * identity and reads as noise; the within-cluster path is the Flow
 * lens baseline.
 *
 * Buffer reuse: writes into `dst` if provided (must match `src`
 * length); otherwise allocates a new Float32Array. Allocations in
 * hot paths are a known perf smell (claim 9d94e0e528c3), so the
 * caller should always pass a pooled `dst`.
 */
export function rotateColorsWithinClusters(
  src: Float32Array,
  clusters: Int32Array,
  dst: Float32Array,
): void {
  const pointCount = clusters.length;
  if (src.length !== pointCount * 4) {
    throw new Error(
      `rotateColorsWithinClusters: src length ${src.length} does not match pointCount * 4 (${pointCount * 4})`,
    );
  }
  if (dst.length !== src.length) {
    throw new Error(
      `rotateColorsWithinClusters: dst length ${dst.length} must equal src length ${src.length}`,
    );
  }

  // Build cluster membership: for each cluster id, the list of point
  // indices. Built each call (cheap; linear in pointCount) so the
  // caller does not have to pre-partition.
  const members = new Map<number, number[]>();
  for (let i = 0; i < pointCount; i++) {
    const c = clusters[i];
    const list = members.get(c);
    if (list) {
      list.push(i);
    } else {
      members.set(c, [i]);
    }
  }

  // Rotate: dst[member[k]] = src[member[(k - 1 + n) % n]]
  for (const ring of members.values()) {
    const n = ring.length;
    if (n < 2) {
      // Singleton clusters copy straight across.
      for (const idx of ring) {
        const off = idx * 4;
        dst[off] = src[off];
        dst[off + 1] = src[off + 1];
        dst[off + 2] = src[off + 2];
        dst[off + 3] = src[off + 3];
      }
      continue;
    }
    for (let k = 0; k < n; k++) {
      const dstIdx = ring[k];
      const srcIdx = ring[(k - 1 + n) % n];
      const dstOff = dstIdx * 4;
      const srcOff = srcIdx * 4;
      dst[dstOff] = src[srcOff];
      dst[dstOff + 1] = src[srcOff + 1];
      dst[dstOff + 2] = src[srcOff + 2];
      dst[dstOff + 3] = src[srcOff + 3];
    }
  }
}
```

**Step 2: Type-check**

Run: `cd "/Users/travisgilbert/Tech Dev Local/Creative/Website" && npx tsc --noEmit`
Expected: no errors.

**Step 3: Commit**

Run:
```bash
git add src/lib/theseus/graph/chromaticRotation.ts
git commit -m "feat(graph): add within-cluster chromatic rotation utility"
```

---

### Task 6: Wire chromatic rotation to `onSimulationTick`

**Files:**
- Modify: `src/components/theseus/explorer/CosmosGraphCanvas.tsx`

**Step 1: Import and prepare the rotation buffer**

Near the top of the file, add:
```typescript
import { rotateColorsWithinClusters } from '@/lib/theseus/graph/chromaticRotation';
```

**Step 2: Extend the buffer pool with cluster + rotation buffers**

Locate the `BufferPool` interface (around line 95-110) and add two fields:
```typescript
  rotationScratch: Float32Array; // ping-pong target for chromaticRotation
  clusterIds: Int32Array;         // per-point Leiden community id
```

In the `createBufferPool` factory (around line 125-140) add:
```typescript
    rotationScratch: new Float32Array(pointCount * 4),
    clusterIds: new Int32Array(pointCount),
```

**Step 3: Populate `clusterIds` when data is pushed**

In `pushDataToGraph` (locate the existing `resolveClusterOrdinal` call around line 1613-1637 — the `for (let i = 0; i < pointCount; i++)` loop that computes `pointClusters`), also write into `pool.clusterIds`:
```typescript
      for (let i = 0; i < pointCount; i++) {
        const ord = resolveClusterOrdinal(pts[i], clusterContext);
        pointClusters[i] = ord ?? undefined;
        pool.clusterIds[i] = typeof ord === 'number' ? ord : -1;
      }
```

**Step 4: Add a rotation rate ref and honor `prefers-reduced-motion`**

Near the other refs at the top of the component body (look for the block of `useRef`s around line 200-260), add:
```typescript
  // Chromatic rotation pacing. 1 means rotate every tick (fastest);
  // higher values slow the flow. Set to 90 (~1.5s at 60fps) under
  // prefers-reduced-motion.
  const rotationEveryNTicksRef = useRef<number>(1);
  const tickCounterRef = useRef<number>(0);
```

Add a useEffect that sets the rate based on the media query:
```typescript
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      rotationEveryNTicksRef.current = mq.matches ? 90 : 1;
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
```

**Step 5: Rotate in `onSimulationTick`**

Find the `onSimulationTick` handler in the `config: GraphConfig` block (if it does not exist, add one; it sits next to `onSimulationEnd`):
```typescript
        onSimulationTick: () => {
          const graph = graphRef.current;
          const pool = poolRef.current;
          if (!graph || !pool) return;
          tickCounterRef.current += 1;
          if (tickCounterRef.current % rotationEveryNTicksRef.current !== 0) return;
          rotateColorsWithinClusters(pool.colors, pool.clusterIds, pool.rotationScratch);
          pool.colors.set(pool.rotationScratch);
          graph.setPointColors(pool.colors);
          // No graph.render() — cosmos.gl drives its own frame after
          // the tick callback returns.
        },
```

**Step 6: Visual QA**

With the dev server running, confirm that node colors flow within each cluster every tick, clusters keep their identity, and motion is gentle (no strobing). Use `preview_screenshot` at two moments 1 second apart to confirm the flow.

**Step 7: Commit**

Run:
```bash
git add src/components/theseus/explorer/CosmosGraphCanvas.tsx
git commit -m "feat(graph): add chromatic rotation on simulation tick"
```

---

### Task 7: Plate-label honesty pass

**Files:**
- Modify: `src/components/theseus/explorer/atlas/AtlasPlateLabel.tsx` (or wherever the plate reads `total.edges`; confirm path first via grep)

**Step 1: Find the plate component**

Run: `grep -rn "AtlasPlateLabel" "/Users/travisgilbert/Tech Dev Local/Creative/Website/src/components/theseus/explorer/"`
Expected: a file under `explorer/atlas/` that renders the `PLATE 03 · FIG. 7` card with "3000 NODES · 83629 EDGES".

**Step 2: Thread the displayed / total edge counts**

The plate currently receives `edges` from `ExplorerShell.tsx` as `links.length`. After Task 2, that value is the filtered count. Add a new prop `edgesTotal?: number` to the plate. In `ExplorerShell.tsx`, pass `total.edges` as `edgesTotal`.

In the plate's render, change the count line to:
```tsx
{edgesTotal && edgesTotal !== edges
  ? <>{edges.toLocaleString()} OF {edgesTotal.toLocaleString()} EDGES</>
  : <>{edges.toLocaleString()} EDGES</>}
```

**Step 3: Lint and type-check**

Run:
```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website"
npx tsc --noEmit
npm run lint -- --max-warnings=0
```
Expected: no errors.

**Step 4: Visual QA**

Confirm via preview that the plate now reads `3,000 NODES · ~12,000 OF 83,629 EDGES` (exact numbers will vary with K=4).

**Step 5: Commit**

Run:
```bash
git add src/components/theseus/explorer/
git commit -m "feat(graph): show displayed/total edge count on Atlas plate"
```

---

### Task 8: Phase 1 verification pass

**Files:** none (verification only).

**Step 1: Full build**

Run:
```bash
cd "/Users/travisgilbert/Tech Dev Local/Creative/Website"
npm run build
```
Expected: clean build, no type errors, no lint errors.

**Step 2: Visual sweep**

With the dev server running, use the `preview_*` tools to verify:
1. Explorer canvas loads without crashing.
2. Edges read as faint wash, not dominant hatching.
3. Clusters are visibly distinct (the previous colored clumps should still be visible but no longer drowned).
4. Colors flow within each cluster over time (screenshot t=0 and t=2s and compare).
5. Hovering a point still promotes its incident edges (existing behavior, should be unaffected).
6. `prefers-reduced-motion` path slows the flow (toggle via system settings, confirm rotation slows).
7. Plate label reads "N OF TOTAL EDGES" honestly.

**Step 3: Commit the verification log**

If any smoke failed, fix in that task's file and append a fix commit. Once all seven smoke checks pass, proceed to Phase 2. If Phase 2 is deferred, this branch is ready to open a PR against `main`.

---

## Phase 2 — Atlas lens + Lens switcher

Phase 2 introduces the SceneDirective `render_target.lens` field, the switcher UI, the double-click shortcut, and the pinned-SBERT-UMAP Atlas lens with density overlay. Assumes Phase 1 is merged or on the same branch.

**Backend prerequisite:** the Atlas lens depends on `Object.layer_positions["sbert_umap"]` being returned by the graph endpoint. Before starting Task 12, confirm with the Index-API repo that this field is serialized (check `research_api/apps/notebook/api_views.py` and serializers). If not, add a Phase 2a task there first; the Website-repo work can scaffold a Flow-position fallback in the meantime.

### Task 9: Extend SceneDirective with `render_target.lens`

**Files:**
- Modify: `src/lib/theseus-viz/SceneDirective.ts`

**Step 1: Add the lens discriminator**

Locate the `RenderTarget` type (or the `render_target` field within `SceneDirective`). Add:
```typescript
export type LensId = 'flow' | 'atlas' | 'clusters';

export interface RenderTarget {
  // ... existing fields ...
  lens?: LensId; // default 'flow'
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. Any consumer that did not specify `lens` keeps working because the field is optional.

**Step 3: Commit**

Run:
```bash
git add src/lib/theseus-viz/SceneDirective.ts
git commit -m "feat(viz): add render_target.lens to SceneDirective"
```

---

### Task 10: Handle `lens` in `applySceneDirective`

**Files:**
- Modify: `src/lib/theseus/cosmograph/adapter.ts`

**Step 1: Add a `handleLens` function**

Add a handler that reads `directive.render_target?.lens ?? 'flow'` and calls a new `GraphAdapter.setLens(lens)` method. In the adapter's `applySceneDirective`, call `handleLens` before the salience and camera handlers.

**Step 2: Add `setLens` to the adapter interface**

In the adapter's imperative API (the ref type exported by `CosmosGraphCanvas`), add:
```typescript
setLens: (lens: LensId) => void;
```

In `CosmosGraphCanvas.tsx`, implement `setLens` as a no-op for Phase 1 compatibility and a real implementation once Tasks 12 and 14 land. The no-op lets Phase 1 keep passing type checks while Phase 2 proceeds.

**Step 3: Commit**

Run:
```bash
git add src/lib/theseus/cosmograph/adapter.ts src/components/theseus/explorer/CosmosGraphCanvas.tsx
git commit -m "feat(viz): route SceneDirective.render_target.lens through adapter"
```

---

### Task 11: Backend handshake — confirm or add `layer_positions["sbert_umap"]`

**Files:** (Index-API repo)
- Grep: `research_api/apps/notebook/api_views.py`, `serializers.py`
- Possibly modify: serializer to include `layer_positions` keyed by layer name

This task crosses the repo boundary. If the field is already present, mark this task complete with a one-line note. If not, produce a follow-up plan in Index-API; block Task 12 on that plan.

**Step 1: Check serialization**

Run: `grep -rn "layer_positions" "/Users/travisgilbert/Tech Dev Local/Creative/Website/Index-API/research_api/apps/notebook/"`

**Step 2: Confirm payload**

If the grep returns serializer usage, hit the API locally and confirm the field is present on a sample response. If present, commit a note in this repo:
```bash
git commit --allow-empty -m "docs(graph): confirmed Index-API returns layer_positions.sbert_umap"
```
If absent, stop and request a plan in the Index-API repo. Phase 2 blocked until that lands.

---

### Task 12: Atlas lens config path

**Files:**
- Modify: `src/components/theseus/explorer/CosmosGraphCanvas.tsx`

**Step 1: Implement `setLens`**

Replace the no-op from Task 10 with a real implementation. On lens change:
- If switching to `atlas`: destroy the current `Graph` via `graph.destroy()` (claim 8cceb062a8cf), recreate with `enableSimulation: false`, `fitViewOnInit: true`, and use `layer_positions["sbert_umap"]` values written into `pool.positions`. Points missing the layer render in "pending" visual (cluster-centered, desaturated, 0.6x size, hollow) per claim 70ed7abc215d.
- If switching from `atlas` back to `flow`: destroy and recreate with the Flow config from Task 3.
- If the target lens is the same as the current lens: no-op.

**Step 2: Wrap the destroy/recreate in an opacity crossfade**

Animate the canvas container's `opacity` from 1 to 0 over 300ms, destroy, recreate, then fade back to 1 over 300ms. Total 600ms, matches `focus-and-fit` recipe timing.

**Step 3: Verify**

Manual test via the upcoming lens switcher (Task 14) or a temporary dev button.

**Step 4: Commit**

Run:
```bash
git add src/components/theseus/explorer/CosmosGraphCanvas.tsx
git commit -m "feat(graph): implement Atlas lens config + crossfade"
```

---

### Task 13: Atlas density overlay (GPU heatmap)

**Files:**
- Create: `src/components/theseus/explorer/AtlasDensityLayer.tsx` (React wrapper around a canvas-2d or Graph-provided heatmap)
- Modify: `CosmosGraphCanvas.tsx` to host the layer behind the Graph canvas

Follow cosmos-pro recipe `gpu-heatmap-overlay.md`. Use a parchment → terracotta warm ramp via `cssVarToRgba('--vie-parchment', 0)` to `cssVarToRgba('--vie-terra', 0.6)`. The layer reads the same `pool.positions` as the Graph and renders a density field behind it.

**Step 1 through 4:** follow the recipe's code shape. Commit as `feat(graph): add Atlas lens density overlay`.

---

### Task 14: Lens switcher UI

**Files:**
- Create: `src/components/theseus/explorer/atlas/LensSwitcher.tsx`
- Modify: `ExplorerShell.tsx` to mount the switcher next to the existing control cluster

**Step 1: Build the switcher**

Three text buttons: `FLOW`, `ATLAS`, `CLUSTERS`. Active lens underlined with a one-line rough.js stroke. Keyboard: `1`, `2`, `3` switch directly; `Tab` cycles. Clicking or pressing a key dispatches a `theseus:set-lens` window event with the target lens id.

**Step 2: Wire to `CosmosGraphCanvasHandle.setLens`**

In `ExplorerShell.tsx`, subscribe to `theseus:set-lens` and call `canvasRef.current?.setLens(lens)`.

**Step 3: Visual QA via preview_*** then commit as `feat(graph): lens switcher UI + keyboard shortcuts`.

---

### Task 15: Double-click Flow → Atlas shortcut

**Files:**
- Modify: `CosmosGraphCanvas.tsx`

**Step 1: Add click-timestamp guard**

Track the last `onClick` timestamp. If a second click on empty canvas (no `onPointClick` between them) happens within 300ms and the current lens is `flow`, dispatch `theseus:set-lens` with `'atlas'`.

**Step 2: Visual QA** then commit as `feat(graph): double-click Flow canvas → Atlas lens`.

---

### Task 16: Phase 2 verification pass

Full build + lint + visual sweep across all three lenses (Flow, Atlas). Clusters still stubbed. Commit as `test(graph): Phase 2 verification log`.

---

## Phase 3 — Clusters Lens

Phase 3 introduces the Clusters lens: labeled communities, rough.js hulls, resolution slider, inter-cluster bundled edges.

**Backend prerequisite:** `community_ids_by_resolution` field on each Object in the graph payload. Same verify-or-add pattern as Task 11.

### Task 17: Backend handshake — `community_ids_by_resolution`

Mirror Task 11. Either confirm or block on Index-API follow-up.

### Task 18: Resolution slider component

**Files:**
- Create: `src/components/theseus/explorer/atlas/ResolutionSlider.tsx`

Three-stop slider (coarse / medium / fine) wired to a local lens state. Medium default.

### Task 19: Clusters lens config path

Extend `setLens` in `CosmosGraphCanvas.tsx` to support `'clusters'`: settle simulation for ~2 seconds with current Flow config, then freeze by setting `simulationDecay: 1` and calling `graph.start(0)` to stop updates. Apply pinned positions from that moment.

### Task 20: Rough.js cluster hulls

**Files:**
- Create: `src/components/theseus/explorer/ClusterHulls.tsx`

For each cluster, compute a 2D convex hull (use an existing library if available, or a small inline implementation), expand by a 12px margin, and render via rough.js with `roughness: 1.6`, `bowing: 1.8`, fill-style `'hachure'`, hachure gap ~14px. Tint from the palette per cluster.

### Task 21: Inter-cluster bundled edges

Aggregate edges between communities (sum weights). Draw as thick straight lines between cluster centroids. Skip self-loops.

### Task 22: Cluster labels always visible

At current zoom, render each cluster's label at its centroid. Use `--font-metadata`, ALL CAPS, letter-spacing 0.14em.

### Task 23: Phase 3 verification pass

Full build + lint + visual sweep. All three lenses must work and switch cleanly.

---

## Exit criteria (whole plan)

- `npm run build` is clean.
- `npm run lint` returns zero errors and zero warnings on files touched by this plan.
- All three lenses render without console errors for a 3,000-node / 83,629-edge graph.
- Edges rendered at overview in Flow lens is under 15,000.
- No hardcoded hex or float RGB triplets in `CosmosGraphCanvas.tsx`, `useGraphData.ts`, or any new file (grep for `#[0-9a-fA-F]{3,6}` and numeric RGB tuples).
- No em or en dashes anywhere in new code, comments, or UI copy (grep for `—` and `–`).
- Visual smoke screenshots attached to the final PR.

## Known risks and mitigations

- **Flow never settles.** Monitor GPU / battery. If an issue surfaces on low-end hardware, drop `simulationDecay` to 60000 and let the sim freeze after 60 seconds.
- **Atlas recreation flickers.** If the 600ms crossfade is not enough, extend to 800ms and add a `will-change: opacity` hint to the container.
- **SBERT UMAP coverage partial.** Handled by pending-visual fallback. If coverage is under 80%, flag to the user before Phase 2 ship.
- **rough.js performance with many hulls.** If over 20 clusters, switch to a single `<canvas>` rough.js layer rather than per-hull SVG. Defer optimization until observed.

## Reference skills

- `superpowers:executing-plans` — required for task-by-task execution.
- `superpowers:verification-before-completion` — apply before closing each task.
- cosmos-pro critic — run `/cosmos-pro:cosmos` after each phase.
