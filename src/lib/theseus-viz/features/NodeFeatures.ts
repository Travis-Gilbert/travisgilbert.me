/* SPEC-VIE-3: Per-node feature extraction (20 dimensions) */

import type { EvidenceNode, EvidenceEdge, EvidencePathSection } from '@/lib/theseus-types';
import { OBJECT_TYPES, EPISTEMIC_ROLES } from '../SceneDirective';

/**
 * Dimensions 0-4:   object_type one-hot (source, concept, person, hunch, note)
 * Dimension 5:      gradual_strength (0.0-1.0)
 * Dimension 6:      degree (normalized by max degree)
 * Dimension 7:      in_degree (normalized)
 * Dimension 8:      out_degree (normalized)
 * Dimension 9:      clustering_coefficient (0.0-1.0)
 * Dimension 10:     is_hub (1.0 if degree > 2x median)
 * Dimension 11:     is_bridge (1.0 if articulation point)
 * Dimension 12:     claim_count (normalized by max)
 * Dimensions 13-17: epistemic_role one-hot
 * Dimension 18:     is_hypothesis (1.0 if hypothetical)
 * Dimension 19:     betweenness_centrality (normalized)
 */
export const NODE_FEATURE_DIM = 20;

export function extractNodeFeatures(
  node: EvidenceNode,
  graph: EvidencePathSection,
): Float32Array {
  const features = new Float32Array(NODE_FEATURE_DIM);
  const { nodes, edges } = graph;

  // Build adjacency info
  const degreeMap = new Map<string, { total: number; inDeg: number; outDeg: number }>();
  for (const n of nodes) {
    degreeMap.set(n.object_id, { total: 0, inDeg: 0, outDeg: 0 });
  }
  for (const e of edges) {
    const from = degreeMap.get(e.from_id);
    const to = degreeMap.get(e.to_id);
    if (from) { from.total++; from.outDeg++; }
    if (to) { to.total++; to.inDeg++; }
  }

  const degrees = Array.from(degreeMap.values()).map(d => d.total);
  const maxDeg = Math.max(1, ...degrees);
  const sortedDeg = [...degrees].sort((a, b) => a - b);
  const medianDeg = sortedDeg[Math.floor(sortedDeg.length / 2)] || 1;
  const maxClaims = Math.max(1, ...nodes.map((n: EvidenceNode) => n.claims.length));

  const nodeDeg = degreeMap.get(node.object_id) || { total: 0, inDeg: 0, outDeg: 0 };

  // 0-4: object_type one-hot
  const typeIdx = OBJECT_TYPES.indexOf(node.object_type as typeof OBJECT_TYPES[number]);
  if (typeIdx >= 0) features[typeIdx] = 1.0;

  // 5: gradual_strength
  features[5] = Math.max(0, Math.min(1, node.gradual_strength));

  // 6-8: degree features (normalized)
  features[6] = nodeDeg.total / maxDeg;
  features[7] = nodeDeg.inDeg / maxDeg;
  features[8] = nodeDeg.outDeg / maxDeg;

  // 9: clustering coefficient
  features[9] = computeClusteringCoefficient(node.object_id, nodes, edges);

  // 10: is_hub
  features[10] = nodeDeg.total > 2 * medianDeg ? 1.0 : 0.0;

  // 11: is_bridge (articulation point)
  features[11] = isArticulationPoint(node.object_id, nodes, edges) ? 1.0 : 0.0;

  // 12: claim_count
  features[12] = node.claims.length / maxClaims;

  // 13-17: epistemic_role one-hot
  const roleIdx = EPISTEMIC_ROLES.indexOf(node.epistemic_role as typeof EPISTEMIC_ROLES[number]);
  if (roleIdx >= 0) features[13 + roleIdx] = 1.0;

  // 18: is_hypothesis
  features[18] = node.epistemic_role === 'hypothetical' ? 1.0 : 0.0;

  // 19: betweenness_centrality
  features[19] = computeBetweennessCentrality(node.object_id, nodes, edges);

  return features;
}

