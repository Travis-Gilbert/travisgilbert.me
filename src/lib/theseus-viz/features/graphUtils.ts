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

/**
 * Generic string-id adjacency BFS used by the renderer. Returns the set of
 * ids within `maxHops` hops of any seed in `seedIds`. The seeds themselves
 * are not included in the result. Used for the evidence neighborhood
 * gradient in CosmosGraphCanvas.
 */
export function bfsHopsFromSeeds(
  seedIds: Iterable<string>,
  adjacency: Map<string, Set<string>>,
  maxHops: number,
): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();
  for (let h = 1; h <= maxHops; h++) result.set(h, new Set());

  const visited = new Set<string>();
  for (const seed of seedIds) visited.add(seed);

  let frontier: Set<string> = new Set(visited);
  for (let hop = 1; hop <= maxHops; hop++) {
    const next = new Set<string>();
    for (const node of frontier) {
      const neighbors = adjacency.get(node);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (visited.has(n)) continue;
        visited.add(n);
        next.add(n);
      }
    }
    result.set(hop, next);
    if (next.size === 0) break;
    frontier = next;
  }
  return result;
}

/**
 * Build adjacency from plain `{source, target}` link records keyed by
 * string id. Symmetric; self-loops are dropped.
 */
export function buildAdjacencyFromLinks(
  ids: Iterable<string>,
  links: ReadonlyArray<{ source: string; target: string }>,
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const id of ids) adj.set(id, new Set());
  for (const link of links) {
    if (!link || link.source === link.target) continue;
    adj.get(link.source)?.add(link.target);
    adj.get(link.target)?.add(link.source);
  }
  return adj;
}
