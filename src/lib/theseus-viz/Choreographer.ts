/**
 * Choreographer — streaming-aware scene director.
 *
 * Subscribes to the 26B ask pipeline's SSE handlers and translates each
 * mid-stream event into a {@link SceneDirectivePatch} that's applied over
 * the live canvas encoding. Acts as the single owner of "when does the
 * graph react, and how" so ExplorerAskComposer stays thin.
 *
 * State machine (drives patch intent, not literal DOM state):
 *
 *   idle
 *     └─ pipeline_start        → anticipate  (clear last answer)
 *   anticipate
 *     ├─ classify_complete     → prime       (answer_type now known)
 *     └─ retrieval_complete    → retrieve    (scores arrived)
 *   prime
 *     └─ retrieval_complete    → retrieve
 *   retrieve
 *     ├─ objects_loaded        → focus       (camera moves)
 *     └─ first token           → speak       (objects_loaded skipped)
 *   focus
 *     └─ first token           → speak
 *   speak
 *     ├─ answer_ready          → settle      (full directive applied)
 *     └─ complete              → linger      (answer_ready skipped)
 *   settle
 *     └─ complete              → linger
 *   {any}
 *     ├─ error                 → idle
 *     └─ reset()               → idle
 *
 * Honors prefers-reduced-motion by short-circuiting to a single directive
 * pass on `complete` (no mid-stream patches emitted).
 */

'use client';

import type {
  AsyncStreamHandlers,
  ProgressiveVisualPayload,
  StageEvent,
} from '@/lib/theseus-api';
import type { NodeSalience } from '@/lib/theseus-viz/SceneDirective';
import type { TheseusResponse } from '@/lib/theseus-types';
import { score as scoreDirective } from '@/lib/theseus-viz/model/DirectiveAdapter';
import { directScene } from '@/lib/theseus-viz/SceneDirector';
import {
  applySceneDirective,
  applySceneDirectivePatch,
  type GraphAdapter,
  type SceneDirectivePatch,
} from '@/lib/theseus/cosmograph/adapter';

export type ChoreographerState =
  | 'idle'
  | 'anticipate'
  | 'prime'
  | 'retrieve'
  | 'focus'
  | 'speak'
  | 'settle'
  | 'linger';

export interface ChoreographerOptions {
  /** Ref-like accessor to the live canvas adapter. Called on every patch so
   *  the Choreographer can cope with the adapter binding late (canvas mounts
   *  async) or rebinding (unmount / remount). */
  getAdapter: () => GraphAdapter | null | undefined;
  /** Resolves a node id to display text for focal labels. */
  resolveLabelText?: (nodeId: string) => string | undefined;
  /** Resolves a node id to searchable text for the foundation encoder
   *  (title + description / body preview). Omitting this forces the
   *  Choreographer to fall back to deterministic fused-score ordering. */
  resolveEvidenceText?: (nodeId: string) => string | undefined;
  /** Invoked whenever the FSM transitions. Useful for devtools / telemetry. */
  onStateChange?: (next: ChoreographerState, prev: ChoreographerState) => void;
  /** When true, the Choreographer skips mid-stream patches and only applies
   *  the final directive on `complete`. Wire this to
   *  `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. */
  prefersReducedMotion?: boolean;
  /** Optional maximum number of salient nodes to glow mid-retrieval. Default
   *  12 matches the Batch 1 heuristic and keeps the canvas legible. */
  retrievalTopK?: number;
  /** Set to false to bypass the DirectiveAdapter (foundation model + head)
   *  and use only rule-based salience ordering. Default true, with graceful
   *  fallback if the foundation fails to load. */
  enableLearnedScoring?: boolean;
}

/** Fuse bm25 + sbert + pagerank into a per-object score, normalize across
 *  each signal's own max so one dominant signal can't mask the others, take
 *  top K, and mark the first 3 as focal. */
