/* SPEC-VIE-3: Fruchterman-Reingold force-directed layout with hub emphasis */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import { seededRandom, clamp } from './layoutUtils';

interface ForceNode {
  id: string;
  x: number;
  z: number;
  dx: number;
  dz: number;
  isHub: boolean;
}

const AREA = 400; // 20x20 scene
const MAX_ITERATIONS = 300;
const INITIAL_TEMP = 10;
const GRID_CELL_SIZE = 5;

/**
 * Fruchterman-Reingold force-directed layout.
 * For >50 nodes uses grid-based binning to avoid O(n^2).
 * Returns 3D positions: 2D FR for x,z; small random y offset.
 */
export function computeForceLayout(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  initialPositions?: [number, number, number][],
): [number, number, number][] {
  const n = nodes.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0, 0]];

  const k = Math.sqrt(AREA / n);

  // Compute median degree for hub detection
  const degMap = new Map<string, number>();
  for (const nd of nodes) degMap.set(nd.object_id, 0);
  for (const e of edges) {
    degMap.set(e.from_id, (degMap.get(e.from_id) || 0) + 1);
    degMap.set(e.to_id, (degMap.get(e.to_id) || 0) + 1);
  }
  const degs = Array.from(degMap.values()).sort((a, b) => a - b);
  const medianDeg = degs[Math.floor(degs.length / 2)] || 1;

  // Initialize force nodes
  const idToIdx = new Map<string, number>();
  const fnodes: ForceNode[] = nodes.map((nd, i) => {
    idToIdx.set(nd.object_id, i);
    const isHub = (degMap.get(nd.object_id) || 0) > 2 * medianDeg;
    return {
      id: nd.object_id,
      x: initialPositions ? initialPositions[i][0] : (seededRandom(i * 7 + 13) * 20 - 10),
      z: initialPositions ? initialPositions[i][2] : (seededRandom(i * 11 + 29) * 20 - 10),
      dx: 0,
      dz: 0,
      isHub,
    };
  });

  const edgeIndices = edges
    .map(e => [idToIdx.get(e.from_id), idToIdx.get(e.to_id)] as [number | undefined, number | undefined])
    .filter((pair): pair is [number, number] => pair[0] !== undefined && pair[1] !== undefined);

  const useGrid = n > 50;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const temp = INITIAL_TEMP * (1 - iter / MAX_ITERATIONS);

    // Reset displacements
    for (const fn of fnodes) { fn.dx = 0; fn.dz = 0; }

    // Repulsive forces
    if (useGrid) {
      applyRepulsiveGrid(fnodes, k);
    } else {
      applyRepulsiveBrute(fnodes, k);
    }

    // Attractive forces (edges)
    for (const [ui, vi] of edgeIndices) {
      const u = fnodes[ui];
      const v = fnodes[vi];
      const dx = v.x - u.x;
      const dz = v.z - u.z;
      const dist = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
      const force = (dist * dist) / k; // attractive: d^2 / k
      const fx = (dx / dist) * force;
      const fz = (dz / dist) * force;
      u.dx += fx;
      u.dz += fz;
      v.dx -= fx;
      v.dz -= fz;
    }

    // Apply displacements with temperature limit
    for (const fn of fnodes) {
      const disp = Math.max(0.01, Math.sqrt(fn.dx * fn.dx + fn.dz * fn.dz));
      const scale = Math.min(disp, temp) / disp;
      fn.x += fn.dx * scale;
      fn.z += fn.dz * scale;
      // Clamp to bounds
      fn.x = Math.max(-14, Math.min(14, fn.x));
      fn.z = Math.max(-14, Math.min(14, fn.z));
    }
  }

  // Output 3D positions: x from FR, small y offset, z from FR
  return fnodes.map((fn, i) => [
    clamp(fn.x),
    seededRandom(i * 3 + 47) * 2, // y: 0 to 2
    clamp(fn.z),
  ]);
}

function applyRepulsiveBrute(fnodes: ForceNode[], k: number): void {
  for (let i = 0; i < fnodes.length; i++) {
    for (let j = i + 1; j < fnodes.length; j++) {
      const u = fnodes[i];
      const v = fnodes[j];
      const dx = u.x - v.x;
      const dz = u.z - v.z;
      const dist = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
      let force = (k * k) / dist; // repulsive: k^2 / d
      // Hub emphasis: 2x repulsive for hubs
      if (u.isHub) force *= 2;
      if (v.isHub) force *= 2;
      const fx = (dx / dist) * force;
      const fz = (dz / dist) * force;
      u.dx += fx;
      u.dz += fz;
      v.dx -= fx;
      v.dz -= fz;
    }
  }
}

function applyRepulsiveGrid(fnodes: ForceNode[], k: number): void {
  // Grid-based binning: only compute repulsion between nodes in nearby cells
  const cells = new Map<string, number[]>();
  for (let i = 0; i < fnodes.length; i++) {
    const cx = Math.floor(fnodes[i].x / GRID_CELL_SIZE);
    const cz = Math.floor(fnodes[i].z / GRID_CELL_SIZE);
    const key = `${cx},${cz}`;
    const list = cells.get(key);
    if (list) list.push(i);
    else cells.set(key, [i]);
  }

  for (let i = 0; i < fnodes.length; i++) {
    const u = fnodes[i];
    const cx = Math.floor(u.x / GRID_CELL_SIZE);
    const cz = Math.floor(u.z / GRID_CELL_SIZE);
    // Check neighboring cells
    for (let dcx = -1; dcx <= 1; dcx++) {
      for (let dcz = -1; dcz <= 1; dcz++) {
        const key = `${cx + dcx},${cz + dcz}`;
        const neighbors = cells.get(key);
        if (!neighbors) continue;
        for (const j of neighbors) {
          if (j <= i) continue;
          const v = fnodes[j];
          const dx = u.x - v.x;
          const dz = u.z - v.z;
          const dist = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
          let force = (k * k) / dist;
          if (u.isHub) force *= 2;
          if (v.isHub) force *= 2;
          const fx = (dx / dist) * force;
          const fz = (dz / dist) * force;
          u.dx += fx;
          u.dz += fz;
          v.dx -= fx;
          v.dz -= fz;
        }
      }
    }
  }
}

