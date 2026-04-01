/* SPEC-VIE-3 v3: Job 1, Salience scoring */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { NodeSalience } from '../SceneDirective';
import { buildDegreeMap, medianOfValues } from '../features/graphUtils';

export interface LearnedSalienceOutputs {
  /** Per-node: [importance, visual_weight, suggested_scale, suggested_opacity, suggested_emissive] */
  perNode: Float32Array[];
}

export function scoreSalience(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  learned?: LearnedSalienceOutputs,
): NodeSalience[] {
  if (learned) {
    return learnedSalience(nodes, learned);
  }
  return ruleBasedSalience(nodes, edges);
}

function ruleBasedSalience(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
): NodeSalience[] {
  const degreeMap = buildDegreeMap(nodes, edges);
  const medianDeg = medianOfValues(Array.from(degreeMap.values()));

  // importance = gradual_strength
  const ranked = nodes
    .map(nd => ({ id: nd.object_id, importance: nd.gradual_strength }))
    .sort((a, b) => b.importance - a.importance);

  const focalIds = new Set(ranked.slice(0, 3).map(r => r.id));

  return nodes.map(nd => {
    const importance = nd.gradual_strength;
    const degree = degreeMap.get(nd.object_id) || 0;
    const isHub = degree > 2 * medianDeg;
    const isFocal = focalIds.has(nd.object_id);

    return {
      node_id: nd.object_id,
      importance,
      visual_weight: importance,
      is_focal: isFocal,
      label_priority: isFocal ? 0 : isHub ? 1 : 2 + Math.round((1 - importance) * 10),
      suggested_scale: 0.7 + importance * 1.3,
      suggested_opacity: 0.3 + importance * 0.7,
      suggested_emissive: importance * 0.3,
    };
  });
}

function learnedSalience(
  nodes: EvidenceNode[],
  learned: LearnedSalienceOutputs,
): NodeSalience[] {
  // Determine focal nodes from learned importance
  const importances = learned.perNode.map(arr => arr[0]);
  const ranked = importances
    .map((imp, i) => ({ i, imp }))
    .sort((a, b) => b.imp - a.imp);
  const focalIndices = new Set(ranked.slice(0, 3).map(r => r.i));

  return nodes.map((nd, i) => {
    const arr = learned.perNode[i];
    const importance = arr[0];
    const isFocal = focalIndices.has(i);

    return {
      node_id: nd.object_id,
      importance,
      visual_weight: arr[1],
      is_focal: isFocal,
      label_priority: isFocal ? 0 : Math.round((1 - importance) * 10) + 1,
      suggested_scale: arr[2] * 1.7 + 0.3,
      suggested_opacity: arr[3] * 0.8 + 0.2,
      suggested_emissive: arr[4] * 0.5,
    };
  });
}
