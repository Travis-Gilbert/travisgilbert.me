/**
 * Phase B: tension flares.
 *
 * For each detected tension (up to 5), both contradicting dots flash
 * terracotta-red and a brief edge is drawn between them. Staggered
 * 100ms apart so the flares read as a separate beat from the main
 * retrieval visualization.
 */
import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';

const TENSION_COLOR: [number, number, number] = [196, 80, 60];
const EDGE_COLOR = 'rgba(196,80,60,0.7)';
const FLARE_DURATION_MS = 600;
const STAGGER_MS = 100;
const FLARE_OPACITY_PEAK = 0.95;
const FLARE_OPACITY_DECAY = 0.55;
const MAX_FLARES = 5;

export function animateTensionFlares(
  grid: DotGridHandle,
  tensions: Array<{ object_a: number; object_b: number; nli_score: number }>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  const flares = tensions.slice(0, MAX_FLARES);
  if (flares.length === 0) return () => {};

  if (prefersReducedMotion) {
    for (const t of flares) {
      const a = objectIdToDotIndex.get(t.object_a);
      const b = objectIdToDotIndex.get(t.object_b);
      if (a !== undefined) {
        grid.setDotGalaxyState(a, { opacityOverride: FLARE_OPACITY_DECAY, colorOverride: TENSION_COLOR });
      }
      if (b !== undefined) {
        grid.setDotGalaxyState(b, { opacityOverride: FLARE_OPACITY_DECAY, colorOverride: TENSION_COLOR });
      }
    }
    grid.wakeAnimation();
    return () => {};
  }

  let cancelled = false;
  const timers: number[] = [];

  flares.forEach((tension, i) => {
    const a = objectIdToDotIndex.get(tension.object_a);
    const b = objectIdToDotIndex.get(tension.object_b);
    if (a === undefined || b === undefined) return;

    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      grid.setDotGalaxyState(a, { opacityOverride: FLARE_OPACITY_PEAK, colorOverride: TENSION_COLOR });
      grid.setDotGalaxyState(b, { opacityOverride: FLARE_OPACITY_PEAK, colorOverride: TENSION_COLOR });
      grid.setEdges([{ fromIndex: a, toIndex: b, progress: 1, color: EDGE_COLOR }]);
      grid.wakeAnimation();

      const decayTimer = window.setTimeout(() => {
        if (cancelled) return;
        grid.setDotGalaxyState(a, { opacityOverride: FLARE_OPACITY_DECAY, colorOverride: TENSION_COLOR });
        grid.setDotGalaxyState(b, { opacityOverride: FLARE_OPACITY_DECAY, colorOverride: TENSION_COLOR });
        grid.setEdges([]);
        grid.wakeAnimation();
      }, FLARE_DURATION_MS);
      timers.push(decayTimer);
    }, i * STAGGER_MS);
    timers.push(startTimer);
  });

  return () => {
    cancelled = true;
    for (const id of timers) window.clearTimeout(id);
  };
}
