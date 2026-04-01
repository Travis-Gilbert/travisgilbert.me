/* Shared graph traversal utilities for the intelligence layer */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';

export function buildAdjacency(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const nd of nodes) adj.set(nd.object_id, new Set());
  for (const e of edges) {
    adj.get(e.from_id)?.add(e.to_id);
    adj.get(e.to_id)?.add(e.from_id);
  }
  return adj;
}

export function buildDegreeMap(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): Map<string, number> {
  const deg = new Map<string, number>();
  for (const nd of nodes) deg.set(nd.object_id, 0);
  for (const e of edges) {
    deg.set(e.from_id, (deg.get(e.from_id) || 0) + 1);
    deg.set(e.to_id, (deg.get(e.to_id) || 0) + 1);
  }
  return deg;
}

export function medianOfValues(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 1;
}

export function findConnectedComponents(
  nodes: EvidenceNode[],
  adj: Map<string, Set<string>>,
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const nd of nodes) {
    if (visited.has(nd.object_id)) continue;
    const component: string[] = [];
    const queue = [nd.object_id];
    visited.add(nd.object_id);
    while (queue.length > 0) {
      const v = queue.pop()!;
      component.push(v);
      for (const w of adj.get(v) || []) {
        if (!visited.has(w)) {
          visited.add(w);
          queue.push(w);
        }
      }
    }
    components.push(component);
  }
  return components;
}

/** Warmup ticks by graph size (shared between rule-based and learned paths) */
export function warmupTicksForSize(n: number): number {
  return n < 30 ? 100 : n <= 100 ? 200 : 300;
}
