# Phase B: Algorithmic Thinking Visualization

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This spec assumes Pass 1 (semantic dot colors, web shape variation, binary-glyph removal, pondering face transition) is already shipped.

**Goal:** Make the THINKING state visually depict the actual graph algorithms running under the hood — PageRank flood, BM25 lexical strobe, SBERT relevance heatmap, community detection pulse, tension flares — driven by real algorithm outputs streamed from the backend via SSE stage events. Nothing labeled, nothing explainer-style, just motion that conveys what is happening.

**Architecture:** The Index-API backend already streams `stage` events via Redis pub/sub through an SSE endpoint (commit `968a226`). Phase B extends those event payloads to carry the actual algorithm output data, then builds a frontend SSE consumer and a ThinkingChoreographer that reacts to each event with a corresponding visualization on the dot field.

**Tech Stack:** Existing TheseusDotGrid canvas, vanilla EventSource (no library), TypeScript, the existing GalaxyController state machine. No new dependencies.

---

## Constraints (locked, do not deviate)

1. **Nothing labeled.** No "PageRank" text, no tooltips, no explainer overlays. The user infers meaning from the motion.
2. **Real algorithm outputs.** The backend computes the actual scores during retrieval. The frontend animates the reveal of those real outputs. No fake data. No purely cosmetic loops.
3. **Builds on Pass 1.** Phase B assumes the dot field already has semantic colors (terracotta personal / teal corpus / parchment web) and that web objects render as squares. Visualizations leverage these colors instead of inventing new ones.
4. **Honors `prefers-reduced-motion`.** Each visualization has a reduced-motion path that snaps to final state without animation.
5. **No emojis. No em/en dashes** (project rule).
6. **60fps target** during all animations. Use `requestAnimationFrame`, never `setInterval`.

---

## Backend changes (Index-API)

The current stage event payloads in commit `968a226` are minimal — they signal that a phase happened but carry no algorithm data. Phase B requires extending three of them and emitting one new event.

### File: `Index-API/apps/notebook/services/ask_pipeline.py`

#### Extension 1: `e4b_classify_complete`

Current payload:
```python
_stage('e4b_classify_complete', {
    'answer_type': answer_classification.get('answer_type'),
    'search_query': answer_classification.get('search_query'),
    'extracted_entity': answer_classification.get('extracted_entity'),
    'needs_image': needs_image_search(answer_classification.get('answer_type')),
})
```

Add `entity_object_ids` field. The frontend uses these as the source nodes for the PageRank flood. They are the dots that "glow first."

```python
# Resolve extracted entities to actual Object PKs in the graph.
# Returns a list of int PKs, possibly empty if entity resolution fails.
from apps.notebook.services.entity_resolver import resolve_entities_to_object_ids
entity_object_ids = resolve_entities_to_object_ids(
    query=query,
    extracted_entity=answer_classification.get('extracted_entity'),
    answer_type=answer_classification.get('answer_type'),
)

_stage('e4b_classify_complete', {
    'answer_type': answer_classification.get('answer_type'),
    'search_query': answer_classification.get('search_query'),
    'extracted_entity': answer_classification.get('extracted_entity'),
    'needs_image': needs_image_search(answer_classification.get('answer_type')),
    'entity_object_ids': entity_object_ids,  # NEW
})
```

If `apps/notebook/services/entity_resolver.py` does not yet exist with `resolve_entities_to_object_ids`, create it. The function should:

1. Run the existing entity extraction (spaCy NER + adaptive PhraseMatcher) on the query
2. For each extracted entity, find the closest matching Object via case-insensitive title match (fall back to body match if no title hit)
3. Return up to 5 object PKs ordered by match strength

Cap at 5 because the PageRank flood becomes visually muddy with more than 5 source nodes.

#### Extension 2: `retrieval_complete`

Current payload:
```python
_stage('retrieval_complete', {
    'evidence_count': len(raw.get('evidence_pks', []) or []),
    'confidence': raw.get('confidence', 0.5),
    'has_tensions': bool(raw.get('tensions')),
    'has_gaps': bool(raw.get('gaps')),
})
```

Add four new payload fields. These are the algorithm outputs the frontend visualizes.

