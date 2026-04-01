/* SPEC-VIE-3 v3: Job 5, Force configuration */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type {
  ForceConfig, NodeForceDirective, ForceGroup,
  LinkStrengthOverride, TopologyShape,
} from '../SceneDirective';
import {
  buildDegreeMap, buildAdjacency, medianOfValues,
  findConnectedComponents, warmupTicksForSize,
} from '../features/graphUtils';

export interface LearnedForceOutputs {
  /** Graph-level: [charge_strength, center_gravity, collision_factor, alpha, alpha_decay] */
  globalParams: Float32Array;
  /** Per-node: [mass, center_pull] */
  perNode: Float32Array[];
}

export function configureForces(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  topology: TopologyShape,
  learned?: LearnedForceOutputs,
): ForceConfig {
  if (learned) {
    return learnedForces(nodes, edges, topology, learned);
  }
  return ruleBasedForces(nodes, edges, topology);
}

function ruleBasedForces(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  topology: TopologyShape,
): ForceConfig {
  const n = nodes.length;

  const degreeMap = buildDegreeMap(nodes, edges);
  const medianDeg = medianOfValues(Array.from(degreeMap.values()));

  let hubId: string | null = null;
  let maxDeg = 0;
  for (const [id, deg] of degreeMap) {
    if (deg > maxDeg) { maxDeg = deg; hubId = id; }
  }
  const hasHub = maxDeg > 2 * medianDeg;

  // Topology-specific base config
  let charge = -150;
  let centerGravity = 0.3;
  let collisionFactor = 1.0;

  switch (topology) {
    case 'star':
      charge = -200;
      centerGravity = 0.3;
      break;
    case 'linear_chain':
      charge = -100;
      centerGravity = 0.1;
      break;
    case 'dense_cluster':
      charge = -150;
      centerGravity = 0.5;
      collisionFactor = 1.5;
      break;
    case 'bipartite_tension':
      charge = -250;
      centerGravity = 0.1;
      break;
    case 'multi_cluster':
      charge = -100;
      break;
    case 'tree':
    case 'hierarchical':
      charge = -120;
      centerGravity = 0.2;
      break;
    case 'ring':
      charge = -100;
      centerGravity = 0.2;
      break;
    case 'mixed':
      charge = -150;
      centerGravity = 0.3;
      break;
  }

  // Per-node forces
  const nodeForces: NodeForceDirective[] = nodes.map(nd => {
    const deg = degreeMap.get(nd.object_id) || 0;
    const isNodeHub = hasHub && nd.object_id === hubId;
    const isLeaf = deg <= 1;

    const directive: NodeForceDirective = {
      node_id: nd.object_id,
      center_pull: isNodeHub ? 0.8 : 0.3,
      mass: isNodeHub ? 3.0 : isLeaf && topology === 'linear_chain' ? 0.5 : 1.0,
    };

    // Pin root at top for tree/hierarchical
    if ((topology === 'tree' || topology === 'hierarchical') && nd.object_id === hubId) {
      directive.pin_position = [0, 5, 0];
    }

    return directive;
  });

  // Groups
  const groups = detectGroups(nodes, edges, topology);

  // Link strengths
  const linkStrengths: LinkStrengthOverride[] = [];
  if (topology === 'multi_cluster') {
    // Inter-cluster links get reduced strength
    const nodeToGroup = new Map<string, string>();
    for (const g of groups) {
      for (const id of g.node_ids) nodeToGroup.set(id, g.group_id);
    }
    for (const e of edges) {
      const gFrom = nodeToGroup.get(e.from_id);
      const gTo = nodeToGroup.get(e.to_id);
      if (gFrom && gTo && gFrom !== gTo) {
        linkStrengths.push({ from_id: e.from_id, to_id: e.to_id, strength: 0.3 });
      }
    }
  }

  // Warmup ticks
  const warmupTicks = warmupTicksForSize(n);

  return {
    simulation_alpha: 0.7,
    simulation_alpha_decay: 0.02,
    warmup_ticks: warmupTicks,
    node_forces: nodeForces,
    groups,
    link_strengths: linkStrengths,
    center_gravity: centerGravity,
    charge_strength: charge,
    collision_radius_factor: collisionFactor,
  };
}

function learnedForces(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  topology: TopologyShape,
  learned: LearnedForceOutputs,
): ForceConfig {
  const n = nodes.length;
  const p = learned.globalParams;

  const nodeForces: NodeForceDirective[] = nodes.map((nd, i) => {
    const nf = learned.perNode[i];
    return {
      node_id: nd.object_id,
      mass: nf ? nf[0] * 3.0 + 0.5 : 1.0,
      center_pull: nf ? nf[1] : 0.3,
    };
  });

  const groups = detectGroups(nodes, edges, topology);
  const warmupTicks = warmupTicksForSize(n);

  return {
    simulation_alpha: p[3] * 0.7 + 0.3,
    simulation_alpha_decay: p[4] * 0.04 + 0.01,
    warmup_ticks: warmupTicks,
    node_forces: nodeForces,
    groups,
    link_strengths: [],
    center_gravity: p[1],
    charge_strength: -(p[0] * 270 + 30),
    collision_radius_factor: p[2] * 1.0 + 0.5,
  };
}

function detectGroups(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  topology: TopologyShape,
): ForceGroup[] {
  const adj = buildAdjacency(nodes, edges);
  const components = findConnectedComponents(nodes, adj);

  const groups: ForceGroup[] = components.map((comp, i) => {
    let cohesion = 0.5;
    if (topology === 'multi_cluster') cohesion = 0.7;
    if (topology === 'bipartite_tension') cohesion = 0.8;

    const group: ForceGroup = {
      group_id: `group-${i}`,
      node_ids: comp,
      cohesion,
    };

    // For bipartite tension, place two groups on opposite sides
    if (topology === 'bipartite_tension' && components.length === 2) {
      group.center_hint = i === 0 ? [-5, 0, 0] : [5, 0, 0];
    }

    return group;
  });

  return groups;
}
