/* SPEC-VIE-3: Graph-level feature extraction (16 dimensions) */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { TopologyType } from '../SceneSpec';

/**
 * Dimension 0:     node_count (log-scaled, normalized)
 * Dimension 1:     edge_count (log-scaled, normalized)
 * Dimension 2:     density (edge_count / max_possible_edges)
 * Dimension 3:     diameter (longest shortest path, normalized by node_count)
 * Dimension 4:     average_degree (mean degree / node_count)
 * Dimension 5:     degree_variance (std of degree distribution, normalized)
 * Dimension 6:     has_hub (1.0 if max_degree > 3x median)
 * Dimension 7:     has_bridge_nodes (1.0 if any articulation points)
 * Dimension 8:     component_count (normalized, 1.0 if fully connected)
 * Dimension 9:     average_clustering_coefficient
 * Dimension 10:    max_gradual_strength
 * Dimension 11:    tension_count (normalized)
 * Dimension 12:    hypothesis_count (normalized)
 * Dimensions 13-15: reserved (zero-filled)
 */
export const GRAPH_FEATURE_DIM = 16;

export function extractGraphFeatures(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  tensionCount = 0,
  hypothesisCount = 0,
): Float32Array {
  const features = new Float32Array(GRAPH_FEATURE_DIM);
  const n = nodes.length;
  const m = edges.length;

  if (n === 0) return features;

  // Build adjacency
  const adj = new Map<string, Set<string>>();
  for (const nd of nodes) adj.set(nd.object_id, new Set());
  for (const e of edges) {
    adj.get(e.from_id)?.add(e.to_id);
    adj.get(e.to_id)?.add(e.from_id);
  }

  const degrees = nodes.map(nd => adj.get(nd.object_id)?.size || 0);
  const maxDeg = Math.max(0, ...degrees);
  const sortedDeg = [...degrees].sort((a, b) => a - b);
  const medianDeg = sortedDeg[Math.floor(sortedDeg.length / 2)] || 0;
  const meanDeg = degrees.reduce((s, d) => s + d, 0) / n;
  const degVariance = degrees.reduce((s, d) => s + (d - meanDeg) ** 2, 0) / n;

  // 0: node_count (log-scaled, normalized: 1.0 = 1000 nodes)
  features[0] = Math.min(1, Math.log10(Math.max(1, n)) / 3);

  // 1: edge_count (log-scaled, normalized: 1.0 = 10000 edges)
  features[1] = Math.min(1, Math.log10(Math.max(1, m)) / 4);

  // 2: density
  const maxEdges = n * (n - 1) / 2;
  features[2] = maxEdges > 0 ? m / maxEdges : 0;

  // 3: diameter (BFS from each node, find longest shortest path)
  const diameter = computeDiameter(nodes, adj);
  features[3] = n > 1 ? Math.min(1, diameter / (n - 1)) : 0;

  // 4: average_degree / node_count
  features[4] = n > 0 ? Math.min(1, meanDeg / n) : 0;

  // 5: degree_variance (normalized by max possible variance)
  const maxVar = n > 1 ? ((n - 1) ** 2) : 1;
  features[5] = Math.min(1, degVariance / maxVar);

  // 6: has_hub
  features[6] = maxDeg > 3 * Math.max(1, medianDeg) ? 1.0 : 0.0;

  // 7: has_bridge_nodes
  features[7] = hasArticulationPoints(nodes, adj) ? 1.0 : 0.0;

  // 8: component_count (normalized: 1 / componentCount, so 1.0 = fully connected)
  const compCount = countComponents(nodes, adj);
  features[8] = 1.0 / Math.max(1, compCount);

  // 9: average_clustering_coefficient
  features[9] = computeAvgClustering(nodes, adj);

  // 10: max_gradual_strength
  features[10] = Math.max(0, ...nodes.map(nd => nd.gradual_strength));

  // 11: tension_count (normalized: 1.0 = 10 tensions)
  features[11] = Math.min(1, tensionCount / 10);

  // 12: hypothesis_count (normalized: 1.0 = 10 hypotheses)
  features[12] = Math.min(1, hypothesisCount / 10);

  // 13-15: reserved
  return features;
}

