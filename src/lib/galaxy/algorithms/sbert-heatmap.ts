/**
 * Phase B: SBERT cosine-similarity heatmap.
 *
 * Each SBERT-scored dot warms toward an opacity proportional to its
 * semantic similarity to the query. Layers ON TOP of the PageRank flood
 * without replacing it (both touch the same dots with teal overrides).
 * 400ms linear ramp, RAF-driven.
 */
import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';

const TEAL: [number, number, number] = [74, 138, 150];
const BASE_OPACITY = 0.25;
const OPACITY_BOOST = 0.6;
const RAMP_MS = 400;
const START_OPACITY_ASSUMPTION = 0.06;

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
    const clamped = Math.max(0, Math.min(1, similarity));
    targets.set(idx, BASE_OPACITY + clamped * OPACITY_BOOST);
  }

  if (targets.size === 0) return () => {};

  if (prefersReducedMotion) {
    for (const [idx, opacity] of targets) {
      grid.setDotGalaxyState(idx, { opacityOverride: opacity, colorOverride: TEAL });
    }
    grid.wakeAnimation();
    return () => {};
  }

  let cancelled = false;
  let rafId = 0;
  const startTime = performance.now();
  const startOpacities = new Map<number, number>();
  for (const idx of targets.keys()) {
    startOpacities.set(idx, START_OPACITY_ASSUMPTION);
  }

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - startTime) / RAMP_MS);
    for (const [idx, target] of targets) {
      const start = startOpacities.get(idx) ?? START_OPACITY_ASSUMPTION;
      const opa = start + (target - start) * t;
      grid.setDotGalaxyState(idx, { opacityOverride: opa, colorOverride: TEAL });
    }
    grid.wakeAnimation();
    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    }
  };
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
  };
}
