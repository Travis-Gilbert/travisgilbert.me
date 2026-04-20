'use client';

import type {
  ConstructionSequence,
  HypothesisEdgeStyle,
  HypothesisStyle,
  NodeSalience,
  SceneDirective,
  TopologyInterpretation,
} from '@/lib/theseus-viz/SceneDirective';

/** Focal label payload the canvas overlay renders via pretext. */
export interface FocalLabel {
  nodeId: string;
  text: string;
  priority: number;
}

/** Distance-tiered opacity multipliers used by setNeighborhoodGradient. */
export interface NeighborhoodTiers {
  /** Direct neighbors of evidence. */
  oneHop: number;
  /** Neighbors of neighbors. */
  twoHop: number;
  /** Everything further away. */
  rest: number;
}

/** Narrow operation surface exposed by the graph canvas to SceneDirective
 *  consumers. Hides the underlying Graph instance and id-to-index bookkeeping
 *  so callers don't reach into rendering internals. */
export interface GraphAdapter {
  focusNodes(ids: string[]): void;
  clearFocus(): void;
  zoomToNode(id: string, durationMs: number, distance: number): void;
  fitView(durationMs?: number, padding?: number): void;

  // --- Phase A: SceneDirective expansion ---

  /**
   * Apply per-node salience (scale, opacity, emissive). Does not clear
   * previously set encodings; call `clearEncoding()` to reset first.
   */
  setSalienceEncoding(salience: NodeSalience[]): void;

  /**
   * Apply per-edge hypothesis styling: width multiplier (visibility) and,
   * when supported, color override (VIE token). Edges not present in the
   * directive retain their baseline. `globalTentativeFactor` nudges the
   * baseline width of every non-overridden edge down as a global "there
   * is uncertainty in the answer" signal (0 = no nudge, 1 = 30% thinner).
   */
  setEdgeStyles(
    styles: HypothesisEdgeStyle[],
    globalTentativeFactor?: number,
  ): void;

  /**
   * Mix every node with `epistemic_role === 'hypothetical'` toward the
   * amber VIE token by `mixFactor` (0..1). Runs on top of the current
   * color buffer, so call after salience/gradient have been applied.
   * Passing `mixFactor = 0` or `has_hypothetical_content = false` at the
   * directive level is a no-op.
   */
  applyHypothesisColorMix(mixFactor: number): void;

  /**
   * Dim nodes outside the evidence neighborhood by hop distance. `rest`
   * covers every node further than `twoHop`. Multiplies into the alpha
   * channel established by `setSalienceEncoding`, so call after salience.
   */
  setNeighborhoodGradient(evidenceIds: string[], tiers: NeighborhoodTiers): void;

  /**
   * Drop all runtime encodings and restore galaxy baseline (type colors,
   * degree-scaled sizes, uniform link width/tint, full alpha).
   */
  clearEncoding(): void;

  /** Fit the view to a set of node ids (prefers multi-focal framing). */
  fitViewToNodes(ids: string[], durationMs: number, padding: number): void;

  /** Project a node to screen space for overlay positioning. */
  getProjectedPosition(nodeId: string): { x: number; y: number } | null;

  /** Stamp focal-node labels onto the 2D overlay via pretext. */
  setFocalLabels(labels: FocalLabel[]): void;

  /** Remove all focal labels from the overlay. */
  clearFocalLabels(): void;

  // --- Phase B: construction playback + filter hook ---

  /**
   * Play the construction sequence as a series of tween phases over the
   * already-encoded pool. Each phase interpolates from a snapshot of the
   * pool's current state toward the Phase A target state. Call after
   * every setter (salience, gradient, edge styles, color-mix) has run so
   * "target" buffers reflect the fully encoded answer.
   */
  playConstructionSequence(
    seq: ConstructionSequence,
    options?: { onComplete?: () => void },
  ): void;

  /**
   * Cancel any in-flight construction tweens and jump to the final
   * target state. Safe to call when no sequence is running.
   */
  cancelConstruction(): void;

  /**
   * Phase-C filter hook. When `ids === null` clears the filter mask and
   * every point returns to its current encoded alpha. When `ids` is an
   * array, points not in the list render at alpha 0 and their incident
   * links fade out. The mask applies on top of the encoded alpha, so
   * invoking setters after this call preserves the filter.
   */
  setVisibleIds(ids: string[] | null): void;
}

