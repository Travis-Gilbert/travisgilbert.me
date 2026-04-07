# Phase B Frontend Audit (Task F0)

Date: 2026-04-07
Scope: ground Phase B (algorithmic thinking visualization) tasks F1 to F9 in real file/line facts before any code lands. No code changes here.

## 1. DotGridHandle API snapshot

`src/components/theseus/TheseusDotGrid.tsx:88-147` (verbatim):

```ts
export interface DotGridHandle {
  /** Total number of dots in the current grid */
  getDotCount(): number;
  /** Get grid position of dot at index */
  getDotPosition(index: number): { x: number; y: number } | null;
  /** Set galaxy state for a single dot */
  setDotGalaxyState(index: number, state: Partial<GalaxyDotState>): void;
  /** Batch set galaxy state for multiple dots */
  batchSetGalaxyState(updates: Array<{ index: number; state: Partial<GalaxyDotState> }>): void;
  /**
   * Override the rendered shape of a single dot. shapeId 0 = use the
   * existing kind logic (circle or binary glyph). shapeId 1 = render as
   * a square regardless of kind. Used by Pass 1a to mark web-source
   * dots so they read as a different category from the circular field.
   */
  setDotShape(index: number, shapeId: number): void;
  /** Reset all shape overrides back to 0 (use kind). */
  clearDotShapes(): void;
  /**
   * Toggle whether dots with kind=1 (the '0' glyph) and kind=2 (the
   * '1' glyph) actually render their glyph. When set to false, all
   * dots draw as plain circles regardless of kind. Used by Pass 1b
   * to clear binary glyphs during the THINKING state because they
   * read as the universal AI cliche and obscure the algorithmic
   * visualizations Phase B will add.
   */
  setBinaryGlyphsEnabled(enabled: boolean): void;
  /** Set target rest position for a dot (spring physics pulls toward it) */
  setDotTarget(index: number, tx: number, ty: number): void;
  /** Reset dot target back to its original grid position */
  resetDotTarget(index: number): void;
  /** Get the original grid rest position for a dot (before any target drift) */
  getOriginalGridPosition(index: number): { x: number; y: number } | null;
  /** Reset all dots to grid positions and clear galaxy state */
  resetAll(): void;
  /** Enable or disable pointer-events on the canvas */
  setPointerEvents(enabled: boolean): void;
  /** Force animation to start (wake from idle) */
  wakeAnimation(): void;
  /** Draw edges between dot pairs on the canvas */
  setEdges(edges: Array<{ fromIndex: number; toIndex: number; progress: number; color: string }>): void;
  /** Draw labels at positions on the canvas */
  setLabels(labels: Array<{ x: number; y: number; text: string; alpha: number }>): void;
  /** Find nearest dot with a cluster mapping to a screen position */
  findNearestClusterDot(x: number, y: number): { index: number; clusterId: number; x: number; y: number } | null;
  /** Find the N nearest dots to a given dot index, sorted by distance */
  findNearestDots(dotIndex: number, count: number): number[];
  /** Get canvas dimensions */
  getSize(): { width: number; height: number };
  /** Set click-card data for canvas rendering (null to dismiss) */
  setClickCard(card: ClickCardInput | null): void;
  /** Set inline response bubble data for canvas rendering (null to dismiss) */
  setInlineResponse(response: InlineResponseInput | null): void;
  /** Set zoom/pan transform for canvas-native rendering */
  setZoomTransform(scale: number, panX: number, panY: number): void;
  /** Get current zoom transform */
  getZoomTransform(): { scale: number; panX: number; panY: number };
  /** Convert screen coordinates to canvas space (accounts for zoom/pan) */
  screenToCanvas(sx: number, sy: number): { x: number; y: number };
}
```

Quirks:
- `findNearestClusterDot` only returns dots that already have a cluster mapping (filtered, not raw nearest).
- `setEdges` takes a `progress` field (0 to 1) per edge. Phase B can drive ribbon-fade animations through this rather than allocating a new API.
- `setLabels` is fire-and-replace (one call replaces all labels). Phase B label work must batch.

## 2. GalaxyDotState shape

`src/components/theseus/TheseusDotGrid.tsx:50-66` (verbatim):

```ts
export interface GalaxyDotState {
  /** Cluster ID mapped to this dot index, or null for ambient */
  clusterId: number | null;
  /** Dominant object type in the cluster */
  objectType: string | null;
  /** Whether this dot is relevant to the current query */
  isRelevant: boolean;
  /** Target position for answer construction (canvas coords) */
  targetX: number | null;
  targetY: number | null;
  /** Override opacity (0 to 1), null = use default */
  opacityOverride: number | null;
  /** Override RGB color, null = use default teal */
  colorOverride: [number, number, number] | null;
  /** Override dot radius multiplier (1.0 = normal), null = use default */
  scaleOverride: number | null;
}
```

