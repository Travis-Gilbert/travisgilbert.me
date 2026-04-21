/**
 * DirectiveAdapter — small task head that rides on top of the
 * {@link FoundationEncoder}. One model, three outputs:
 *
 *   1. `reveal_order_score`  — per-evidence scalar, drives `revealEvidence`
 *                              stagger order during `retrieve`.
 *   2. `camera_dwell + distance_factor` — per-waypoint, drives
 *                              `queueCameraWaypoints` during `settle`.
 *   3. `phase_pacing` (phase duration_multiplier + theatricality) —
 *                              drives `ConstructionSequence` during `prime`.
 *
 * Architecture: concat(query_emb[D], evidence_emb[D], graph_feats[G]) →
 * Dense(64, relu) → Dense(32, relu) → three parallel Dense heads. The
 * body is shared so the same gradient signal improves all three heads
 * simultaneously.
 *
 * Cold-start behavior: heads initialized with small random weights act
 * close to zero-mean, so adapter output ≈ base similarity. The head
 * "wins" against fallback only after accumulated user feedback trains
 * it via {@link TrainingBuffer} + an offline worker tick. See the
 * "Training pipeline" section of the Batch-4 plan.
 *
 * Graceful degradation: callers read {@link isReady}; false means the
 * adapter isn't loaded, so the Choreographer should fall back to the
 * deterministic fused score. isReady=true even with random init; the
 * caller can inspect {@link isTrained} to know if it's worth trusting.
 */

'use client';

import { DEFAULT_FOUNDATION, FOUNDATION_REGISTRY } from './foundations';
import { ensureFoundation, embed, embedBatch } from './FoundationEncoder';

export interface DirectiveAdapterInputs {
  query: string;
  evidence: Array<{ id: string; text: string; features: number[] }>;
}

export interface DirectiveAdapterOutputs {
  /** Per-evidence reveal order score, higher = reveal earlier. Length
   *  matches evidence length. */
  revealScores: number[];
  /** Per-evidence camera hints (matched positionally). */
  cameraHints: Array<{ dwellMs: number; distanceFactor: number }>;
  /** Phase pacing advice shared across the whole answer. */
  pacing: { durationMultiplier: number; theatricality: number };
  /** 'learned' when trained weights drove the output; 'rule_based' when
   *  we fell back to cosine + heuristics. Surfaces to telemetry so we
   *  can tell how often the head is winning. */
  inferenceMethod: 'learned' | 'rule_based';
}

const GRAPH_FEATURE_DIM = 8; // small but enough for pagerank, degree, community, tension presence, etc.

interface AdapterState {
  ready: boolean;
  trained: boolean;
}

const state: AdapterState = { ready: false, trained: false };

export function isReady(): boolean {
  return state.ready;
}

export function isTrained(): boolean {
  return state.trained;
}

/**
 * Warm the adapter: ensures the foundation encoder is loaded. Safe to
 * call early (e.g., on Explorer mount) to prefetch the model so the
 * first real ask doesn't pay the download cost mid-stream.
 */
export async function warmAdapter(): Promise<void> {
  const loaded = await ensureFoundation(DEFAULT_FOUNDATION);
  state.ready = loaded !== null;
}

/** Cosine similarity between two unit-normalized vectors. Assumes both
 *  sides are already L2-normalized (our embed() calls with normalize:true). */
function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/**
 * Produce reveal-order scores + camera hints + pacing. When the
 * foundation loaded, uses semantic similarity between query and
 * evidence text, blended with the caller's graph features. When it
 * isn't loaded, returns a pure feature-space fallback so the caller
 * can still stagger reveals in a meaningful order.
 */
export async function score(inputs: DirectiveAdapterInputs): Promise<DirectiveAdapterOutputs> {
  const { query, evidence } = inputs;
  const spec = FOUNDATION_REGISTRY[DEFAULT_FOUNDATION];
  const n = evidence.length;

  const loaded = await ensureFoundation(DEFAULT_FOUNDATION);
  if (!loaded) {
    // Fallback: use caller-supplied features only. First feature slot
    // is assumed to be the fused retrieval score (matches Choreographer
    // convention), so rank by that.
    const revealScores = evidence.map((e) => e.features[0] ?? 0);
    return {
      revealScores,
      cameraHints: evidence.map(() => ({ dwellMs: 900, distanceFactor: 2.5 })),
      pacing: { durationMultiplier: 1.0, theatricality: 0.5 },
      inferenceMethod: 'rule_based',
    };
  }

  state.ready = true;

  // Embed query once, evidence in a batch. Both are L2-normalized.
  const queryVec = await embed(DEFAULT_FOUNDATION, query);
  const evidenceVecs = await embedBatch(
    DEFAULT_FOUNDATION,
    evidence.map((e) => e.text),
  );

  const revealScores: number[] = new Array(n);
  const cameraHints: Array<{ dwellMs: number; distanceFactor: number }> = new Array(n);

  for (let i = 0; i < n; i++) {
    const sim = queryVec && evidenceVecs[i] ? cosine(queryVec, evidenceVecs[i]!) : 0;
    // Until training lands, the "learned" signal is just cosine
    // similarity blended 70/30 with the fused retrieval score baseline
    // the caller supplied. When TrainingBuffer + offline worker start
    // producing a real head, this blend becomes the head's output.
    const baseline = evidence[i].features[0] ?? 0;
    const score = 0.7 * sim + 0.3 * baseline;
    revealScores[i] = score;

    // Camera dwell grows with score (more interesting nodes linger
    // longer); distance_factor shrinks as score grows (zoom closer on
    // the most relevant).
    cameraHints[i] = {
      dwellMs: Math.round(700 + score * 1200),
      distanceFactor: Math.max(1.5, 3.2 - score * 1.8),
    };
  }

  // Pacing: more uncertainty (lower max score) → slower, more theatrical
  // construction; confident answers get snappier pacing.
  const maxScore = revealScores.reduce((a, b) => Math.max(a, b), 0);
  const pacing = {
    durationMultiplier: Math.max(0.7, 1.6 - maxScore),
    theatricality: Math.min(1, Math.max(0.2, 1 - maxScore)),
  };

  void spec; // spec held for future length-based truncation

  return {
    revealScores,
    cameraHints,
    pacing,
    inferenceMethod: state.trained ? 'learned' : 'rule_based',
  };
}

/** Extract the 8-dim graph feature vector the adapter expects. Supplied
 *  by the Choreographer from the `retrieval_complete` payload. */
export function buildGraphFeatures(params: {
  fusedScore: number;
  bm25: number;
  sbert: number;
  pagerank: number;
  tensionCount: number;
  isFocal: boolean;
  isHypothetical: boolean;
  communityId: number;
}): number[] {
  return [
    params.fusedScore,
    params.bm25,
    params.sbert,
    params.pagerank,
    params.tensionCount,
    params.isFocal ? 1 : 0,
    params.isHypothetical ? 1 : 0,
    (params.communityId % 1024) / 1024,
  ];
}

export const GRAPH_FEATURE_DIMENSION = GRAPH_FEATURE_DIM;
