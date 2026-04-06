/**
 * StipplingDirector.ts
 *
 * TF.js-informed intelligence layer that directs (but does not perform)
 * the stippling process. Makes four decisions:
 *
 *   1. Recruitment count: how many dots to pull from the galaxy
 *   2. Reveal order: which phase template to use (from answer type)
 *   3. Dot selection: which galaxy dots get recruited (theatricality)
 *   4. Load-bearing identification: post-crystallize semantic tagging
 *
 * TF.js provides salience scores and topology confidence. This module
 * translates those into actionable parameters for StipplingEngine and
 * GalaxyController.
 */

import type { SceneDirective, NodeSalience } from '@/lib/theseus-viz/SceneDirective';
import type { StippleTarget } from './StipplingEngine';

// ---------------------------------------------------------------------------
// Decision 1: Recruitment Count
// ---------------------------------------------------------------------------

const MIN_DOTS = 3000;
const MAX_DOTS = 8000;
const DESKTOP_REFERENCE_WIDTH = 1280;

export interface RecruitmentParams {
  /** Number of dots to recruit from the galaxy */
  dotCount: number;
  /** Confidence that drove the count (for debugging) */
  confidence: number;
}

/**
 * Decide how many dots to recruit from the galaxy.
 *
 * High confidence + clear topology = more dots (rich, dense shape).
 * Low confidence = fewer dots (sparse, tentative).
 * Mobile viewports scale down to avoid clutter.
 */
export function computeRecruitmentCount(
  directive: SceneDirective | null,
  viewportWidth: number,
  viewportHeight: number,
): RecruitmentParams {
  // Base confidence from the directive's salience scores
  let confidence = 0.5;
  if (directive) {
    const saliences = directive.salience;
    if (saliences.length > 0) {
      const avgSalience = saliences.reduce(
        (sum: number, s: NodeSalience) => sum + (s.suggested_scale ?? 0.5),
        0,
      ) / saliences.length;
      confidence = avgSalience;
    }

    // Topology confidence boosts count if the system is sure about the shape
    if (directive.topology?.shape_confidence) {
      confidence = confidence * 0.6 + directive.topology.shape_confidence * 0.4;
    }
  }

  // Viewport multiplier: scale down on mobile
  const viewportMultiplier = Math.min(1, viewportWidth / DESKTOP_REFERENCE_WIDTH);

  // Area multiplier: very tall narrow viewports get fewer dots too
  const areaNorm = Math.min(1, (viewportWidth * viewportHeight) / (1280 * 720));
  const screenFactor = viewportMultiplier * 0.7 + areaNorm * 0.3;

  const raw = MIN_DOTS + confidence * (MAX_DOTS - MIN_DOTS);
  const scaled = Math.round(raw * screenFactor);
  const dotCount = Math.max(MIN_DOTS, Math.min(MAX_DOTS, scaled));

  return { dotCount, confidence };
}

// ---------------------------------------------------------------------------
// Decision 2: Reveal Order (Phase Template Selection)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Decision 3: Dot Selection
// ---------------------------------------------------------------------------

export interface DotAssignment {
  /** Index of the galaxy dot being recruited */
  galaxyDotIndex: number;
  /** Target position from stippling */
  targetX: number;
  targetY: number;
  /** Distance the dot will travel (for staggered animation timing) */
  travelDistance: number;
}

/**
 * Assign stipple targets to galaxy dots.
 *
 * The theatricality score (0.0 to 1.0) blends between two strategies:
 *   - Low: pick nearest galaxy dots to each target (fast convergence)
 *   - High: pick distant dots (dramatic flight)
 *
 * For view transitions (argument structure toggle), theatricality should
 * be forced low so it feels like the same knowledge rearranging.
 *
 * Uses a grid-based spatial index for O(n) assignment instead of O(n*m).
 */
export function assignDotsToTargets(
  targets: Array<{ x: number; y: number }>,
  dotPositions: Array<{ x: number; y: number; index: number }>,
  theatricality: number,
  excludeIndices?: Set<number>,
): DotAssignment[] {
  const excluded = excludeIndices ?? new Set<number>();
  const available = dotPositions.filter((d) => !excluded.has(d.index));

  if (available.length === 0) return [];

  // Build a grid-cell spatial index for fast nearest-neighbor lookup
  const cellSize = 40;
  const grid = new Map<string, Array<{ x: number; y: number; index: number }>>();
  for (const dot of available) {
    const key = `${Math.floor(dot.x / cellSize)},${Math.floor(dot.y / cellSize)}`;
    const cell = grid.get(key);
    if (cell) cell.push(dot);
    else grid.set(key, [dot]);
  }

  const used = new Set<number>();
  const assignments: DotAssignment[] = [];

  for (const target of targets) {
    const cx = Math.floor(target.x / cellSize);
    const cy = Math.floor(target.y / cellSize);

    // Search expanding rings of cells until we find an available dot
    let bestDot: { x: number; y: number; index: number } | null = null;
    let bestScore = -Infinity;
    const searchRadius = theatricality > 0.5 ? 8 : 3;

    for (let ring = 0; ring <= searchRadius; ring++) {
      if (bestDot && ring > 0) break; // found on a previous ring; don't expand further
      for (let dx = -ring; dx <= ring; dx++) {
        for (let dy = -ring; dy <= ring; dy++) {
          if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue; // only ring perimeter
          const cell = grid.get(`${cx + dx},${cy + dy}`);
          if (!cell) continue;

          for (const dot of cell) {
            if (used.has(dot.index)) continue;
            const ddx = dot.x - target.x;
            const ddy = dot.y - target.y;
            const dist = Math.sqrt(ddx * ddx + ddy * ddy);
            const score = -dist * (1 - theatricality) + dist * theatricality;

            if (score > bestScore) {
              bestScore = score;
              bestDot = dot;
            }
          }
        }
      }
    }

    if (!bestDot) continue;

    const ddx = bestDot.x - target.x;
    const ddy = bestDot.y - target.y;
    assignments.push({
      galaxyDotIndex: bestDot.index,
      targetX: target.x,
      targetY: target.y,
      travelDistance: Math.sqrt(ddx * ddx + ddy * ddy),
    });
    used.add(bestDot.index);
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Decision 4: Load-Bearing Identification
// ---------------------------------------------------------------------------

export interface LoadBearingDot {
  galaxyDotIndex: number;
  nodeId: string;
  role: string;
  /** True if removing this node would change the conclusion (Jenga) */
  isLoadBearing: boolean;
}

/**
 * Tag dots with load-bearing status for Jenga / argument interactions.
 *
 * A dot is load-bearing if:
 *   - Its role is 'premise' or 'conclusion'
 *   - It has a non-null nodeId (it landed on a semantic region)
 *
 * Conclusion dots are always load-bearing (removing the conclusion
 * collapses the argument). Evidence dots are NOT load-bearing by
 * default (removing one leaf doesn't invalidate the argument, though
 * TMS may flag it). Premise dots are load-bearing: they bridge
 * evidence to conclusion.
 */
export function identifyLoadBearingDots(
  assignments: DotAssignment[],
  stippleTargets: StippleTarget[],
): LoadBearingDot[] {
  const result: LoadBearingDot[] = [];

  for (let i = 0; i < assignments.length && i < stippleTargets.length; i++) {
    const target = stippleTargets[i];
    if (!target.nodeId || !target.role) continue;

    result.push({
      galaxyDotIndex: assignments[i].galaxyDotIndex,
      nodeId: target.nodeId,
      role: target.role,
      isLoadBearing: target.role === 'conclusion' || target.role === 'premise',
    });
  }

  return result;
}
