/* SPEC-VIE-3 v3: Job 4, Construction sequence */

import type { EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';
import type { ConstructionSequence, ConstructionPhase, NodeSalience } from '../SceneDirective';

export interface LearnedSequenceOutputs {
  /** [theatricality, focal_first_weight, edge_delay_factor, cluster_coalesce_speed] */
  params: Float32Array;
}

/** isConstructing = true for CONSTRUCTING scene state (10s+ duration) */
export function composeSequence(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  salience: NodeSalience[],
  isConstructing: boolean,
  learned?: LearnedSequenceOutputs,
): ConstructionSequence {
  const theatricality = learned ? learned.params[0] : isConstructing ? 0.7 : 0.3;
  const timeMul = isConstructing ? 4.0 : 1.0;

  // Dramatic pauses scale with theatricality
  const pauseFactor = 1 + theatricality * 0.5;

  const focalIds = salience.filter(s => s.is_focal).map(s => s.node_id);
  const supportingIds = salience.filter(s => !s.is_focal).map(s => s.node_id);
  const edgeKeys = edges.map(e => `${e.from_id}->${e.to_id}`);

  const phases: ConstructionPhase[] = [];
  let t = 0;

  // Phase 1: Focal nodes appear
  const focalDur = 400 * timeMul * pauseFactor;
  phases.push({
    name: 'focal_nodes_appear',
    target_ids: focalIds,
    delay_ms: t,
    duration_ms: focalDur,
    easing: 'ease-out',
  });
  t += focalDur;

  // Phase 2: Supporting nodes appear
  const supportDur = 400 * timeMul * pauseFactor;
  phases.push({
    name: 'supporting_nodes_appear',
    target_ids: supportingIds,
    delay_ms: t,
    duration_ms: supportDur,
    easing: 'ease-out',
  });
  t += supportDur;

  // Phase 3: Edges draw
  const edgeDur = 600 * timeMul * pauseFactor;
  phases.push({
    name: 'edges_draw',
    target_ids: edgeKeys,
    delay_ms: t,
    duration_ms: edgeDur,
    easing: 'ease-in-out',
  });
  t += edgeDur;

  // Phase 4 (CONSTRUCTING only): Data builds
  if (isConstructing) {
    const dataDur = 2000 * pauseFactor;
    phases.push({
      name: 'data_builds',
      target_ids: [],
      delay_ms: t,
      duration_ms: dataDur,
      easing: 'ease-in-out',
    });
    t += dataDur;
  }

  // Phase 5: Labels fade in
  const labelDur = 400 * timeMul * pauseFactor;
  phases.push({
    name: 'labels_fade_in',
    target_ids: focalIds,
    delay_ms: t,
    duration_ms: labelDur,
    easing: 'ease-out',
  });
  t += labelDur;

  // Phase 6: Crystallize
  const crystalDur = 400 * timeMul * pauseFactor;
  phases.push({
    name: 'crystallize',
    target_ids: [],
    delay_ms: t,
    duration_ms: crystalDur,
    easing: 'spring',
  });
  t += crystalDur;

  // Enforce minimums
  const totalDuration = Math.max(
    t,
    isConstructing ? 10000 : 2000,
  );

  return {
    phases,
    total_duration_ms: totalDuration,
    theatricality,
  };
}
