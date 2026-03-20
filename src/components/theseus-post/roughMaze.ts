// roughMaze.ts: Seeded PRNG and utility functions for the maze background.
// Shannon's paper year (1952) seeds all deterministic randomness.
// Pure computation, no React.

export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mazeRandFn = mulberry32(1952);

export function mazeRand(): number {
  return mazeRandFn();
}

export function randomInRange(min: number, max: number): number {
  return min + mazeRand() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomInRange(min, max + 1));
}

// Quadratic bezier interpolation for organic particle paths
export function bezierPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
  ];
}

// Linear interpolation between two points
export function lerp2d(
  a: [number, number],
  b: [number, number],
  t: number,
): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
