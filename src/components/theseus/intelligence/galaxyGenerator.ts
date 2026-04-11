/**
 * Deterministic spiral galaxy generator for the Intelligence Panel.
 * Pure TypeScript: no external libraries, no Math.random().
 */

export interface GalaxyNode {
  x: number;
  y: number;
  radius: number;
  community: number;
  sourceCount: number;
  isConspiracy: boolean;
  confidence: number;
  brightness: number;
  pulseOffset: number;
  messagePhase: number;
}

export interface GalaxyEdge {
  source: number;
  target: number;
  weight: number;
}

export interface GalaxyData {
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
}

/** mulberry32 seeded PRNG (same as used elsewhere in this codebase). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateGalaxy(
  width: number,
  height: number,
  count = 2200,
): GalaxyData {
  const rng = mulberry32(42);

  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) * 0.65;
  const ARMS = 3;
  const EDGE_PAD = 20;

  const nodes: GalaxyNode[] = [];

  for (let i = 0; i < count; i++) {
    // Pick a spiral arm
    const arm = Math.floor(rng() * ARMS);
    const armAngle = (arm / ARMS) * Math.PI * 2;

    // Distance from center: center-biased for natural density falloff
    const dist = Math.pow(rng(), 1.3) * maxRadius;
    const distNorm = dist / maxRadius; // 0 at center, 1 at edge

    // Spiral angle increases with distance
    const angle = armAngle + dist * 0.004;

    // Scatter stays thick through mid-arm, tapers only at the outer tips
    const dn4 = distNorm * distNorm * distNorm * distNorm;
    const taperFactor = 1 - dn4;
    const scatter = (rng() - 0.5) * dist * 1.1 * taperFactor;

    // Compute position (Y compressed for elliptical look)
    let x = cx + Math.cos(angle) * dist - Math.sin(angle) * scatter;
    let y = cy + (Math.sin(angle) * dist + Math.cos(angle) * scatter) * 0.7;

    // Clamp to viewport with padding
    x = Math.max(EDGE_PAD, Math.min(width - EDGE_PAD, x));
    y = Math.max(EDGE_PAD, Math.min(height - EDGE_PAD, y));

    // Community assignment by angular position around center
    const nodeAngle = Math.atan2(y - cy, x - cx);
    const normalizedAngle = ((nodeAngle + Math.PI) / (Math.PI * 2)) % 1;
    const community = Math.floor(normalizedAngle * 7) % 7;

    // Node properties (taper size and brightness at edges)
    const edgeFade = 1 - distNorm * 0.5;
    const radius = (1 + rng() * 1.8) * edgeFade;
    const sourceCount = 1 + Math.floor(rng() * 5);
    const isConspiracy = sourceCount === 1 && rng() < 0.3;
    const confidence = isConspiracy
      ? 0.1 + rng() * 0.2
      : 0.5 + rng() * 0.5;
    const brightness = (0.15 + rng() * 0.25) * edgeFade;
    const pulseOffset = rng() * Math.PI * 2;
    const messagePhase = rng() * Math.PI * 2;

    nodes.push({
      x,
      y,
      radius,
      community,
      sourceCount,
      isConspiracy,
      confidence,
      brightness,
      pulseOffset,
      messagePhase,
    });
  }

  // Generate edges: connect nearby nodes
  const edges: GalaxyEdge[] = [];
  const MAX_DIST = 80;
  const MAX_DIST_SQ = MAX_DIST * MAX_DIST;

  // Spatial grid for efficient neighbor lookup
  const cellSize = MAX_DIST;
  const cols = Math.ceil(width / cellSize);
  const grid = new Map<number, number[]>();

  for (let i = 0; i < nodes.length; i++) {
    const col = Math.floor(nodes[i].x / cellSize);
    const row = Math.floor(nodes[i].y / cellSize);
    const key = row * cols + col;
    const arr = grid.get(key);
    if (arr) arr.push(i);
    else grid.set(key, [i]);
  }

  for (let i = 0; i < nodes.length; i++) {
    const ni = nodes[i];
    const col = Math.floor(ni.x / cellSize);
    const row = Math.floor(ni.y / cellSize);

    // Check neighboring cells
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const key = (row + dr) * cols + (col + dc);
        const cell = grid.get(key);
        if (!cell) continue;

        for (const j of cell) {
          if (j <= i) continue;

          const nj = nodes[j];
          const dx = ni.x - nj.x;
          const dy = ni.y - nj.y;
          const distSq = dx * dx + dy * dy;

          if (distSq > MAX_DIST_SQ) continue;

          const distance = Math.sqrt(distSq);
          const sameCommunity = ni.community === nj.community;
          const prob = sameCommunity ? 0.15 : 0.03;

          if (rng() < prob) {
            edges.push({
              source: i,
              target: j,
              weight: 1 - distance / MAX_DIST,
            });
          }
        }
      }
    }
  }

  return { nodes, edges };
}