function readSalience(directive: SceneDirective): NodeSalience[] {
  return Array.isArray(directive.salience) ? directive.salience : [];
}

function readEdgeStyles(directive: SceneDirective): HypothesisEdgeStyle[] {
  const hyp = directive.hypothesis_style;
  if (!hyp || !Array.isArray(hyp.edge_styles)) return [];
  return hyp.edge_styles;
}

function readHypothesisStyle(directive: SceneDirective): HypothesisStyle | null {
  const hyp = directive.hypothesis_style;
  if (!hyp || typeof hyp !== 'object') return null;
  return hyp;
}

function readConstruction(directive: SceneDirective): ConstructionSequence | null {
  const c = (directive as { construction?: unknown }).construction as ConstructionSequence | undefined;
  if (!c || typeof c !== 'object' || !Array.isArray(c.phases)) return null;
  if (c.phases.length === 0) return null;
  return c;
}

/**
 * Narrow helper: expose topology to the UI (DirectiveBanner) from a
 * directive. Returns null when the directive omits the field. Pure:
 * safe to call outside React.
 */
export function readTopologyInterpretation(
  directive: SceneDirective | null | undefined,
): TopologyInterpretation | null {
  if (!directive) return null;
  const t = directive.topology;
  if (!t || typeof t !== 'object' || typeof t.primary_shape !== 'string') return null;
  return t;
}

/**
 * Pick evidence node ids from salience. Uses two signals since a rule-based
 * salience output may clamp importance low for low-gradual-strength nodes
 * even when they are clearly the returned evidence.
 */
function pickEvidenceIds(salience: NodeSalience[]): string[] {
  if (salience.length === 0) return [];
  const ids: string[] = [];
  for (const s of salience) {
    if (!s || typeof s.node_id !== 'string') continue;
    if (s.is_focal || s.importance >= 0.3 || s.suggested_opacity >= 0.5) {
      ids.push(s.node_id);
    }
  }
  // Fall back to the full salience set if thresholds exclude everyone but
  // salience still has entries; we always want evidence to bind to the
  // returned objects, not to 'nothing'.
  if (ids.length === 0) {
    for (const s of salience) {
      if (s && typeof s.node_id === 'string') ids.push(s.node_id);
    }
  }
  return ids;
}

function buildFocalLabels(
  salience: NodeSalience[],
  resolveText: (id: string) => string | undefined,
  limit = 3,
): FocalLabel[] {
  const candidates = salience
    .filter((s) => s && typeof s.node_id === 'string')
    .slice()
    .sort((a, b) => {
      // Focal wins, then lower label_priority wins, then higher importance.
      if (a.is_focal !== b.is_focal) return a.is_focal ? -1 : 1;
      if (a.label_priority !== b.label_priority) return a.label_priority - b.label_priority;
      return b.importance - a.importance;
    });

  const labels: FocalLabel[] = [];
  for (const s of candidates) {
    if (labels.length >= limit) break;
    const text = resolveText(s.node_id);
    if (!text) continue;
    labels.push({ nodeId: s.node_id, text, priority: s.label_priority });
  }
  return labels;
}

/**
 * Apply a full SceneDirective to the canvas. Setter order matters:
 * salience establishes the baseline per-point alpha; neighborhood gradient
 * multiplies into that alpha; edge styles modify link width/color; camera
 * frames focal nodes; labels stamp over the final rendered scene. Callers
 * pass `resolveLabelText` so the adapter stays Graph-agnostic.
 *
 * Intentionally-unread SceneDirective fields (deferred by the cosmos-pro
 * Phase C plan, not a coverage bug):
 *   - `context_shelf`         → Phase C+ cross-panel data surface, not
 *                               consumed by the canvas itself.
 *   - `force_config`          → cosmos.gl 3.0-beta has no exposed mid-sim
 *                               config hook. Revisit when upstream lands
 *                               a setSimulationConfig API.
 *   - `render_target`         → the Explorer is cosmos.gl only; render-
 *                               target dispatch happens one layer up in
 *                               sceneDirector/directive.ts.
 *   - `truth_map_topology`    → Phase C+ TMS surface, not the live canvas.
 *   - `inference_method` /    → metadata only, no render effect.
 *     `inference_time_ms`
 *   - `hypothesis_style.global_tentative_factor` and
 *     `hypothesis_style.has_hypothetical_content` are read by the canvas
 *     (edge-styles path and color-mix path respectively), so they're not
 *     in this list.
 */
