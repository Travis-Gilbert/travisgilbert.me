// Per atlas-lens.jsx lines 84-107. Polar-coordinate layout with stable
// FNV-1a per-node jitter so the same node lands in the same place
// across renders. Empty-shell rebalance shifts one neighbor from middle
// to inner when inner is empty (atlas-lens.jsx 78-80).

import { classifyShell, type Shell } from './classifyShell';
import type { EdgeTypeMeta } from './edgeTypeMeta';

export const LENS_CENTER = { x: 560, y: 340 } as const;
export const LENS_RADII: Record<Shell, number> = {
  inner: 130,
  middle: 235,
  outer: 335,
} as const;
const ASPECT_Y = 0.92;

export function fnvHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface LensNeighborInput {
  node: { id: string; kind: string };
  edgeType: string;
  edgeLabel?: string;
}

export interface PlacedNeighbor {
  id: string;
  kind: string;
  shell: Shell;
  x: number;
  y: number;
  radius: number;
  angle: number;
  edgeType: string;
  edgeLabel?: string;
}

export interface LensLayout {
  focused: { id: string; x: number; y: number };
  placed: PlacedNeighbor[];
  emptyShells: Set<Shell>;
}

interface ComputeArgs {
  focused: { id: string; kind: string };
  neighbors: LensNeighborInput[];
  edgeTypeMeta: Map<string, EdgeTypeMeta>;
}

export function computeLensLayout(args: ComputeArgs): LensLayout {
  const { focused, neighbors, edgeTypeMeta } = args;
  const buckets: Record<Shell, LensNeighborInput[]> = {
    inner: [],
    middle: [],
    outer: [],
  };
  const seen = new Set<string>();
  for (const nb of neighbors) {
    if (seen.has(nb.node.id)) continue;
    seen.add(nb.node.id);
    const shell = classifyShell(nb.node, nb.edgeType, focused, edgeTypeMeta);
    buckets[shell].push(nb);
  }
  // Empty-shell rebalance per atlas-lens.jsx 78-80.
  if (buckets.inner.length === 0 && buckets.middle.length > 0) {
    const moved = buckets.middle.shift();
    if (moved) buckets.inner.push(moved);
  }

  const placed: PlacedNeighbor[] = [];
  for (const shell of ['inner', 'middle', 'outer'] as Shell[]) {
    const list = buckets[shell];
    const r = LENS_RADII[shell];
    const n = list.length;
    const startA = -Math.PI / 2 + ((fnvHash(shell) % 100) / 100) * 0.4;
    list.forEach((nb, i) => {
      const baseA = startA + (i / Math.max(n, 1)) * Math.PI * 2;
      const ja = (((fnvHash(nb.node.id) % 1000) / 1000) - 0.5) * 0.10;
      const jr = (((fnvHash(nb.node.id + ':r') % 1000) / 1000) - 0.5) * 28;
      const a = baseA + ja;
      const rr = r + jr;
      placed.push({
        id: nb.node.id,
        kind: nb.node.kind,
        shell,
        x: LENS_CENTER.x + Math.cos(a) * rr,
        y: LENS_CENTER.y + Math.sin(a) * rr * ASPECT_Y,
        radius: rr,
        angle: a,
        edgeType: nb.edgeType,
        edgeLabel: nb.edgeLabel,
      });
    });
  }

  const emptyShells = new Set<Shell>();
  for (const shell of ['inner', 'middle', 'outer'] as Shell[]) {
    if (buckets[shell].length === 0) emptyShells.add(shell);
  }

  return {
    focused: { id: focused.id, x: LENS_CENTER.x, y: LENS_CENTER.y },
    placed,
    emptyShells,
  };
}