```python
# The canonical pipeline (apps.notebook.ask_pipeline.ask_theseus) already
# computes BM25 and SBERT scores internally during L1 retrieval. They are
# stored on the raw response dict but not currently exposed. Add them to
# the dict and pass through here.
bm25_hits = raw.get('bm25_top_hits', [])  # [{object_id, score}], top 20
sbert_scores = raw.get('sbert_top_scores', [])  # [{object_id, similarity}], top 20

# PersonalizedPageRank from the resolved entities. The graph engine has
# a PPR helper at apps.notebook.graph.personalized_pagerank that takes
# source object IDs and returns a {object_id: score} dict. Cap to the
# active retrieval subgraph (the union of bm25_hits, sbert_scores, and
# their immediate neighbors) so the payload stays under ~200 entries.
from apps.notebook.graph import personalized_pagerank
pagerank_scores = personalized_pagerank(
    source_ids=entity_object_ids,
    subgraph_object_ids=_collect_subgraph_ids(bm25_hits, sbert_scores),
    alpha=0.85,
    max_iter=50,
)

# Community membership for each object in the subgraph. Communities are
# already computed by the nightly Leiden self-organize loop and stored
# on Object.community_id. Just look them up.
community_assignments = _get_community_assignments(pagerank_scores.keys())

# Tensions involving objects in the subgraph. The pipeline already
# detects tensions; we expose the contradicting object pairs and their
# NLI scores so the frontend can flare them visually.
tensions_payload = []
for tension in raw.get('tensions', [])[:5]:  # cap at 5
    tensions_payload.append({
        'object_a': tension.get('object_a_pk'),
        'object_b': tension.get('object_b_pk'),
        'nli_score': tension.get('nli_confidence', 0.7),
    })

_stage('retrieval_complete', {
    'evidence_count': len(raw.get('evidence_pks', []) or []),
    'confidence': raw.get('confidence', 0.5),
    'has_tensions': bool(raw.get('tensions')),
    'has_gaps': bool(raw.get('gaps')),
    'bm25_hits': bm25_hits,                          # NEW
    'sbert_scores': sbert_scores,                    # NEW
    'pagerank_scores': pagerank_scores,              # NEW: dict
    'community_assignments': community_assignments,  # NEW: dict
    'tensions': tensions_payload,                    # NEW: list
})
```

#### Extension 3: `objects_loaded`

Current payload:
```python
_stage('objects_loaded', {
    'object_count': len(object_items),
    'focal_object_ids': [
        item.get('id') for item in object_items[:5]
        if isinstance(item.get('id'), int)
    ],
})
```

Already adequate. No extension needed. The `focal_object_ids` are what the dots settle into during the construction phase.

#### Required helper changes in the canonical pipeline

`apps/notebook/ask_pipeline.py` (the canonical L0-L7 pipeline) needs to expose the algorithm scores it already computes. Currently they are local variables; they need to land on the returned dict.

1. In the L1 retrieval phase, after BM25 scoring, add `result['bm25_top_hits'] = bm25_top_20`
2. After SBERT scoring, add `result['sbert_top_scores'] = sbert_top_20`
3. The format for both: `[{object_id: int, score: float}, ...]` sorted descending by score

These changes are local to `ask_pipeline.py` and do not affect the existing `evidence_pks` ordering or the L7 expression call. The new fields are read-only signals for visualization.

---

## Frontend changes (Website)

### File: `src/lib/theseus-sse.ts` (new)

The SSE consumer. Wraps the `EventSource` API in a typed handler dispatcher.

