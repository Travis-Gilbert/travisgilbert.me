/**
 * stippleConstruction.ts
 *
 * Bridge between the stippling pipeline and GalaxyController.
 * Orchestrates the full flow: select renderer -> render offscreen ->
 * run stippling engine -> assign dots -> animate phases.
 *
 * This is the entry point GalaxyController calls instead of the old
 * generateTargets() path for non-image, non-geographic answers.
 */

import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';
import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { VizType } from '@/lib/theseus-viz/vizPlanner';
import { stipple, type StippleResult, type StippleTarget } from './StipplingEngine';
import {
  computeRecruitmentCount,
  assignDotsToTargets,
  identifyLoadBearingDots,
  type DotAssignment,
  type LoadBearingDot,
} from './StipplingDirector';
import { renderAnswer, renderArgumentView, renderDataVizAnswer, renderGeographicAnswer } from './renderers';
import type { OffscreenRenderResult } from './renderers/types';
import type { AnswerType, GeographicRegionsSection } from '@/lib/theseus-types';
import { getColorStrategy, type DotColorStrategy } from './e4bVision';
import { TYPE_COLORS } from '@/components/theseus/renderers/rendering';
import { resolveCollisions, clearLabelCache } from './pretextLabels';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function resolveDotColor(
  weight: number,
  nodeId: string | null | undefined,
  nodeMap: Map<string, EvidenceNode>,
  colorStrategy: DotColorStrategy | null,
): [number, number, number] | null {
  if (colorStrategy) return colorStrategy.colorForWeight(weight);
  const nodeType = nodeMap.get(nodeId ?? '')?.object_type ?? 'note';
  const typeColor = TYPE_COLORS[nodeType];
  return typeColor ? hexToRgb(typeColor) : null;
}

export interface StippleConstructionResult {
  assignments: DotAssignment[];
  stippleResult: StippleResult;
  loadBearingDots: LoadBearingDot[];
  /** IDs of all recruited galaxy dots (for cleanup) */
  recruitedDotIndices: Set<number>;
}

export interface StippleConstructionOptions {
  /** Override theatricality (0 = fast convergence, 1 = dramatic flight). Default from directive. */
  theatricality?: number;
  /** Skip the animated phasing, assign all dots instantly. For reduced motion. */
  instant?: boolean;
  /** Vega-Lite spec for data-viz answer types */
  vegaSpec?: Record<string, unknown>;
  /** Labels for data-viz semantic regions */
  vegaLabels?: string[];
  /** Backend answer type for renderer routing */
  answerType?: AnswerType;
  /** Reference image URL for image-based answer types */
  referenceImageUrl?: string | null;
  /** Geographic regions for map answers */
  geoSection?: GeographicRegionsSection;
}

/**
 * Run the full stippling construction pipeline.
 *
 * 1. Select and run the offscreen renderer based on vizType
 * 2. Run StipplingEngine (Lloyd's relaxation)
 * 3. Assign stipple targets to galaxy dots via StipplingDirector
 * 4. Return assignments for GalaxyController to animate
 */
export async function runStippleConstruction(
  vizType: VizType,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  directive: SceneDirective | null,
  grid: DotGridHandle,
  options: StippleConstructionOptions = {},
): Promise<StippleConstructionResult | null> {
  const { width, height } = grid.getSize();
  if (width === 0 || height === 0) return null;

  // Step 1: Render offscreen dual canvases
  let renderResult: OffscreenRenderResult | null = null;

  if (options.answerType === 'geographic' && options.geoSection) {
    // Geographic answer: use GeographicRenderer with optional reference image
    renderResult = await renderGeographicAnswer(
      options.referenceImageUrl,
      options.geoSection,
    );
  } else if (options.vegaSpec) {
    renderResult = await renderDataVizAnswer(options.vegaSpec, options.vegaLabels);
  } else {
    renderResult = renderAnswer(vizType, nodes, edges);
  }

  if (!renderResult) return null;

  // Step 2: Determine recruitment count
  const { dotCount } = computeRecruitmentCount(directive, width, height);

  // Step 3: Run stippling engine
  const stippleResult = stipple(renderResult, dotCount, {
    iterations: 10,
    snapshotInterval: 1,
    seed: 42,
    outputWidth: width,
    outputHeight: height,
  });

  if (stippleResult.targets.length === 0) return null;

  // Step 4: Assign stipple targets to galaxy dots
  const theatricality = options.theatricality ?? (directive?.construction?.theatricality ?? 0.5);

  // Gather all galaxy dot positions
  const totalDots = grid.getDotCount();
  const dotPositions: Array<{ x: number; y: number; index: number }> = [];
  for (let i = 0; i < totalDots; i++) {
    const pos = grid.getDotPosition(i);
    if (pos) {
      dotPositions.push({ x: pos.x, y: pos.y, index: i });
    }
  }

  const assignments = assignDotsToTargets(
    stippleResult.targets,
    dotPositions,
    theatricality,
  );

  // Step 5: Identify load-bearing dots
  const loadBearingDots = identifyLoadBearingDots(assignments, stippleResult.targets);

  const recruitedDotIndices = new Set(assignments.map((a) => a.galaxyDotIndex));

  return {
    assignments,
    stippleResult,
    loadBearingDots,
    recruitedDotIndices,
  };
}

