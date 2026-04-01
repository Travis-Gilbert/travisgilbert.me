/* SPEC-VIE-3: Graph-level classification + regression head
 *
 * Input: mean-pooled node embeddings [64] + graph features [16] + data features [10] = [90]
 * Hidden: z = ReLU(input * W3 + b3)  [90] -> [32]
 * Outputs:
 *   render_target  = softmax(z * W_rt + b_rt)   [32] -> [3]
 *   layout_type    = softmax(z * W_lt + b_lt)   [32] -> [7]
 *   data_viz_type  = softmax(z * W_dv + b_dv)   [32] -> [8]
 *   camera_params  = z * W_cam + b_cam           [32] -> [6]
 *
 * Total parameters: 90*32+32 + 32*3+3 + 32*7+7 + 32*8+8 + 32*6+6 = 3,674
 */

import type { GraphDecision, ModelWeightsBundle, TopologyType } from '../SceneSpec';
import { RENDER_TARGETS, LAYOUT_TYPES, DATA_VIZ_TYPES } from '../SceneSpec';

type TFModule = typeof import('@tensorflow/tfjs');

export async function classifyGraph(
  tf: TFModule,
  nodeEmbeddings: ReturnType<TFModule['tensor2d']>,
  graphFeatures: Float32Array,
  dataFeatures: Float32Array,
  weights: ModelWeightsBundle,
): Promise<GraphDecision> {
  // Mean-pool node embeddings: [N, 64] -> [64]
  const graphEmbed = tf.mean(nodeEmbeddings, 0); // [64]

  // Concatenate: [64] + [16] + [10] = [90]
  const gf = tf.tensor1d(graphFeatures);
  const df = tf.tensor1d(dataFeatures);
  const input = tf.concat([graphEmbed, gf, df]); // [90]
  const inputBatch = tf.expandDims(input, 0); // [1, 90]

  // Hidden layer
  const W3 = tf.tensor2d(weights.head_w3, [90, 32]);
  const b3 = tf.tensor1d(weights.head_b3);
  const z = tf.relu(tf.add(tf.matMul(inputBatch, W3), b3)); // [1, 32]

  // Classification heads
  const W_rt = tf.tensor2d(weights.head_w_rt, [32, 3]);
  const b_rt = tf.tensor1d(weights.head_b_rt);
  const rtLogits = tf.add(tf.matMul(z, W_rt), b_rt); // [1, 3]
  const rtProbs = tf.softmax(rtLogits);

  const W_lt = tf.tensor2d(weights.head_w_lt, [32, 7]);
  const b_lt = tf.tensor1d(weights.head_b_lt);
  const ltLogits = tf.add(tf.matMul(z, W_lt), b_lt); // [1, 7]
  const ltProbs = tf.softmax(ltLogits);

  const W_dv = tf.tensor2d(weights.head_w_dv, [32, 8]);
  const b_dv = tf.tensor1d(weights.head_b_dv);
  const dvLogits = tf.add(tf.matMul(z, W_dv), b_dv); // [1, 8]
  const dvProbs = tf.softmax(dvLogits);

  // Regression head
  const W_cam = tf.tensor2d(weights.head_w_cam, [32, 6]);
  const b_cam = tf.tensor1d(weights.head_b_cam);
  const camParams = tf.add(tf.matMul(z, W_cam), b_cam); // [1, 6]

  // Download all tensor data in parallel
  const [rtArr, ltArr, dvArr, camArr] = await Promise.all([
    rtProbs.data(), ltProbs.data(), dvProbs.data(), camParams.data(),
  ]);

  const rtIdx = argmax(rtArr);
  const ltIdx = argmax(ltArr);
  const dvIdx = argmax(dvArr);

  // Cleanup
  const tensors = [graphEmbed, gf, df, input, inputBatch, W3, b3, z,
    W_rt, b_rt, rtLogits, rtProbs, W_lt, b_lt, ltLogits, ltProbs,
    W_dv, b_dv, dvLogits, dvProbs, W_cam, b_cam, camParams];
  for (const t of tensors) t.dispose();

  return {
    render_target: RENDER_TARGETS[rtIdx] as GraphDecision['render_target'],
    render_target_confidence: rtArr[rtIdx],
    layout_type: LAYOUT_TYPES[ltIdx] as TopologyType,
    layout_type_confidence: ltArr[ltIdx],
    data_viz_type: DATA_VIZ_TYPES[dvIdx],
    camera_position: [camArr[0] * 20 - 10, camArr[1] * 20, camArr[2] * 20 - 10],
    camera_lookAt: [camArr[3] * 20 - 10, camArr[4] * 10, camArr[5] * 20 - 10],
  };
}

function argmax(arr: Float32Array | Int32Array | Uint8Array): number {
  let maxIdx = 0;
  let maxVal = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > maxVal) {
      maxVal = arr[i];
      maxIdx = i;
    }
  }
  return maxIdx;
}