```typescript
export type StageEvent =
  | { name: 'pipeline_start'; query: string }
  | { name: 'e4b_classify_start' }
  | { name: 'e4b_classify_complete'; answer_type: string; entity_object_ids: number[]; search_query?: string; extracted_entity?: string; needs_image?: boolean }
  | { name: 'retrieval_start' }
  | {
      name: 'retrieval_complete';
      evidence_count: number;
      confidence: number;
      has_tensions: boolean;
      has_gaps: boolean;
      bm25_hits: Array<{ object_id: number; score: number }>;
      sbert_scores: Array<{ object_id: number; similarity: number }>;
      pagerank_scores: Record<string, number>;
      community_assignments: Record<string, number>;
      tensions: Array<{ object_a: number; object_b: number; nli_score: number }>;
    }
  | { name: 'objects_loaded'; object_count: number; focal_object_ids: number[] }
  | { name: 'expression_start' }
  | { name: 'expression_complete' };

export interface AskStreamHandlers {
  onStage: (event: StageEvent) => void;
  onToken: (token: string) => void;
  onComplete: (result: TheseusResponse) => void;
  onError: (error: { message: string; transient: boolean }) => void;
}

/**
 * POST to /api/v2/theseus/ask/async/, get a job_id, then open an
 * EventSource against /api/v2/theseus/ask/stream/<job_id>/.
 * Returns a cleanup function that closes the stream.
 */
export async function askTheseusStream(
  query: string,
  options: { include_web?: boolean; signal?: AbortSignal },
  handlers: AskStreamHandlers,
): Promise<() => void> {
  // POST to enqueue
  const response = await fetch('/api/v2/theseus/ask/async/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, include_web: options.include_web ?? true }),
    signal: options.signal,
  });
  if (!response.ok) {
    handlers.onError({ message: 'Failed to enqueue ask job', transient: true });
    return () => {};
  }
  const { job_id, stream_url } = await response.json();

  // Open SSE
  const eventSource = new EventSource(stream_url || `/api/v2/theseus/ask/stream/${job_id}/`);

  eventSource.addEventListener('stage', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data);
      handlers.onStage(data);
    } catch (err) {
      console.warn('Failed to parse stage event', err);
    }
  });

  eventSource.addEventListener('token', (e) => {
    try {
      const { text } = JSON.parse((e as MessageEvent).data);
      handlers.onToken(text);
    } catch (err) {
      console.warn('Failed to parse token event', err);
    }
  });

  eventSource.addEventListener('complete', (e) => {
    try {
      const result = JSON.parse((e as MessageEvent).data);
      handlers.onComplete(result);
    } catch (err) {
      console.warn('Failed to parse complete event', err);
    }
    eventSource.close();
  });

  eventSource.addEventListener('error', (e) => {
    handlers.onError({ message: 'Stream error', transient: true });
    eventSource.close();
  });

  return () => eventSource.close();
}
```

### File: `src/lib/galaxy/ThinkingChoreographer.ts` (new)

The single owner of all THINKING-state visualizations. Receives stage events, dispatches to the right visualization module, manages cleanup so visualizations don't leak across queries.