export function getTopologyType(
  features: Float32Array,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): TopologyType {
  const n = nodes.length;
  const density = features[2];
  const diameter = features[3] * (n - 1); // un-normalize
  const hasHub = features[6] === 1.0;
  const componentCount = Math.round(1 / Math.max(0.01, features[8]));
  const tensionCount = features[11] * 10;
  const maxDeg = Math.max(0, ...computeDegrees(nodes, edges));

  // linear_chain: diameter > 0.7 * node_count AND max_degree <= 2
  if (n > 2 && diameter > 0.7 * n && maxDeg <= 2) return 'linear_chain';

  // tree: no cycles AND component_count == 1
  if (componentCount === 1 && edges.length === n - 1 && n > 1) return 'tree';

  // star: has_hub AND density < 0.3 AND component_count == 1
  if (hasHub && density < 0.3 && componentCount === 1) return 'star';

  // bipartite_tension: tension_count > 0 AND component_count <= 2
  if (tensionCount > 0 && componentCount <= 2) return 'bipartite_tension';

  // dense_cluster: density > 0.4 AND component_count == 1
  if (density > 0.4 && componentCount === 1) return 'dense_cluster';

  // multi_cluster: component_count > 2
  if (componentCount > 2) return 'multi_cluster';

  return 'mixed';
}

// ---- Internal helpers ----

function computeDegrees(nodes: EvidenceNode[], edges: EvidenceEdge[]): number[] {
  const deg = new Map<string, number>();
  for (const nd of nodes) deg.set(nd.object_id, 0);
  for (const e of edges) {
    deg.set(e.from_id, (deg.get(e.from_id) || 0) + 1);
    deg.set(e.to_id, (deg.get(e.to_id) || 0) + 1);
  }
  return Array.from(deg.values());
}

function computeDiameter(
  nodes: EvidenceNode[],
  adj: Map<string, Set<string>>,
): number {
  let maxDist = 0;
  for (const source of nodes) {
    const dist = bfsDistances(source.object_id, nodes, adj);
    for (const d of dist.values()) {
      if (d > maxDist && d < Infinity) maxDist = d;
    }
  }
  return maxDist;
}

function bfsDistances(
  start: string,
  nodes: EvidenceNode[],
  adj: Map<string, Set<string>>,
): Map<string, number> {
  const dist = new Map<string, number>();
  for (const nd of nodes) dist.set(nd.object_id, Infinity);
  dist.set(start, 0);
  const queue = [start];
  while (queue.length > 0) {
    const v = queue.shift()!;
    const dv = dist.get(v)!;
    for (const w of adj.get(v) || []) {
      if (dist.get(w) === Infinity) {
        dist.set(w, dv + 1);
        queue.push(w);
      }
    }
  }
  return dist;
}

function countComponents(
  nodes: EvidenceNode[],
  adj: Map<string, Set<string>>,
): number {
  const visited = new Set<string>();
  let count = 0;
  for (const nd of nodes) {
    if (visited.has(nd.object_id)) continue;
    count++;
    const queue = [nd.object_id];
    visited.add(nd.object_id);
    while (queue.length > 0) {
      const v = queue.pop()!;
      for (const w of adj.get(v) || []) {
        if (!visited.has(w)) {
          visited.add(w);
          queue.push(w);
        }
      }
    }
  }
  return count;
}

function hasArticulationPoints(
  nodes: EvidenceNode[],
  adj: Map<string, Set<string>>,
): boolean {
  const origCount = countComponents(nodes, adj);
  for (const node of nodes) {
    const remaining = nodes.filter(n => n.object_id !== node.object_id);
    const subAdj = new Map<string, Set<string>>();
    for (const n of remaining) {
      const neighbors = new Set<string>();
      for (const w of adj.get(n.object_id) || []) {
        if (w !== node.object_id) neighbors.add(w);
      }
      subAdj.set(n.object_id, neighbors);
    }
    if (countComponents(remaining, subAdj) > origCount) return true;
  }
  return false;
}

function computeAvgClustering(
  nodes: EvidenceNode[],
  adj: Map<string, Set<string>>,
): number {
  if (nodes.length === 0) return 0;
  let sum = 0;
  for (const nd of nodes) {
    const neighbors = Array.from(adj.get(nd.object_id) || []);
    const k = neighbors.length;
    if (k < 2) continue;
    let triangles = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (adj.get(neighbors[i])?.has(neighbors[j])) {
          triangles++;
        }
      }
    }
    sum += (2 * triangles) / (k * (k - 1));
  }
  return sum / nodes.length;
}
