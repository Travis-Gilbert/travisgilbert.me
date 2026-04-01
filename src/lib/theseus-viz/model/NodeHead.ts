/* SPEC-VIE-3: Per-node position/scale/opacity prediction
 *
 * node_params = sigmoid(H_out[i] * W_node + b_node)  [64] -> [5]
 * Output: [x, y, z, scale, opacity] all in [0, 1]
 * Rescaled: x,y,z -> [-10, 10], scale -> [0.3, 2.0], opacity -> [0.2, 1.0]
 *
 * Total parameters: W_node[64,5] + b_node[5] = 325
 */

import type { NodeLayout, ModelWeightsBundle } from '../SceneSpec';

type TFModule = typeof import('@tensorflow/tfjs');

export async function predictNodeLayouts(
  tf: TFModule,
  nodeEmbeddings: ReturnType<TFModule['tensor2d']>,
  weights: ModelWeightsBundle,
): Promise<NodeLayout[]> {
  const W_node = tf.tensor2d(weights.node_w, [64, 5]);
  const b_node = tf.tensor1d(weights.node_b);

  // Apply sigmoid(H * W + b) for all nodes at once
  const raw = tf.sigmoid(tf.add(tf.matMul(nodeEmbeddings, W_node), b_node)); // [N, 5]
  const rawData = await raw.data();
  const nodeCount = nodeEmbeddings.shape[0];

  const layouts: NodeLayout[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const offset = i * 5;
    const rx = rawData[offset];
    const ry = rawData[offset + 1];
    const rz = rawData[offset + 2];
    const rScale = rawData[offset + 3];
    const rOpacity = rawData[offset + 4];

    layouts.push({
      initial_position: [
        rx * 20 - 10,    // [0,1] -> [-10, 10]
        ry * 20 - 10,
        rz * 20 - 10,
      ],
      scale: rScale * 1.7 + 0.3,      // [0,1] -> [0.3, 2.0]
      opacity: rOpacity * 0.8 + 0.2,   // [0,1] -> [0.2, 1.0]
    });
  }

  W_node.dispose();
  b_node.dispose();
  raw.dispose();

  return layouts;
}