function buildRetrievalSalience(
  event: Extract<StageEvent, { name: 'retrieval_complete' }>,
  topK: number,
): NodeSalience[] {
  const scores = new Map<number, { bm25: number; sbert: number; pagerank: number }>();
  const ensure = (id: number) => {
    let row = scores.get(id);
    if (!row) {
      row = { bm25: 0, sbert: 0, pagerank: 0 };
      scores.set(id, row);
    }
    return row;
  };
  for (const hit of event.bm25_hits) ensure(hit.object_id).bm25 = hit.score;
  for (const hit of event.sbert_scores) ensure(hit.object_id).sbert = hit.similarity;
  for (const [key, value] of Object.entries(event.pagerank_scores)) {
    const id = Number(key);
    if (Number.isFinite(id)) ensure(id).pagerank = value;
  }

  const maxBm25 = Math.max(1e-6, ...Array.from(scores.values(), (s) => s.bm25));
  const maxSbert = Math.max(1e-6, ...Array.from(scores.values(), (s) => s.sbert));
  const maxPr = Math.max(1e-6, ...Array.from(scores.values(), (s) => s.pagerank));

  const fused = Array.from(scores.entries())
    .map(([id, s]) => ({
      id,
      score: 0.4 * (s.bm25 / maxBm25) + 0.4 * (s.sbert / maxSbert) + 0.2 * (s.pagerank / maxPr),
    }))
    .sort((a, b) => b.score - a.score);

  return fused.slice(0, topK).map((row, i) => {
    const isFocal = i < 3;
    return {
      node_id: String(row.id),
      importance: row.score,
      visual_weight: row.score,
      is_focal: isFocal,
      label_priority: isFocal ? i : 10 + i,
      suggested_scale: 0.7 + 0.8 * row.score,
      suggested_opacity: 0.55 + 0.45 * row.score,
      suggested_emissive: isFocal ? 0.25 : 0.08 * row.score,
    } satisfies NodeSalience;
  });
}

export class Choreographer {
  private state: ChoreographerState = 'idle';
  private readonly options: ChoreographerOptions;
  private answerReadyApplied = false;
  private latestVisual: ProgressiveVisualPayload | null = null;
  private lastQuery = '';

  constructor(options: ChoreographerOptions) {
    this.options = options;
  }

  /** Build an AsyncStreamHandlers bundle ready to pass into
   *  {@link askTheseusAsyncStream}. Pass-through hooks let the caller add
   *  React-state updates without owning the scene logic. */
  observe(passthrough?: {
    onStage?: (event: StageEvent) => void;
    onToken?: (token: string) => void;
    onVisualDelta?: (payload: ProgressiveVisualPayload) => void;
    onAnswerReady?: (result: TheseusResponse) => void;
    onVisualComplete?: (payload: ProgressiveVisualPayload) => void;
    onComplete?: (result: TheseusResponse) => void;
    onError?: (error: { message: string; transient: boolean }) => void;
  }): AsyncStreamHandlers {
    let sawToken = false;

    return {
      onStage: (event) => {
        this.handleStage(event);
        passthrough?.onStage?.(event);
      },
      onToken: (token) => {
        if (!sawToken) {
          sawToken = true;
          this.transition('speak');
        }
        passthrough?.onToken?.(token);
      },
      onVisualDelta: (payload) => {
        this.latestVisual = payload;
        passthrough?.onVisualDelta?.(payload);
      },
      onAnswerReady: async (result) => {
        await this.handleAnswerReady(result);
        passthrough?.onAnswerReady?.(result);
      },
      onVisualComplete: (payload) => {
        this.latestVisual = payload;
        passthrough?.onVisualComplete?.(payload);
      },
      onComplete: async (result) => {
        await this.handleComplete(result);
        passthrough?.onComplete?.(result);
      },
      onError: (error) => {
        this.transition('idle');
        passthrough?.onError?.(error);
      },
    };
  }

  /** Drop all in-flight state. Call on cancel / clear / new ask. */
  reset(): void {
    this.answerReadyApplied = false;
    this.latestVisual = null;
    this.transition('idle');
  }

  currentState(): ChoreographerState {
    return this.state;
  }

  latestVisualPayload(): ProgressiveVisualPayload | null {
    return this.latestVisual;
  }

  private transition(next: ChoreographerState): void {
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    this.options.onStateChange?.(next, prev);
  }

  private applyPatch(patch: SceneDirectivePatch): void {
    if (this.options.prefersReducedMotion) return;
    applySceneDirectivePatch(this.options.getAdapter(), patch, {
      resolveLabelText: this.options.resolveLabelText,
    });
  }

