/* SPEC-VIE-3: Cluster scatter layout */

import type { EvidenceNode, EvidenceEdge, ClusterContextSection } from '@/lib/theseus-types';
import { seededRandom, clamp } from './layoutUtils';

/**
 * Groups nodes by cluster membership.
 * Cluster centers placed via simple force simulation on cluster-level graph.
 * Members scatter within radius proportional to sqrt(member_count).
 */
export function computeScatterLayout(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  clusters: ClusterContextSection[],
): [number, number, number][] {
  if (nodes.length === 0) return [];

  // Assign nodes to clusters (by bridging_objects or default to cluster 0)
  const nodeCluster = new Map<string, number>();
  for (const cluster of clusters) {
    for (const objId of cluster.bridging_objects) {
      nodeCluster.set(objId, cluster.cluster_id);
    }
  }
  // Assign unassigned nodes to nearest cluster by edges, or cluster 0
  for (const nd of nodes) {
    if (nodeCluster.has(nd.object_id)) continue;
    // Find a neighbor that has a cluster
    let assigned = false;
    for (const e of edges) {
      const neighbor = e.from_id === nd.object_id ? e.to_id :
        e.to_id === nd.object_id ? e.from_id : null;
      if (neighbor && nodeCluster.has(neighbor)) {
        nodeCluster.set(nd.object_id, nodeCluster.get(neighbor)!);
        assigned = true;
        break;
      }
    }
    if (!assigned) nodeCluster.set(nd.object_id, 0);
  }

  // Group nodes by cluster
  const clusterMembers = new Map<number, string[]>();
  for (const nd of nodes) {
    const cid = nodeCluster.get(nd.object_id) || 0;
    const members = clusterMembers.get(cid);
    if (members) members.push(nd.object_id);
    else clusterMembers.set(cid, [nd.object_id]);
  }

  // Compute cluster centers: evenly spaced on a circle
  const clusterIds = Array.from(clusterMembers.keys());
  const clusterCount = clusterIds.length;
  const clusterCenters = new Map<number, [number, number]>();

  if (clusterCount === 1) {
    clusterCenters.set(clusterIds[0], [0, 0]);
  } else {
    const radius = 7;
    for (let i = 0; i < clusterCount; i++) {
      const angle = (2 * Math.PI * i) / clusterCount;
      clusterCenters.set(clusterIds[i], [
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      ]);
    }
  }

  // Scatter members around cluster centers
  const positions = new Map<string, [number, number, number]>();

  for (const [cid, members] of clusterMembers) {
    const [cx, cz] = clusterCenters.get(cid) || [0, 0];
    const scatterRadius = Math.min(5, Math.sqrt(members.length) * 1.2);

    for (let i = 0; i < members.length; i++) {
      const angle = (2 * Math.PI * i) / members.length + seededRandom(i * 13 + cid) * 0.5;
      const r = seededRandom(i * 7 + cid * 3 + 11) * scatterRadius;
      positions.set(members[i], [
        clamp(cx + r * Math.cos(angle)),
        seededRandom(i * 5 + cid + 19) * 2, // small y offset
        clamp(cz + r * Math.sin(angle)),
      ]);
    }
  }

  return nodes.map(nd => positions.get(nd.object_id) || [0, 0, 0]);
}

