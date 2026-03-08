/**
 * Deterministic PRNG utilities for Studio.
 *
 * Used by PaperWeathering, CorkboardPanel, StageStamp, and HeroAccents
 * to produce SSG-safe randomness seeded from content slugs.
 */

/** djb2 hash: deterministic seed from any string */
export function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

/** LCG PRNG seeded from an integer. Returns values in [0, 1). */
export function createPRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xffffffff;
  };
}