  private handleStage(event: StageEvent): void {
    switch (event.name) {
      case 'pipeline_start': {
        this.answerReadyApplied = false;
        this.latestVisual = null;
        this.lastQuery = typeof event.query === 'string' ? event.query : '';
        this.transition('anticipate');
        this.applyPatch({ reset: true });
        break;
      }
      // Event producer is now the 26B external classifier; the SSE event
      // name is legacy (pending backend rename).
      case 'e4b_classify_complete': {
        this.transition('prime');
        break;
      }
      case 'retrieval_complete': {
        this.transition('retrieve');
        const topK = this.options.retrievalTopK ?? 12;
        const salience = buildRetrievalSalience(event, topK);
        if (salience.length === 0) break;
        this.applyRetrievalPatch(salience);
        break;
      }
      case 'objects_loaded': {
        this.transition('focus');
        const focalIds = event.focal_object_ids.map((id) => String(id));
        if (focalIds.length === 0) break;
        this.applyPatch({
          focus: { ids: focalIds },
          camera: { kind: 'fit', ids: focalIds, durationMs: 900, padding: 0.22 },
        });
        break;
      }
      default:
        break;
    }
  }

  /** Fire the retrieve patch. When the DirectiveAdapter is enabled AND we
   *  have a text resolver, kick off a learned re-ranking in the background
   *  and apply a refined patch when it resolves. The first deterministic
   *  patch fires immediately so the canvas still reacts instantly. */
  private applyRetrievalPatch(initialSalience: NodeSalience[]): void {
    const evidenceIds = initialSalience.map((s) => s.node_id);
    const basePatch: SceneDirectivePatch = {
      salience: initialSalience,
      neighborhood: { evidenceIds, tiers: { oneHop: 0.4, twoHop: 0.2, rest: 0.1 } },
      reveal_evidence: {
        nodeIds: evidenceIds,
        staggerMs: 110,
        durationMs: 700,
        easing: 'ease-out',
      },
    };
    this.applyPatch(basePatch);

    const useLearned =
      this.options.enableLearnedScoring !== false &&
      !this.options.prefersReducedMotion &&
      typeof this.options.resolveEvidenceText === 'function' &&
      this.lastQuery.length > 0;

    if (!useLearned) return;

    const resolveText = this.options.resolveEvidenceText!;
    const inputs = initialSalience
      .map((s) => {
        const text = resolveText(s.node_id);
        if (!text) return null;
        return {
          id: s.node_id,
          text,
          features: [s.importance, s.visual_weight, 0, 0, 0, s.is_focal ? 1 : 0, 0, 0],
        };
      })
      .filter((row): row is { id: string; text: string; features: number[] } => row !== null);

    if (inputs.length < 2) return; // re-ranking a single entry is moot.

    // Fire-and-forget: when the adapter resolves, re-apply a refined
    // reveal order. If a later state has already transitioned out of
    // `retrieve` we silently drop the result so we don't stomp on `focus`.
    scoreDirective({ query: this.lastQuery, evidence: inputs })
      .then((result) => {
        if (this.state !== 'retrieve' && this.state !== 'prime') return;
        const ranked = inputs
          .map((row, i) => ({ id: row.id, score: result.revealScores[i] ?? 0 }))
          .sort((a, b) => b.score - a.score);
        const refinedIds = ranked.map((r) => r.id);
        this.applyPatch({
          reveal_evidence: {
            nodeIds: refinedIds,
            staggerMs: Math.round(110 * result.pacing.durationMultiplier),
            durationMs: Math.round(700 * result.pacing.durationMultiplier),
            easing: 'ease-out',
          },
        });
      })
      .catch((err) => {
        console.warn('[Choreographer] DirectiveAdapter scoring failed', err);
      });
  }

  private async handleAnswerReady(result: TheseusResponse): Promise<void> {
    if (this.answerReadyApplied) return;
    this.answerReadyApplied = true;
    this.transition('settle');
    try {
      const directive = await directScene(result);
      // Stream mode: don't cancel the in-flight staggered reveal. The
      // encoded state refreshes under the tween and the reveal plays
      // through to the new targets naturally.
      applySceneDirective(this.options.getAdapter(), directive, {
        resolveLabelText: this.options.resolveLabelText,
        streamingMode: true,
      });
    } catch (err) {
      console.error('[Choreographer] directScene (onAnswerReady) failed', err);
    }
  }

  private async handleComplete(result: TheseusResponse): Promise<void> {
    this.transition('linger');
    // onAnswerReady already applied the directive with the full payload
    // (it fires 1-2ms before onComplete in the backend's burst release).
    // Running directScene again here just stomps the reveal. Only fall
    // back to applying on complete when onAnswerReady didn't fire
    // (older backend that skips that event).
    if (this.answerReadyApplied) return;
    try {
      const directive = await directScene(result);
      applySceneDirective(this.options.getAdapter(), directive, {
        resolveLabelText: this.options.resolveLabelText,
      });
    } catch (err) {
      console.error('[Choreographer] directScene (onComplete) failed', err);
    }
  }
}