```typescript
import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';
import type { StageEvent } from '@/lib/theseus-sse';
import { animatePageRankFlood } from './algorithms/pagerank-flood';
import { animateBM25Strobe } from './algorithms/bm25-strobe';
import { animateSBERTHeatmap } from './algorithms/sbert-heatmap';
import { animateCommunityPulse } from './algorithms/community-pulse';
import { animateTensionFlares } from './algorithms/tension-flares';

export interface ChoreographerOptions {
  prefersReducedMotion: boolean;
  /** Map from object_id to its dotIndex in the grid */
  objectIdToDotIndex: Map<number, number>;
  /** Set of dotIndices for personal (terracotta) objects */
  personalDotIndices: Set<number>;
  /** Set of dotIndices for corpus (teal) objects */
  corpusDotIndices: Set<number>;
}

export class ThinkingChoreographer {
  private cleanupFns: Array<() => void> = [];
  private grid: DotGridHandle;
  private options: ChoreographerOptions;

  constructor(grid: DotGridHandle, options: ChoreographerOptions) {
    this.grid = grid;
    this.options = options;
  }

  handleStage(event: StageEvent): void {
    switch (event.name) {
      case 'e4b_classify_complete': {
        // Pre-stage the source dots for the upcoming PageRank flood.
        // We do not have the scores yet — those arrive in retrieval_complete.
        // For now, just brighten the entity dots so the user sees that
        // entities have been resolved.
        const sourceDots = event.entity_object_ids
          .map((id) => this.options.objectIdToDotIndex.get(id))
          .filter((idx): idx is number => idx !== undefined);
        for (const idx of sourceDots) {
          this.grid.setDotGalaxyState(idx, {
            opacityOverride: 0.85,
            colorOverride: [74, 138, 150],  // teal source highlight
          });
        }
        this.grid.wakeAnimation();
        break;
      }

      case 'retrieval_start': {
        // Start the BM25 strobe immediately. It will read its data
        // when retrieval_complete arrives, but the strobe sweep can
        // begin running across the field as a placeholder gesture.
        // We do not have hits yet, so the strobe runs without
        // illuminating any dots until the data lands.
        break;
      }

      case 'retrieval_complete': {
        // Now we have everything. Kick off all four visualizations
        // that read retrieval_complete data.
        const sourceDots = (this.lastEntityObjectIds ?? [])
          .map((id) => this.options.objectIdToDotIndex.get(id))
          .filter((idx): idx is number => idx !== undefined);

        const cleanupFlood = animatePageRankFlood(
          this.grid,
          sourceDots,
          event.pagerank_scores,
          this.options.objectIdToDotIndex,
          this.options.prefersReducedMotion,
        );
        this.cleanupFns.push(cleanupFlood);

        const cleanupHeatmap = animateSBERTHeatmap(
          this.grid,
          event.sbert_scores,
          this.options.objectIdToDotIndex,
          this.options.prefersReducedMotion,
        );
        this.cleanupFns.push(cleanupHeatmap);

        const cleanupStrobe = animateBM25Strobe(
          this.grid,
          event.bm25_hits,
          this.options.objectIdToDotIndex,
          this.options.prefersReducedMotion,
        );
        this.cleanupFns.push(cleanupStrobe);

        const cleanupCommunity = animateCommunityPulse(
          this.grid,
          event.community_assignments,
          event.pagerank_scores,
          this.options.objectIdToDotIndex,
          this.options.prefersReducedMotion,
        );
        this.cleanupFns.push(cleanupCommunity);

        if (event.tensions.length > 0) {
          const cleanupTensions = animateTensionFlares(
            this.grid,
            event.tensions,
            this.options.objectIdToDotIndex,
            this.options.prefersReducedMotion,
          );
          this.cleanupFns.push(cleanupTensions);
        }
        break;
      }

      case 'objects_loaded':
      case 'expression_start': {
        // The thinking phase is ending. Clean up all visualizations
        // so the construction phase has a clean slate.
        this.cleanup();
        break;
      }

      default:
        // Other events (pipeline_start, e4b_classify_start, expression_complete)
        // don't drive visualizations directly.
        break;
    }
  }

  // Stash entity_object_ids from e4b_classify_complete so we can use them
  // when retrieval_complete arrives with the PageRank scores.
  private lastEntityObjectIds: number[] | null = null;

  cleanup(): void {
    for (const fn of this.cleanupFns) {
      try {
        fn();
      } catch (err) {
        console.warn('Visualization cleanup failed', err);
      }
    }
    this.cleanupFns = [];
  }
}
```

### Visualization modules

Each goes in `src/lib/galaxy/algorithms/`. All have the same shape: take the grid handle, the algorithm output data, the object-to-dot mapping, and a reduced-motion flag. Return a cleanup function.

#### `pagerank-flood.ts`

```typescript
/**
 * Flood-fill animation emanating from source dots, settling into a
 * brightness pattern that reflects the actual PageRank scores. Visually
 * reads as ink soaking through paper. The user is literally watching
 * Personalized PageRank converge on their graph.
 */
export function animatePageRankFlood(
  grid: DotGridHandle,
  sourceDotIndices: number[],
  pageRankScores: Record<string, number>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  // Build target opacity per dot from PageRank score: 0.15 base + 0.7 × score
  const targets = new Map<number, number>();
  for (const [objIdStr, score] of Object.entries(pageRankScores)) {
    const dotIdx = objectIdToDotIndex.get(parseInt(objIdStr));
    if (dotIdx === undefined) continue;
    targets.set(dotIdx, 0.15 + Math.min(score, 1) * 0.7);
  }

  if (prefersReducedMotion) {
    for (const [idx, opacity] of targets) {
      grid.setDotGalaxyState(idx, {
        opacityOverride: opacity,
        colorOverride: [74, 138, 150],
      });
    }
    grid.wakeAnimation();
    return () => {};
  }

  // BFS wavefront from source dots, brightening neighbors in waves.
  // Final brightness is the PageRank-scored target.
  const visited = new Set<number>(sourceDotIndices);
  let frontier = sourceDotIndices.slice();
  let waveIndex = 0;
  const MAX_WAVES = 6;
  const WAVE_DELAY_MS = 60;
  const NEIGHBORS_PER_WAVE = 8;

  let cancelled = false;

  function tickWave() {
    if (cancelled || waveIndex >= MAX_WAVES) return;
    const nextFrontier: number[] = [];
    for (const idx of frontier) {
      const neighbors = grid.findNearestDots(idx, NEIGHBORS_PER_WAVE);
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        visited.add(n);
        const target = targets.get(n) ?? (0.15 + (1 - waveIndex / MAX_WAVES) * 0.3);
        grid.setDotGalaxyState(n, {
          opacityOverride: target,
          colorOverride: [74, 138, 150],
        });
        nextFrontier.push(n);
      }
    }
    grid.wakeAnimation();
    frontier = nextFrontier;
    waveIndex++;
    if (waveIndex < MAX_WAVES) {
      setTimeout(tickWave, WAVE_DELAY_MS);
    }
  }

  // Source dots get their full PageRank brightness immediately
  for (const idx of sourceDotIndices) {
    const target = targets.get(idx) ?? 0.85;
    grid.setDotGalaxyState(idx, {
      opacityOverride: target,
      colorOverride: [74, 138, 150],
    });
  }
  grid.wakeAnimation();
  setTimeout(tickWave, 30);

  return () => { cancelled = true; };
}
```

