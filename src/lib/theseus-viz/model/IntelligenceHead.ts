/* SPEC-VIE-3 v3: Multi-task output head
 *
 * Input: mean(H_out) [64] + graphFeatures [16] + dataFeatures [10] = [90]
 * Shared: z = ReLU(input * W_shared + b_shared)  [90] -> [48]
 *
 * Per-node heads (from H_out directly):
 *   salience:     sigmoid(H_out[i] * W_sal + b_sal)     [64] -> [5]  325 params
 *   shelf_score:  sigmoid(H_out[i] * W_shelf + b_shelf)  [64] -> [1]   65 params
 *   node_force:   sigmoid(H_out[i] * W_nf + b_nf)       [64] -> [2]  130 params
 *
 * Graph-level heads (from z):
 *   hypothesis:   sigmoid(z * W_hyp + b_hyp)      [48] -> [2]   98 params
 *   sequence:     sigmoid(z * W_seq + b_seq)       [48] -> [4]  196 params
 *   force:        z * W_force + b_force            [48] -> [5]  245 params
 *   camera:       z * W_cam + b_cam                [48] -> [7]  343 params
 *   topology:     z * W_topo + b_topo              [48] -> [9]  441 params
 *   render_target: z * W_rt + b_rt                 [48] -> [4]  196 params
 *   data_viz:     z * W_dv + b_dv                  [48] -> [10] 490 params
 *
 * Shared: 90*48+48 = 4,368
 * Heads: 325+65+130+98+196+245+343+441+196+490 = 2,529
 * Total model: encoder(5,518) + shared(4,368) + heads(2,529) = 12,415
 */

import type { ModelWeightsBundle } from '../SceneDirective';

type TFModule = typeof import('@tensorflow/tfjs');
type Tensor2D = ReturnType<TFModule['tensor2d']>;

export interface HeadOutputs {
  /** Per-node salience: [importance, visual_weight, scale, opacity, emissive] */
  saliencePerNode: Float32Array[];
  /** Per-node shelf score */
  shelfPerNode: number[];
  /** Per-node force: [mass, center_pull] */
  nodeForcePerNode: Float32Array[];
  /** Graph-level hypothesis: [global_tentative_factor, default_dash_scale] */
  hypothesisParams: Float32Array;
  /** Graph-level sequence: [theatricality, focal_first_weight, edge_delay_factor, cluster_coalesce_speed] */
  sequenceParams: Float32Array;
  /** Graph-level force: [charge_strength, center_gravity, collision_factor, alpha, alpha_decay] */
  forceParams: Float32Array;
  /** Graph-level camera: [pos_x, pos_y, pos_z, lookAt_x, lookAt_y, lookAt_z, distance_factor] */
  cameraParams: Float32Array;
  /** Graph-level topology logits (9 shapes) */
  topologyLogits: Float32Array;
  /** Graph-level render target logits (4 targets) */
  renderTargetLogits: Float32Array;
  /** Graph-level data viz logits (10 types) */
  dataVizLogits: Float32Array;
}

