/**
 * Phase B: BM25 lexical strobe.
 *
 * A left-to-right sweep across the dot field. As the sweep crosses each
 * BM25-matched dot, the dot flashes white briefly (200ms), then decays
 * to a muted teal accent. Reads visually as a card catalog scanner
 * finding literal token matches.
 */
import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';

const FLASH_COLOR: [number, number, number] = [255, 255, 255];
const TEAL_ACCENT: [number, number, number] = [74, 138, 150];
const SWEEP_DURATION_MS = 800;
const FLASH_DURATION_MS = 200;
const FLASH_OPACITY = 0.95;
const DECAY_OPACITY = 0.45;

export function animateBM25Strobe(
  grid: DotGridHandle,
  bm25Hits: Array<{ object_id: number; score: number }>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  const hitDots: number[] = [];
  for (const hit of bm25Hits) {
    const idx = objectIdToDotIndex.get(hit.object_id);
    if (idx !== undefined) hitDots.push(idx);
  }
  if (hitDots.length === 0) return () => {};

  if (prefersReducedMotion) {
    for (const idx of hitDots) {
      grid.setDotGalaxyState(idx, { opacityOverride: FLASH_OPACITY, colorOverride: FLASH_COLOR });
    }
    grid.wakeAnimation();
    return () => {};
  }

  const { width } = grid.getSize();
  const startTime = performance.now();
  let cancelled = false;
  let rafId = 0;
  const flashed = new Set<number>();
  const decayTimers: number[] = [];

  const tick = (now: number) => {
    if (cancelled) return;
    const elapsed = now - startTime;
    const sweepX = (elapsed / SWEEP_DURATION_MS) * width;

    for (const idx of hitDots) {
      if (flashed.has(idx)) continue;
      const pos = grid.getDotPosition(idx);
      if (!pos) continue;
      if (pos.x <= sweepX) {
        flashed.add(idx);
        grid.setDotGalaxyState(idx, { opacityOverride: FLASH_OPACITY, colorOverride: FLASH_COLOR });
        const decayId = window.setTimeout(() => {
          if (cancelled) return;
          grid.setDotGalaxyState(idx, { opacityOverride: DECAY_OPACITY, colorOverride: TEAL_ACCENT });
          grid.wakeAnimation();
        }, FLASH_DURATION_MS);
        decayTimers.push(decayId);
      }
    }
    grid.wakeAnimation();

    if (elapsed < SWEEP_DURATION_MS) {
      rafId = requestAnimationFrame(tick);
    }
  };
  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    for (const id of decayTimers) window.clearTimeout(id);
  };
}
