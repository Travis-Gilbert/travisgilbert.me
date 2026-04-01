/* SPEC-VIE-3 v3: Job 6, Camera placement */

import type { EvidenceNode } from '@/lib/theseus-types';
import type { CameraDirective, NodeSalience } from '../SceneDirective';

export interface LearnedCameraOutputs {
  /** [pos_x, pos_y, pos_z, lookAt_x, lookAt_y, lookAt_z, distance_factor] */
  params: Float32Array;
}

export function composeCamera(
  nodes: EvidenceNode[],
  salience: NodeSalience[],
  learned?: LearnedCameraOutputs,
): CameraDirective {
  if (learned) {
    return learnedCamera(nodes, salience, learned);
  }
  return ruleBasedCamera(nodes, salience);
}

function ruleBasedCamera(
  nodes: EvidenceNode[],
  salience: NodeSalience[],
): CameraDirective {
  const n = nodes.length;

  if (n === 0) {
    return {
      initial_position: [0, 15, 20],
      initial_look_at: [0, 0, 0],
      initial_fov: 60,
      transition_duration_ms: 1200,
      distance_factor: 1.0,
    };
  }

  // Distance factor by node count
  const distanceFactor = n < 20 ? 1.0 : n <= 50 ? 1.5 : 2.0;

  // For camera placement we need estimated bounding box.
  // Since we don't have positions (force sim hasn't run yet),
  // estimate based on node count. Assume force sim spreads nodes in ~20x20 area.
  const estimatedSpread = Math.sqrt(n) * 3;
  const cameraDist = Math.max(10, estimatedSpread * 2) * distanceFactor;

  // Center of mass estimate: [0,0,0] since force sim hasn't run
  let cx = 0, cy = 0, cz = 0;

  // Find focal node for golden ratio framing
  const focal = salience.find(s => s.is_focal);

  const directive: CameraDirective = {
    initial_position: [cx, cy + cameraDist * 0.5, cz + cameraDist],
    initial_look_at: [cx, cy, cz],
    initial_fov: 60,
    transition_duration_ms: 1200,
    distance_factor: distanceFactor,
  };

  if (focal) {
    directive.focal_node_id = focal.node_id;
    // Offset camera for golden ratio framing (0.618 from left)
    const offset = estimatedSpread * 0.2; // shift right so focal is at golden ratio
    directive.initial_position = [cx + offset, cy + cameraDist * 0.5, cz + cameraDist];
  }

  return directive;
}

function learnedCamera(
  nodes: EvidenceNode[],
  salience: NodeSalience[],
  learned: LearnedCameraOutputs,
): CameraDirective {
  const p = learned.params;
  const focal = salience.find(s => s.is_focal);

  return {
    initial_position: [p[0] * 40 - 20, p[1] * 40, p[2] * 40 - 20],
    initial_look_at: [p[3] * 20 - 10, p[4] * 10, p[5] * 20 - 10],
    initial_fov: 60,
    transition_duration_ms: 1200,
    focal_node_id: focal?.node_id,
    distance_factor: p[6] * 2.0 + 0.5,
  };
}