/** Local clustering coefficient: fraction of neighbor pairs that are connected */
function computeClusteringCoefficient(
  nodeId: string,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): number {
  const neighbors = new Set<string>();
  for (const e of edges) {
    if (e.from_id === nodeId) neighbors.add(e.to_id);
    if (e.to_id === nodeId) neighbors.add(e.from_id);
  }
  const k = neighbors.size;
  if (k < 2) return 0;

  let triangles = 0;
  const neighborArr = Array.from(neighbors);
  for (let i = 0; i < neighborArr.length; i++) {
    for (let j = i + 1; j < neighborArr.length; j++) {
      if (edgeExists(neighborArr[i], neighborArr[j], edges)) {
        triangles++;
      }
    }
  }
  return (2 * triangles) / (k * (k - 1));
}

function edgeExists(a: string, b: string, edges: EvidenceEdge[]): boolean {
  return edges.some(
    e => (e.from_id === a && e.to_id === b) || (e.from_id === b && e.to_id === a),
  );
}

/**
 * Simple articulation point detection via DFS.
 * A node is an articulation point if removing it increases component count.
 */
function isArticulationPoint(
  nodeId: string,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): boolean {
  if (nodes.length <= 2) return false;

  // Build adjacency for the graph without this node
  const remaining = nodes.filter(n => n.object_id !== nodeId).map(n => n.object_id);
  if (remaining.length === 0) return false;

  const adj = new Map<string, Set<string>>();
  for (const id of remaining) adj.set(id, new Set());
  for (const e of edges) {
    if (e.from_id === nodeId || e.to_id === nodeId) continue;
    adj.get(e.from_id)?.add(e.to_id);
    adj.get(e.to_id)?.add(e.from_id);
  }

  // Count components via BFS
  const visited = new Set<string>();
  let components = 0;
  for (const id of remaining) {
    if (visited.has(id)) continue;
    components++;
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const neighbor of adj.get(cur) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  // Original component count (with the node)
  const origAdj = new Map<string, Set<string>>();
  for (const n of nodes) origAdj.set(n.object_id, new Set());
  for (const e of edges) {
    origAdj.get(e.from_id)?.add(e.to_id);
    origAdj.get(e.to_id)?.add(e.from_id);
  }
  const origVisited = new Set<string>();
  let origComponents = 0;
  for (const n of nodes) {
    if (origVisited.has(n.object_id)) continue;
    origComponents++;
    const queue = [n.object_id];
    origVisited.add(n.object_id);
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const neighbor of origAdj.get(cur) || []) {
        if (!origVisited.has(neighbor)) {
          origVisited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  return components > origComponents;
}

/**
 * Betweenness centrality via BFS shortest paths from each node. O(n*m).
 * Returns normalized value in [0, 1].
 */
function computeBetweennessCentrality(
  nodeId: string,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): number {
  const n = nodes.length;
  if (n <= 2) return 0;

  // Build adjacency
  const adj = new Map<string, string[]>();
  for (const nd of nodes) adj.set(nd.object_id, []);
  for (const e of edges) {
    adj.get(e.from_id)?.push(e.to_id);
    adj.get(e.to_id)?.push(e.from_id);
  }

  let centrality = 0;

  for (const source of nodes) {
    const sid = source.object_id;
    // BFS from source
    const dist = new Map<string, number>();
    const sigma = new Map<string, number>(); // number of shortest paths
    const pred = new Map<string, string[]>();

    for (const nd of nodes) {
      dist.set(nd.object_id, -1);
      sigma.set(nd.object_id, 0);
      pred.set(nd.object_id, []);
    }
    dist.set(sid, 0);
    sigma.set(sid, 1);

    const queue: string[] = [sid];
    const stack: string[] = [];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);
      const dv = dist.get(v)!;
      for (const w of adj.get(v) || []) {
        const dw = dist.get(w)!;
        if (dw < 0) {
          dist.set(w, dv + 1);
          queue.push(w);
        }
        if (dist.get(w) === dv + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }

    // Back-propagation of dependencies
    const delta = new Map<string, number>();
    for (const nd of nodes) delta.set(nd.object_id, 0);

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        const contribution = (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
        delta.set(v, delta.get(v)! + contribution);
      }
      if (w !== sid) {
        // For undirected graph, each pair counted once (we sum from all sources)
      }
    }

    centrality += delta.get(nodeId) || 0;
  }

  // Normalize: max possible is (n-1)(n-2) for undirected
  const maxBC = (n - 1) * (n - 2);
  return maxBC > 0 ? Math.min(1, centrality / maxBC) : 0;
}
