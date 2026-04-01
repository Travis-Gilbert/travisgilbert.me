/* SPEC-VIE-3: BFS tree layout from root (highest gradual_strength) */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import { clamp } from './layoutUtils';

/**
 * BFS from root node (highest gradual_strength).
 * Each BFS level gets z-depth tier (front=root at z=0, back=leaves at z=-depth*3).
 * Siblings spread horizontally at each level with even spacing.
 * y = 0 (flat horizontal tree).
 */
export function computeHierarchyLayout(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): [number, number, number][] {
  const n = nodes.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0, 0]];

  // Find root: highest gradual_strength
  const rootNode = nodes.reduce((best, nd) =>
    nd.gradual_strength > best.gradual_strength ? nd : best,
  );

  // Build adjacency
  const adj = new Map<string, string[]>();
  for (const nd of nodes) adj.set(nd.object_id, []);
  for (const e of edges) {
    adj.get(e.from_id)?.push(e.to_id);
    adj.get(e.to_id)?.push(e.from_id);
  }

  // BFS from root
  const visited = new Set<string>();
  const levels: string[][] = [];
  const queue: Array<{ id: string; level: number }> = [{ id: rootNode.object_id, level: 0 }];
  visited.add(rootNode.object_id);

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (!levels[level]) levels[level] = [];
    levels[level].push(id);

    for (const neighbor of adj.get(id) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, level: level + 1 });
      }
    }
  }

  // Add disconnected nodes to the last level
  for (const nd of nodes) {
    if (!visited.has(nd.object_id)) {
      if (!levels[levels.length]) levels.push([]);
      levels[levels.length - 1].push(nd.object_id);
    }
  }

  // Assign positions
  const positions = new Map<string, [number, number, number]>();
  const maxLevel = levels.length - 1;

  for (let lvl = 0; lvl < levels.length; lvl++) {
    const members = levels[lvl];
    const count = members.length;
    const spacing = count > 1 ? 20 / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const x = count > 1 ? i * spacing - 10 : 0;
      const z = maxLevel > 0 ? -lvl * 3 : 0;
      positions.set(members[i], [
        clamp(x),
        0,
        clamp(z),
      ]);
    }
  }

  return nodes.map(nd => positions.get(nd.object_id) || [0, 0, 0]);
}