Phase B notes: `opacityOverride`, `colorOverride`, and `scaleOverride` already exist. Algorithm visualizations (BFS frontier, sort comparisons, etc.) can flash dots through these three knobs without extending the type. `targetX`/`targetY` already drive spring physics, so swarm reorganization is free.

## 3. GalaxyController integration points

File: `src/components/theseus/GalaxyController.tsx`.

- `ClusterDotMapping` interface declared at lines 162-169 (`{ clusterId, dotIndex, label, memberCount, topObjects, objectType }`).
- `mappingsRef` declared at line 208: `useRef<ClusterDotMapping[]>([])`.
- `objectDotMapRef` ALREADY EXISTS at line 216: `useRef<Map<string, number>>(new Map())` with the comment "Map from object_id to dot index for answer construction". Phase B should reuse this rather than introducing a parallel `objectIdToDotIndex` map. Note that the key is a string, not a number.
- Cluster-to-dot assignment loop runs at lines 328-400 inside the `useEffect` triggered by `clusters` state. The per-cluster `setDotGalaxyState` write happens at lines 388-394, and `mappingsRef.current = newMappings;` is committed at line 400. This is the natural piggyback site for populating any object-id keyed map at cluster time, but note that `objectDotMapRef` is currently keyed by object id and is populated elsewhere during answer construction, not during cluster mapping.
- There is NO `GalaxyContext`. `GalaxyController` is a plain function component with internal refs. No `createContext`, no `Provider`, no exported context value. F1 and beyond cannot "consume the GalaxyContext" as some spec language assumes; they must either lift the controller or have `GalaxyController` accept a new prop / expose a new ref-handle. See "Surprises" below.
- Refs of interest already living in `GalaxyController`: `mappingsRef`, `objectDotMapRef`, `recruitedDotsRef`, `originalPositionsRef`, `phaseRef`, `phaseTimerRef`, `stippleCleanupRef`, `stippleResultRef`, `faceTaggedRef`, `predTypeRef`. None are exposed externally today.

## 4. AskExperience call site

`src/components/theseus/AskExperience.tsx:875-905` window (verbatim, with line numbers):

```tsx
875	      setState('THINKING');
876	      pushState('THINKING');
877	      clearSourceTrail();
878	
879	      // Fire viz prediction in parallel: does not block the ask call
880	      import('@/lib/theseus-viz/vizPlanner').then(({ predictVizType }) => {
881	        predictVizType(activeQuery).then((prediction) => {
882	          if (isStale()) return;
883	          pushVizPrediction(prediction);
884	        }).catch(() => {});
885	      }).catch(() => {});
886	
887	      // Run e4b vision classification in parallel (frontend keyword classifier)
888	      // This warms vision models speculatively based on query signals
889	      import('@/lib/galaxy/e4bVision').then(({ classify, needsImageSearch }) => {
890	        const classification = classify(activeQuery);
891	        if (isStale()) return;
892	        if (needsImageSearch(classification.answer_type)) {
893	          // Pre-warm vision models for image-based answer types
894	          import('@/lib/galaxy/modelLoader').then(({ getFaceModel }) => {
895	            getFaceModel().catch(() => {});
896	          }).catch(() => {});
897	        }
898	      }).catch(() => {});
899	
900	      const result = await askTheseus(activeQuery, {
901	        signal: controller.signal,
902	        timeoutMs: ASK_TIMEOUT_MS,
903	        retryPolicy: 'transient-once',
904	        include_web: true,
905	      });
```

State machine notes:
- `AskState` defined at line 396 as `'IDLE' | 'THINKING' | 'MODEL' | 'CONSTRUCTING' | 'EXPLORING'` (matches `EngineState` in TheseusDotGrid).
- THINKING is entered at lines 875-876 (`setState('THINKING'); pushState('THINKING')`). Initial state at line 709 also enters THINKING when `query` is preloaded from URL.
- THINKING is exited on error at lines 911-912 (back to IDLE) and otherwise after `result` resolves (continues into MODEL / CONSTRUCTING further down the function).
- The current call is non-streaming: `await askTheseus(...)` blocks until the full response. Phase B's SSE consumer needs to fire alongside this call (not replace it), then the choreographer reads streamed events and steers `GalaxyController` ref-handles before the awaited result lands.
- `askTheseus` is imported from `@/lib/theseus-api` (NOT `@/lib/ask-theseus`).

## 5. TheseusResponse type

- File: `src/lib/theseus-types.ts:3-23`. Exported as `interface TheseusResponse`. Phase B's SSE consumer should `import type { TheseusResponse } from '@/lib/theseus-types'`.
- Shape (fields Phase B cares about):
  - `query: string`
  - `answer?: string` (top-level v1-compatible answer)
  - `answer_agent?: string`
  - `mode: 'full' | 'brief' | 'objects_only'`
  - `confidence: ConfidenceScore`
  - `sections: ResponseSection[]` (this is where evidence_path / nodes / edges live, NOT a top-level `evidence_pks` array)
  - `metadata: ResponseMetadata`
  - `answer_type?: AnswerType`
  - `answer_classification?: AnswerClassification`
  - `geographic_regions?: GeographicRegionsSection`