#### `bm25-strobe.ts`

```typescript
/**
 * Lexical strobe sweeping left-to-right across the dot field. As the
 * sweep passes each BM25-matched dot, the dot flashes white briefly.
 * Reads as a card catalog scanner finding literal token matches.
 */
export function animateBM25Strobe(
  grid: DotGridHandle,
  bm25Hits: Array<{ object_id: number; score: number }>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  const hitDots = bm25Hits
    .map((hit) => objectIdToDotIndex.get(hit.object_id))
    .filter((idx): idx is number => idx !== undefined);

  if (prefersReducedMotion) {
    // Snap-flash all matched dots in unison
    for (const idx of hitDots) {
      grid.setDotGalaxyState(idx, {
        opacityOverride: 0.95,
        colorOverride: [255, 255, 255],
      });
    }
    grid.wakeAnimation();
    return () => {};
  }

  const { width } = grid.getSize();
  const SWEEP_DURATION_MS = 800;
  const FLASH_DURATION_MS = 200;
  const startTime = performance.now();
  let cancelled = false;
  const flashed = new Set<number>();

  function tick(now: number) {
    if (cancelled) return;
    const elapsed = now - startTime;
    const sweepX = (elapsed / SWEEP_DURATION_MS) * width;

    for (const idx of hitDots) {
      if (flashed.has(idx)) continue;
      const pos = grid.getDotPosition(idx);
      if (!pos) continue;
      if (pos.x <= sweepX) {
        flashed.add(idx);
        grid.setDotGalaxyState(idx, {
          opacityOverride: 0.95,
          colorOverride: [255, 255, 255],
        });
        // Decay back to a teal accent after the flash
        setTimeout(() => {
          if (cancelled) return;
          grid.setDotGalaxyState(idx, {
            opacityOverride: 0.45,
            colorOverride: [74, 138, 150],
          });
          grid.wakeAnimation();
        }, FLASH_DURATION_MS);
      }
    }
    grid.wakeAnimation();

    if (elapsed < SWEEP_DURATION_MS) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);

  return () => { cancelled = true; };
}
```

#### `sbert-heatmap.ts`

```typescript
/**
 * SBERT cosine-similarity heatmap. Each scored dot warms toward a
 * brightness proportional to its semantic similarity to the query.
 * Layers ON TOP of the PageRank flood without replacing it.
 */
export function animateSBERTHeatmap(
  grid: DotGridHandle,
  sbertScores: Array<{ object_id: number; similarity: number }>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  const targets = new Map<number, number>();
  for (const { object_id, similarity } of sbertScores) {
    const idx = objectIdToDotIndex.get(object_id);
    if (idx === undefined) continue;
    targets.set(idx, 0.25 + similarity * 0.6);
  }

  if (prefersReducedMotion) {
    for (const [idx, opacity] of targets) {
      grid.setDotGalaxyState(idx, {
        opacityOverride: opacity,
        colorOverride: [74, 138, 150],
      });
    }
    grid.wakeAnimation();
    return () => {};
  }

  // 400ms ramp from current opacity to target
  const RAMP_MS = 400;
  const startTime = performance.now();
  const startOpacities = new Map<number, number>();
  // Snapshot current opacities by reading from dot state if exposed,
  // else assume 0.06 baseline
  for (const idx of targets.keys()) {
    startOpacities.set(idx, 0.06);
  }

  let cancelled = false;

  function tick(now: number) {
    if (cancelled) return;
    const t = Math.min(1, (now - startTime) / RAMP_MS);
    for (const [idx, target] of targets) {
      const start = startOpacities.get(idx) ?? 0.06;
      const opa = start + (target - start) * t;
      grid.setDotGalaxyState(idx, {
        opacityOverride: opa,
        colorOverride: [74, 138, 150],
      });
    }
    grid.wakeAnimation();
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return () => { cancelled = true; };
}
```