/**
 * Animate the stippled construction on the galaxy grid.
 *
 * Drives dots from their galaxy positions to stippled targets in phases,
 * with non-recruited dots dimming to near-invisible.
 *
 * @returns Cleanup function to cancel pending timers
 */
export function animateStippleConstruction(
  grid: DotGridHandle,
  result: StippleConstructionResult,
  stippleTargets: StippleTarget[],
  nodes: EvidenceNode[],
  instant: boolean,
  answerType?: AnswerType,
): () => void {
  const timerIds: number[] = [];
  const { assignments, recruitedDotIndices } = result;
  const totalDots = grid.getDotCount();
  let aborted = false;

  // Pre-build node lookup to avoid O(n) scans per assignment
  const nodeMap = new Map(nodes.map((n) => [n.object_id, n]));

  // Per-type coloring: image-based types use weight-mapped colors,
  // layout types use existing TYPE_COLORS per node object_type
  const colorStrategy: DotColorStrategy | null = answerType ? getColorStrategy(answerType) : null;

  // Phase 0: Dim all non-recruited dots to near-invisible
  // This creates the dark canvas that makes the stippled shape pop
  for (let i = 0; i < totalDots; i++) {
    if (!recruitedDotIndices.has(i)) {
      grid.setDotGalaxyState(i, {
        opacityOverride: 0.003,
        scaleOverride: 0.5,
      });
    }
  }

  if (instant) {
    // Instant: assign all targets and make visible
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const target = stippleTargets[i];
      grid.setDotTarget(a.galaxyDotIndex, a.targetX, a.targetY);

      const weight = target?.weight ?? 0.5;
      const rgb = resolveDotColor(weight, target?.nodeId, nodeMap, colorStrategy);

      grid.setDotGalaxyState(a.galaxyDotIndex, {
        opacityOverride: 0.45 + weight * 0.35,
        colorOverride: rgb,
        scaleOverride: 1.8 + weight * 0.8,
        isRelevant: true,
      });
    }
    grid.wakeAnimation();

    return () => {};
  }

  // Group assignments by phase
  const maxPhase = Math.max(0, ...stippleTargets.map((t) => t.phase));
  const phaseGroups: Map<number, Array<{ assignment: DotAssignment; target: StippleTarget; node: EvidenceNode | undefined }>> = new Map();

  for (let i = 0; i < assignments.length && i < stippleTargets.length; i++) {
    const phase = stippleTargets[i].phase;
    const group = phaseGroups.get(phase) ?? [];
    group.push({
      assignment: assignments[i],
      target: stippleTargets[i],
      node: nodeMap.get(stippleTargets[i].nodeId ?? ''),
    });
    phaseGroups.set(phase, group);
  }

  // Animate each phase with staggered delays.
  // Slower pacing creates gravity: each phase has weight.
  const phaseDelay = 900; // ms between phases (was 600)
  const initialDelay = 400; // ms before first phase (was 200, let the dimming settle)

  for (let phase = 0; phase <= maxPhase; phase++) {
    const group = phaseGroups.get(phase);
    if (!group) continue;

    const delay = initialDelay + phase * phaseDelay;
    const timerId = window.setTimeout(() => {
      if (aborted) return;
      for (const { assignment, target, node } of group) {
        grid.setDotTarget(assignment.galaxyDotIndex, assignment.targetX, assignment.targetY);

        const rgb = resolveDotColor(target.weight, target.nodeId, nodeMap, colorStrategy);

        // Recruited dots are bright and physically larger than ambient
        grid.setDotGalaxyState(assignment.galaxyDotIndex, {
          opacityOverride: 0.35 + (target.weight) * 0.45,
          colorOverride: rgb,
          scaleOverride: 1.6 + (target.weight) * 0.8,
          isRelevant: true,
        });
      }
      grid.wakeAnimation();
    }, delay);
    timerIds.push(timerId);
  }

  // Crystallize: labels after all phases complete, with a breathing pause
  const crystallizeDelay = initialDelay + (maxPhase + 1) * phaseDelay + 800;
  const crystallizeTimer = window.setTimeout(() => {
    if (aborted) return;
    clearLabelCache();
    const rawLabels: Array<{ x: number; y: number; text: string; alpha: number }> = [];

    // Collect labels from node positions
    const labelledNodes = new Set<string>();
    for (let i = 0; i < assignments.length && i < stippleTargets.length; i++) {
      const target = stippleTargets[i];
      if (!target.nodeId || labelledNodes.has(target.nodeId)) continue;
      labelledNodes.add(target.nodeId);

      const node = nodeMap.get(target.nodeId ?? '');
      if (!node) continue;

      const label = node.title.length > 22 ? node.title.slice(0, 22) + '\u2026' : node.title;
      rawLabels.push({
        x: assignments[i].targetX,
        y: assignments[i].targetY,
        text: label,
        alpha: 0.7,
      });
    }

    const labelData = resolveCollisions(rawLabels);

    // Fade labels in slowly (more gravity)
    let step = 0;
    const steps = 10; // was 6: slower label reveal
    const labelInterval = window.setInterval(() => {
      step++;
      const t = step / steps;
      grid.setLabels(labelData.map((l) => ({ ...l, alpha: l.alpha * t })));
      grid.wakeAnimation();
      if (step >= steps) clearInterval(labelInterval);
    }, 60); // was 50ms: slightly slower tick
    timerIds.push(labelInterval);

    // Brighten recruited dots to final crystallized state
    for (let i = 0; i < assignments.length && i < stippleTargets.length; i++) {
      const target = stippleTargets[i];
      grid.setDotGalaxyState(assignments[i].galaxyDotIndex, {
        opacityOverride: 0.55 + (target.weight) * 0.3,
        scaleOverride: 2.0 + (target.weight) * 0.6,
      });
    }
    grid.wakeAnimation();
  }, crystallizeDelay);
  timerIds.push(crystallizeTimer);

  return () => {
    aborted = true;
    for (const id of timerIds) {
      window.clearTimeout(id);
      window.clearInterval(id);
    }
  };
}

