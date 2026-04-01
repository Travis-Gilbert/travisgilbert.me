/* SPEC-VIE-3 v3: Topology classifier (delegates to GraphFeatures) */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { TopologyShape } from '../SceneDirective';
import { extractGraphFeatures, getTopologyType } from '../features/GraphFeatures';

export interface TopologyMetrics {
  density: number;
  diameter: number;
  has_hub: boolean;
  has_bridge_nodes: boolean;
  component_count: number;
  average_clustering: number;
  topology: TopologyShape;
}

export function classifyTopology(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  tensionCount = 0,
  hypothesisCount = 0,
): TopologyMetrics {
  const features = extractGraphFeatures(nodes, edges, tensionCount, hypothesisCount);
  const n = nodes.length;
  const topology = getTopologyType(features, nodes, edges);

  return {
    density: features[2],
    diameter: features[3] * Math.max(1, n - 1),
    has_hub: features[6] === 1.0,
    has_bridge_nodes: features[7] === 1.0,
    component_count: Math.round(1 / Math.max(0.01, features[8])),
    average_clustering: features[9],
    topology,
  };
}