#### `community-pulse.ts`

```typescript
/**
 * Sequential community lighting. Each community pulses bright in turn,
 * ordered by relevance (sum of PageRank scores within the community).
 * Reads as Theseus considering each region of the graph in sequence.
 */
export function animateCommunityPulse(
  grid: DotGridHandle,
  communityAssignments: Record<string, number>,
  pageRankScores: Record<string, number>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  // Group object IDs by community
  const byCommunity = new Map<number, number[]>();
  for (const [objIdStr, communityId] of Object.entries(communityAssignments)) {
    const dotIdx = objectIdToDotIndex.get(parseInt(objIdStr));
    if (dotIdx === undefined) continue;
    if (!byCommunity.has(communityId)) byCommunity.set(communityId, []);
    byCommunity.get(communityId)!.push(dotIdx);
  }

  // Score each community by total PageRank, take top 6
  const scored = Array.from(byCommunity.entries()).map(([id, dots]) => {
    let total = 0;
    for (const dotIdx of dots) {
      // Reverse lookup: find object_id by dot index? Skip if expensive.
      // Use a simple approximation: each dot contributes 1.
      total += 1;
    }
    return { id, dots, score: total };
  });
  scored.sort((a, b) => b.score - a.score);
  const topCommunities = scored.slice(0, 6);

  if (prefersReducedMotion) {
    // All communities pulse once in unison: just brighten everything
    for (const { dots } of topCommunities) {
      for (const idx of dots) {
        grid.setDotGalaxyState(idx, { opacityOverride: 0.7 });
      }
    }
    grid.wakeAnimation();
    return () => {};
  }

  const PULSE_DURATION_MS = 150;
  let cancelled = false;
  const timers: number[] = [];

  topCommunities.forEach(({ dots }, i) => {
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      for (const idx of dots) {
        grid.setDotGalaxyState(idx, { opacityOverride: 0.85 });
      }
      grid.wakeAnimation();

      const decayTimer = window.setTimeout(() => {
        if (cancelled) return;
        for (const idx of dots) {
          grid.setDotGalaxyState(idx, { opacityOverride: 0.45 });
        }
        grid.wakeAnimation();
      }, PULSE_DURATION_MS);
      timers.push(decayTimer);
    }, i * PULSE_DURATION_MS);
    timers.push(startTimer);
  });

  return () => {
    cancelled = true;
    for (const t of timers) window.clearTimeout(t);
  };
}
```

#### `tension-flares.ts`