There is NO `evidence_pks: number[]` and NO `tensions: ...` at the top level of `TheseusResponse`. Both must be derived from `sections` (evidence path nodes/edges) and from a separate tensions section if present. The Phase B spec language assuming `response.evidence_pks` and `response.tensions` is wrong against this codebase. F1 needs to either (a) update its choreographer to derive these from `sections`, or (b) require the SSE channel to deliver `evidence_pks` / `tensions` as discrete events keyed off the `ask_job_id`.

The other `Ask` shape, `AskRetrievalResponse` in `src/lib/ask-theseus.ts:59-70`, is a different (commonplace-scoped) contract with `retrieval.objects` / `retrieval.claims` / `answer`. Phase B should NOT use this one; it's not what `askTheseus` returns.

## 6. Reduced-motion hook

Already exists: `src/hooks/usePrefersReducedMotion.ts`, exported as `usePrefersReducedMotion()`. It wraps `useMediaQuery('(prefers-reduced-motion: reduce)')`. F9 does NOT need to add a new hook; just import this one.

`GalaxyController` and `TheseusDotGrid` already consume it (lines 196 and 176 respectively).

## 7. Adaptive-nav coordination note

I read `docs/plans/SPEC-ADAPTIVE-NAV.md` Batch 2 directly (lines 128-235). Adaptive-nav modifies the `TheseusDotGrid.tsx` physics tick loop in-place (recruiting dots into attractor pools that bypass the normal home-spring calculation, plus a new `useRef<NavAttractor[]>` and click hit-test). Phase B writes only through the public `DotGridHandle` API (`setDotGalaxyState`, `setDotTarget`, `setEdges`, `setLabels`, `setDotShape`) and never touches the physics loop, the attractor recruitment pool, or the click hit-test, so the two specs have zero code overlap and can land in either order; the only shared resource is the dot index space, which is cooperatively managed by recruitment sets that already exist.

## 8. Surprises / deviations from the execution plan

1. **No `GalaxyContext` exists.** The execution plan and the original spec language imply `GalaxyController` exposes a context that the choreographer can consume. It does not. Options for F1: (a) add a `useImperativeHandle` to `GalaxyController` and pass a `controllerRef` from `AskExperience` (cheapest, mirrors existing `gridRef` pattern), (b) lift `mappingsRef` / `objectDotMapRef` into a new `GalaxyContext` provider that wraps both `AskExperience` and `GalaxyController` (heavier refactor), or (c) push the choreographer logic into `GalaxyController` itself and let it react to a new prop. Recommend (a). This decision belongs in F1, not in F0.
2. **`objectDotMapRef` already exists** at `GalaxyController.tsx:216` keyed by `string`. Reuse it; do not create a parallel `objectIdToDotIndex` map. F1's "populate the object-id map" task collapses to "ensure the cluster-mapping useEffect also writes object ids it knows about" if/when applicable, or "document that the map is populated during answer construction, not at cluster time".
3. **`TheseusResponse` has no `evidence_pks` or `tensions` fields.** The Phase B spec assumption that the choreographer can read `response.evidence_pks` is wrong. F1 needs an explicit decision: derive from `sections` (find the `evidence_path` section, walk its `nodes` for ids), or get the SSE channel to push these as discrete events keyed by `ask_job_id`. The execution plan should be updated to call this out.
4. **`askTheseus` lives in `theseus-api.ts`, not `ask-theseus.ts`.** `ask-theseus.ts` is the commonplace-scoped retrieval client (`submitQuestion`, `AskRetrievalResponse`). The Phase B spec language conflates them; references to "the existing non-streaming client in `ask-theseus.ts`" should be retargeted to `theseus-api.ts`. Note also that `askTheseus` already supports SSE internally via `askTheseusStream` at `theseus-api.ts:753` — Phase B's SSE work may be able to extend that path rather than building a fully new `theseus-sse.ts`. F1 should look at `askTheseusStream` before deciding.
5. **`src/lib/galaxy/` does not collide with planned Phase B files.** Confirmed contents: `FaceAnimator.ts`, `ImageTracer.ts`, `SpatialConversation.ts`, `StipplingDirector.ts`, `StipplingEngine.ts`, `TargetGenerator.ts`, `TheseusAvatar.ts`, `VisionTracer.ts`, `e4bVision.ts`, `faceMeshTriangulation.ts`, `modelLoader.ts`, `pretextLabels.ts`, `renderers/`, `stippleConstruction.ts`. No `ThinkingChoreographer.ts` and no `algorithms/` subdirectory. Safe to add.
6. **`AskState` and `EngineState` are duplicate string-literal unions** with identical members but live in different files (`AskExperience.tsx:396` and `TheseusDotGrid.tsx:149`). Phase B should not introduce a third copy; pick one as canonical and import.
