/* Shared utilities for layout algorithms */

import { mulberry32 } from '@/lib/prng';

/** Deterministic PRNG using project-standard mulberry32 */
export function seededRandom(seed: number): number {
  return mulberry32(Math.abs(seed | 0))();
}

/** Clamp a value to scene bounds (default [-15, 15]) */
export function clamp(v: number, min = -15, max = 15): number {
  return Math.max(min, Math.min(max, v));
}