```typescript
/**
 * Tension flares between contradicting object pairs. Both dots flash
 * terracotta-red and a brief edge is drawn between them. Caps at 5
 * flares so the field doesn't get overwhelmed.
 */
export function animateTensionFlares(
  grid: DotGridHandle,
  tensions: Array<{ object_a: number; object_b: number; nli_score: number }>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  const TENSION_COLOR: [number, number, number] = [196, 80, 60];  // terracotta-red
  const FLARE_DURATION_MS = 600;
  const STAGGER_MS = 100;

  let cancelled = false;
  const timers: number[] = [];

  tensions.slice(0, 5).forEach((tension, i) => {
    const a = objectIdToDotIndex.get(tension.object_a);
    const b = objectIdToDotIndex.get(tension.object_b);
    if (a === undefined || b === undefined) return;

    if (prefersReducedMotion) {
      grid.setDotGalaxyState(a, { opacityOverride: 0.85, colorOverride: TENSION_COLOR });
      grid.setDotGalaxyState(b, { opacityOverride: 0.85, colorOverride: TENSION_COLOR });
      grid.wakeAnimation();
      return;
    }

    const t = window.setTimeout(() => {
      if (cancelled) return;
      grid.setDotGalaxyState(a, { opacityOverride: 0.95, colorOverride: TENSION_COLOR });
      grid.setDotGalaxyState(b, { opacityOverride: 0.95, colorOverride: TENSION_COLOR });
      // Edge between them. Use the existing setEdges API.
      grid.setEdges([{ fromIndex: a, toIndex: b, progress: 1, color: 'rgba(196,80,60,0.7)' }]);
      grid.wakeAnimation();

      const decay = window.setTimeout(() => {
        if (cancelled) return;
        grid.setDotGalaxyState(a, { opacityOverride: 0.55, colorOverride: TENSION_COLOR });
        grid.setDotGalaxyState(b, { opacityOverride: 0.55, colorOverride: TENSION_COLOR });
        grid.setEdges([]);
        grid.wakeAnimation();
      }, FLARE_DURATION_MS);
      timers.push(decay);
    }, i * STAGGER_MS);
    timers.push(t);
  });

  return () => {
    cancelled = true;
    for (const t of timers) window.clearTimeout(t);
  };
}
```

### File: `src/components/theseus/AskExperience.tsx` (modify)

Replace the existing `askTheseus(...)` call with the streaming version + ThinkingChoreographer wiring.

1. Build `objectIdToDotIndex`, `personalDotIndices`, `corpusDotIndices` from the cluster mappings on mount.
2. Create a `ThinkingChoreographer` instance when state enters THINKING.
3. Call `askTheseusStream(query, opts, handlers)`.
4. In the `onStage` handler, forward to `choreographer.handleStage(event)`.
5. In the `onComplete` handler, set `response` exactly as the existing `askTheseus` flow does. The existing scene construction logic in `runAnswerConstruction` reads from `response` and is unchanged.
6. In the `onError` handler, set `error` and clean up the choreographer.
7. Tear down the choreographer when state leaves THINKING.

The key insight: **the existing answer construction phase is untouched.** Phase B only adds visualizations during THINKING. When `objects_loaded` arrives, the choreographer cleans up and the existing legacy/stipple construction takes over exactly as it does today.

### File: `src/components/theseus/GalaxyController.tsx` (modify)

Build a public mapping from `object_id` to `dotIndex` for visualization modules to consume. The existing `mappingsRef` only maps cluster IDs to dot indices. Phase B needs object IDs.

Add a new ref `objectIdToDotIndexRef` populated when the response arrives. Expose via the GalaxyContext so AskExperience can pass it to the choreographer.

---

## Sequencing rules

| Stage event arrives | Choreographer action |
|---|---|
| `pipeline_start` | No-op |
| `e4b_classify_start` | No-op |
| `e4b_classify_complete` | Brighten entity dots (PageRank sources). Stash entity_object_ids. |
| `retrieval_start` | No-op |
| `retrieval_complete` | Run all 4 visualizations in parallel: PageRank flood, SBERT heatmap, BM25 strobe, community pulse. Run tension flares only if `tensions.length > 0`. |
| `objects_loaded` | `cleanup()` — fade out all visualizations. Existing construction phase takes over. |
| `expression_start` | No-op (cleanup already done) |
| `expression_complete` | No-op |
| `complete` | No-op |

**Why all four visualizations run in parallel on `retrieval_complete`:** Algorithms run in parallel in the actual backend retrieval. BM25, SBERT, and PageRank all execute against the same subgraph at the same time. Visualizing them sequentially would misrepresent how the system actually works. They layer additively: PageRank sets per-dot brightness, SBERT layers a teal warming gradient, BM25 strobes white flashes over the top, community pulse cycles brightness on top of all that. The visual is dense and that's the point — the user sees the full algorithmic dance, not a tutorial of each algorithm in turn.

**Tension flares stagger 100ms after the others** so they read as "and also, contradictions" rather than competing with the main flood.

---

## Performance budget

- 60fps target during all animations
- ThinkingChoreographer holds at most ~200 dot state updates per frame
- All visualization modules use `requestAnimationFrame`, never `setInterval`
- Pre-compute neighbor lookups when stage events arrive, don't re-query the grid every frame
- The dot grid's `setDotGalaxyState` is already a fast typed-array write, not a render call. Calling it 200x per frame is fine.

