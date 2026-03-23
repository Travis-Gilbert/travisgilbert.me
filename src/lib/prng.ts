/**
 * Seeded PRNG (mulberry32) for deterministic animations.
 * Extracted from ArchitectureEasterEgg.tsx for reuse across
 * tree schematics, wobble connectors, and generative elements.
 */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a wobble path between two points.
 * Used for hand-drawn connector SVGs in tree schematics.
 * Produces a smooth quadratic Bezier path with slight PRNG jitter.
 */
export function wobblePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number,
): string {
  const rng = mulberry32(seed);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(2, Math.round(len / 8));
  const points: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ox = i === 0 || i === steps ? 0 : (rng() - 0.5) * 2.4;
    const oy = i === 0 || i === steps ? 0 : (rng() - 0.5) * 2.4;
    points.push([x1 + dx * t + ox, y1 + dy * t + oy]);
  }

  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev[0] + curr[0]) / 2 + (rng() - 0.5) * 1.2;
    const cpy = (prev[1] + curr[1]) / 2 + (rng() - 0.5) * 1.2;
    d += ` Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${curr[0].toFixed(1)} ${curr[1].toFixed(1)}`;
  }

  return d;
}