export async function runHeads(
  tf: TFModule,
  nodeEmbeddings: Tensor2D,
  graphFeatures: Float32Array,
  dataFeatures: Float32Array,
  weights: ModelWeightsBundle,
): Promise<HeadOutputs> {
  const nodeCount = nodeEmbeddings.shape[0];

  // Mean-pool: g = mean(H_out, axis=0) -> [64]
  const graphEmbed = tf.mean(nodeEmbeddings, 0);

  // Concatenate: [g; graphFeatures; dataFeatures] = [90]
  const gf = tf.tensor1d(graphFeatures);
  const df = tf.tensor1d(dataFeatures);
  const input = tf.concat([graphEmbed, gf, df]); // [90]
  const inputBatch = tf.expandDims(input, 0); // [1, 90]

  // Shared hidden: z = ReLU(input * W_shared + b_shared) [1, 48]
  const W_shared = tf.tensor2d(weights.shared_w, [90, 48]);
  const b_shared = tf.tensor1d(weights.shared_b);
  const z = tf.relu(tf.add(tf.matMul(inputBatch, W_shared), b_shared));

  // ---- Per-node heads ----

  // Salience: sigmoid(H_out * W_sal + b_sal) -> [N, 5]
  const W_sal = tf.tensor2d(weights.sal_w, [64, 5]);
  const b_sal = tf.tensor1d(weights.sal_b);
  const salRaw = tf.sigmoid(tf.add(tf.matMul(nodeEmbeddings, W_sal), b_sal));

  // Shelf: sigmoid(H_out * W_shelf + b_shelf) -> [N, 1]
  const W_shelf = tf.tensor2d(weights.shelf_w, [64, 1]);
  const b_shelf = tf.tensor1d(weights.shelf_b);
  const shelfRaw = tf.sigmoid(tf.add(tf.matMul(nodeEmbeddings, W_shelf), b_shelf));

  // Node force: sigmoid(H_out * W_nf + b_nf) -> [N, 2]
  const W_nf = tf.tensor2d(weights.nf_w, [64, 2]);
  const b_nf = tf.tensor1d(weights.nf_b);
  const nfRaw = tf.sigmoid(tf.add(tf.matMul(nodeEmbeddings, W_nf), b_nf));

  // ---- Graph-level heads ----

  // Hypothesis: sigmoid(z * W_hyp + b_hyp) -> [1, 2]
  const W_hyp = tf.tensor2d(weights.hyp_w, [48, 2]);
  const b_hyp = tf.tensor1d(weights.hyp_b);
  const hypRaw = tf.sigmoid(tf.add(tf.matMul(z, W_hyp), b_hyp));

  // Sequence: sigmoid(z * W_seq + b_seq) -> [1, 4]
  const W_seq = tf.tensor2d(weights.seq_w, [48, 4]);
  const b_seq = tf.tensor1d(weights.seq_b);
  const seqRaw = tf.sigmoid(tf.add(tf.matMul(z, W_seq), b_seq));

  // Force: z * W_force + b_force -> [1, 5]
  const W_force = tf.tensor2d(weights.force_w, [48, 5]);
  const b_force = tf.tensor1d(weights.force_b);
  const forceRaw = tf.add(tf.matMul(z, W_force), b_force);

  // Camera: z * W_cam + b_cam -> [1, 7]
  const W_cam = tf.tensor2d(weights.cam_w, [48, 7]);
  const b_cam = tf.tensor1d(weights.cam_b);
  const camRaw = tf.add(tf.matMul(z, W_cam), b_cam);

  // Topology: z * W_topo + b_topo -> [1, 9]
  const W_topo = tf.tensor2d(weights.topo_w, [48, 9]);
  const b_topo = tf.tensor1d(weights.topo_b);
  const topoRaw = tf.add(tf.matMul(z, W_topo), b_topo);

  // Render target: z * W_rt + b_rt -> [1, 4]
  const W_rt = tf.tensor2d(weights.rt_w, [48, 4]);
  const b_rt = tf.tensor1d(weights.rt_b);
  const rtRaw = tf.add(tf.matMul(z, W_rt), b_rt);

  // Data viz: z * W_dv + b_dv -> [1, 10]
  const W_dv = tf.tensor2d(weights.dv_w, [48, 10]);
  const b_dv = tf.tensor1d(weights.dv_b);
  const dvRaw = tf.add(tf.matMul(z, W_dv), b_dv);

  // Download all data in parallel
  const [salData, shelfData, nfData, hypData, seqData, forceData, camData, topoData, rtData, dvData] =
    await Promise.all([
      salRaw.data(), shelfRaw.data(), nfRaw.data(),
      hypRaw.data(), seqRaw.data(), forceRaw.data(), camRaw.data(),
      topoRaw.data(), rtRaw.data(), dvRaw.data(),
    ]);

  // Parse per-node arrays
  const saliencePerNode: Float32Array[] = [];
  const shelfPerNode: number[] = [];
  const nodeForcePerNode: Float32Array[] = [];
  for (let i = 0; i < nodeCount; i++) {
    saliencePerNode.push(salData.slice(i * 5, i * 5 + 5) as Float32Array);
    shelfPerNode.push(shelfData[i]);
    nodeForcePerNode.push(nfData.slice(i * 2, i * 2 + 2) as Float32Array);
  }

  const result: HeadOutputs = {
    saliencePerNode,
    shelfPerNode,
    nodeForcePerNode,
    hypothesisParams: new Float32Array(hypData),
    sequenceParams: new Float32Array(seqData),
    forceParams: new Float32Array(forceData),
    cameraParams: new Float32Array(camData),
    topologyLogits: new Float32Array(topoData),
    renderTargetLogits: new Float32Array(rtData),
    dataVizLogits: new Float32Array(dvData),
  };

  // Cleanup all tensors
  const tensors = [
    graphEmbed, gf, df, input, inputBatch, W_shared, b_shared, z,
    W_sal, b_sal, salRaw, W_shelf, b_shelf, shelfRaw, W_nf, b_nf, nfRaw,
    W_hyp, b_hyp, hypRaw, W_seq, b_seq, seqRaw,
    W_force, b_force, forceRaw, W_cam, b_cam, camRaw,
    W_topo, b_topo, topoRaw, W_rt, b_rt, rtRaw, W_dv, b_dv, dvRaw,
  ];
  for (const t of tensors) t.dispose();

  return result;
}