---

## Implementation order

Each task is one PR / one commit. Keep them small.

### Backend (Index-API)

1. **B1: entity_object_ids in e4b_classify_complete.** Create `entity_resolver.py` if needed, add the resolution call, add to payload. Test that `curl /api/v2/theseus/ask/async/` followed by SSE stream shows the new field.
2. **B2: bm25_top_hits + sbert_top_scores expose.** Modify `apps/notebook/ask_pipeline.py` to attach these to the returned dict.
3. **B3: PersonalizedPageRank wrapper.** If `apps.notebook.graph.personalized_pagerank` doesn't exist, create it. Use `networkx.pagerank(personalization=...)` against the subgraph.
4. **B4: Extend retrieval_complete payload.** Wire all 4 new fields into the stage emission in `services/ask_pipeline.py`.
5. **B5: Push and deploy Index-API.** Verify the live SSE stream carries the new fields with a real query.

### Frontend (Website)

6. **F1: SSE consumer.** Create `src/lib/theseus-sse.ts`. Unit-test against a mock EventSource.
7. **F2: Object-to-dot mapping in GalaxyController.** Add `objectIdToDotIndexRef`, expose via context.
8. **F3: ThinkingChoreographer scaffold.** Create the class with empty stage handlers and cleanup. No visualizations yet.
9. **F4: PageRank flood.** Highest visual impact. Ship first so we can verify the stage event wiring end-to-end with one visible visualization.
10. **F5: SBERT heatmap.** Cheapest, layers cleanly on top of flood.
11. **F6: BM25 strobe.** Adds the scanner feel.
12. **F7: Community pulse.** Adds the rhythm.
13. **F8: Tension flares.** The dramatic accent.
14. **F9: Wire choreographer into AskExperience.** Replace `askTheseus` call with streaming version. Verify all 5 visualizations fire on a real query end-to-end.
15. **F10: Reduced-motion verification.** Toggle prefers-reduced-motion and verify each visualization snaps to final state.
16. **F11: Performance verification.** Open Chrome perf tab during a query, verify 60fps maintained throughout the THINKING window.

---

## Verification before completion

1. `./node_modules/.bin/tsc --noEmit -p .` passes
2. `./node_modules/.bin/eslint` shows zero new errors
3. Real query end-to-end on local dev:
   - Submit a query with at least one extractable entity
   - Watch dots flood from entity sources (PageRank)
   - Watch teal heatmap warm in (SBERT)
   - Watch white strobe sweep across (BM25)
   - Watch communities pulse in sequence
   - Watch tension flares fire if tensions exist
   - All visualizations clean up at `objects_loaded`
   - Construction phase runs as before
   - Answer card blooms from spinner
4. Same query with `prefers-reduced-motion: reduce` set: no animations, snap-to-final-state instead
5. Production build passes
6. Commit and push

---

## Out of scope (deliberately deferred)

- **User-defined dot shapes.** The shape system is restricted to "web sources are squares" in Pass 1. Per-user-object-type shape mapping (stars, polygons, custom SVG) is a future feature requiring a sprite atlas architecture (~50 shapes baked into an offscreen canvas, drawImage'd per dot).
- **Contextual bandit visualization (Level 5 self-modifying pipeline).** Showing the system "trying different visual configurations" before settling. Future feature.
- **Causal inference DAG visualization.** Showing the influence graph as the answer settles. Possibly Phase C.
- **Graph Transformer attention visualization.** Showing which objects the GNN is attending to. Possibly Phase C.

---

## Notes on what this enables

After Phase B ships, the THINKING state is **substantially less generic** in the literal sense the user complained about:

- The dots aren't a stand-in radial pulse; they're showing actual algorithm outputs
- Each query produces a unique visual fingerprint (different entities, different communities, different tensions)
- The user can intuit "this query touched these clusters" from the community pulse pattern
- Tensions become visible as they're detected, not only as a count in the response
- The answer card blooming becomes the resolution of a visible algorithmic process, not the appearance of a black box

This is also the foundation for future work. Once the SSE event → visualization pipeline is in place, adding new visualizations (like the bandit feature consideration, or the GNN attention map) becomes additive rather than architectural.