export function applySceneDirective(
  adapter: GraphAdapter | null | undefined,
  directive: SceneDirective | null | undefined,
  options?: {
    resolveLabelText?: (nodeId: string) => string | undefined;
  },
): void {
  if (!adapter) return;

  if (!directive) {
    adapter.clearEncoding();
    return;
  }

  const salience = readSalience(directive);
  const edgeStyles = readEdgeStyles(directive);
  const hypothesisStyle = readHypothesisStyle(directive);
  const construction = readConstruction(directive);

  // Honest empty state: no encoding when the ask returned nothing.
  if (salience.length === 0 && edgeStyles.length === 0) {
    adapter.cancelConstruction();
    adapter.clearEncoding();
    return;
  }

  // A new directive always wins over an in-flight construction tween.
  adapter.cancelConstruction();

  const focal = salience
    .filter((s): s is typeof s & { is_focal: true; node_id: string } =>
      Boolean(s?.is_focal) && typeof s?.node_id === 'string')
    .map((s) => s.node_id);

  if (focal.length > 0) {
    adapter.focusNodes(focal);
  } else {
    adapter.clearFocus();
  }

  // 1. Per-node salience encoding.
  adapter.setSalienceEncoding(salience);

  // 2. Neighborhood gradient (richer Q6 tiers).
  const evidenceIds = pickEvidenceIds(salience);
  if (evidenceIds.length > 0) {
    adapter.setNeighborhoodGradient(evidenceIds, { oneHop: 0.4, twoHop: 0.2, rest: 0.1 });
  }

  // 3. Edge styles (hypothesis tint / width). Pass the global tentative
  // factor so the pool can nudge baseline widths when the answer has
  // hypothesis content.
  const globalTentative = hypothesisStyle?.global_tentative_factor ?? 0;
  adapter.setEdgeStyles(edgeStyles, globalTentative);

  // 4. Hypothesis color-mix on hypothesis-role nodes. Only runs when
  // the directive explicitly flags the answer as containing hypothetical
  // content; otherwise it's a no-op.
  if (hypothesisStyle?.has_hypothetical_content) {
    adapter.applyHypothesisColorMix(0.35);
  } else {
    adapter.applyHypothesisColorMix(0);
  }

  // 5. Camera polish: prefer multi-focal framing when the directive
  // surfaced more than one focal node. When construction is enabled we
  // defer the camera transition so it lands on the final frame rather
  // than snapping before nodes have appeared.
  const camera = directive.camera;
  const transitionDuration = camera?.transition_duration_ms ?? 800;
  const applyCamera = () => {
    if (focal.length > 1) {
      adapter.fitViewToNodes(focal, transitionDuration, 0.18);
      return;
    }
    const focalId = camera?.focal_node_id;
    if (focalId) {
      adapter.zoomToNode(focalId, transitionDuration, camera?.distance_factor ?? 3);
    }
  };

  // 6. Focal labels via pretext overlay. When construction is playing,
  // defer label stamp-in to the `labels_emerge` phase so they rise with
  // the animation rather than appearing instantly at t=0.
  const applyLabels = () => {
    if (options?.resolveLabelText) {
      const labels = buildFocalLabels(salience, options.resolveLabelText, 3);
      if (labels.length > 0) {
        adapter.setFocalLabels(labels);
      } else {
        adapter.clearFocalLabels();
      }
    } else {
      adapter.clearFocalLabels();
    }
  };

  if (construction) {
    // Clear labels immediately; the sequence will stamp them back in at
    // the right phase. This avoids a brief flash of old labels during
    // the first few hundred ms of the tween.
    adapter.clearFocalLabels();
    adapter.playConstructionSequence(construction, {
      onComplete: () => {
        applyLabels();
        applyCamera();
      },
    });
  } else {
    applyLabels();
    applyCamera();
  }
}