/**
 * Run argument structure view transition ("Show me why" toggle).
 *
 * Re-stipples the same answer data with the ArgumentRenderer,
 * using low theatricality for a smooth rearrangement feel.
 */
export async function runArgumentTransition(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  directive: SceneDirective | null,
  grid: DotGridHandle,
): Promise<StippleConstructionResult | null> {
  const { width, height } = grid.getSize();
  if (width === 0 || height === 0) return null;

  const renderResult = renderArgumentView(nodes, edges);
  const { dotCount } = computeRecruitmentCount(directive, width, height);

  const stippleResult = stipple(renderResult, dotCount, {
    iterations: 10,
    snapshotInterval: 1,
    seed: 42,
    outputWidth: width,
    outputHeight: height,
  });

  if (stippleResult.targets.length === 0) return null;

  const totalDots = grid.getDotCount();
  const dotPositions: Array<{ x: number; y: number; index: number }> = [];
  for (let i = 0; i < totalDots; i++) {
    const pos = grid.getDotPosition(i);
    if (pos) dotPositions.push({ x: pos.x, y: pos.y, index: i });
  }

  // Low theatricality for view transitions: same knowledge rearranging
  const assignments = assignDotsToTargets(
    stippleResult.targets,
    dotPositions,
    0.1, // low theatricality
  );

  const loadBearingDots = identifyLoadBearingDots(assignments, stippleResult.targets);
  const recruitedDotIndices = new Set(assignments.map((a) => a.galaxyDotIndex));

  return {
    assignments,
    stippleResult,
    loadBearingDots,
    recruitedDotIndices,
  };
}
