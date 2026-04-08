/**
 * Phase B: PageRank flood visualization.
 *
 * A BFS wavefront emanating from source dots (the entity seeds resolved
 * during e4b classification), brightening neighbors in waves. Final
 * brightness per dot is the actual Personalized PageRank score for that
 * object, scaled into a [0.15, 0.85] opacity band. Reads visually as ink
 * soaking through paper: the user is literally watching PPR converge.
 *
 * Reduced-motion fallback snaps every scored dot to its final brightness
 * in one frame.
 */
import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';

const TEAL_FLOOD_COLOR: [number, number, number] = [74, 138, 150];
const BASE_OPACITY = 0.15;
const MAX_OPACITY_BOOST = 0.7;
const MAX_WAVES = 6;
const WAVE_DELAY_MS = 60;
const NEIGHBORS_PER_WAVE = 8;
const INITIAL_KICKOFF_MS = 30;

export function animatePageRankFlood(
  grid: DotGridHandle,
  sourceDotIndices: number[],
  pageRankScores: Record<string, number>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  // Build target opacity per dot from PPR scores.
  const targets = new Map<number, number>();
  for (const [objIdStr, score] of Object.entries(pageRankScores)) {
    const objId = parseInt(objIdStr, 10);
    if (!Number.isFinite(objId)) continue;
    const dotIdx = objectIdToDotIndex.get(objId);
    if (dotIdx === undefined) continue;
    const clamped = Math.max(0, Math.min(1, score));
    targets.set(dotIdx, BASE_OPACITY + clamped * MAX_OPACITY_BOOST);
  }

  if (prefersReducedMotion) {
    for (const [idx, opacity] of targets) {
      grid.setDotGalaxyState(idx, {
        opacityOverride: opacity,
        colorOverride: TEAL_FLOOD_COLOR,
      });
    }
    grid.wakeAnimation();
    return () => {};
  }

  // Immediately brighten the source dots to their final PPR brightness.
  for (const idx of sourceDotIndices) {
    const target = targets.get(idx) ?? 0.85;
    grid.setDotGalaxyState(idx, {
      opacityOverride: target,
      colorOverride: TEAL_FLOOD_COLOR,
    });
  }
  grid.wakeAnimation();

  // BFS wavefront outward from source dots.
  let cancelled = false;
  const visited = new Set<number>(sourceDotIndices);
  let frontier = sourceDotIndices.slice();
  let waveIndex = 0;
  const timerIds: number[] = [];

  function tickWave(): void {
    if (cancelled || waveIndex >= MAX_WAVES) return;

    const nextFrontier: number[] = [];
    for (const idx of frontier) {
      const neighbors = grid.findNearestDots(idx, NEIGHBORS_PER_WAVE);
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        visited.add(n);
        // If this neighbor has a PPR score, use it; otherwise fade from
        // wave distance so the wavefront remains visible past the scored set.
        const target =
          targets.get(n) ??
          BASE_OPACITY + (1 - waveIndex / MAX_WAVES) * 0.3;
        grid.setDotGalaxyState(n, {
          opacityOverride: target,
          colorOverride: TEAL_FLOOD_COLOR,
        });
        nextFrontier.push(n);
      }
    }
    grid.wakeAnimation();
    frontier = nextFrontier;
    waveIndex++;
    if (waveIndex < MAX_WAVES && nextFrontier.length > 0) {
      timerIds.push(window.setTimeout(tickWave, WAVE_DELAY_MS));
    }
  }

  timerIds.push(window.setTimeout(tickWave, INITIAL_KICKOFF_MS));

  return () => {
    cancelled = true;
    for (const id of timerIds) window.clearTimeout(id);
  };
}
