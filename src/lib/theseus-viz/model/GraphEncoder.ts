/* SPEC-VIE-3: 2-layer graph message-passing network via TF.js matrix ops
 *
 * Layer 1: H1 = ReLU(A_hat * H0 * W1 + b1)     [N, 20] -> [N, 64]
 * Layer 2: H2 = ReLU(A_hat * H1 * W2 + b2)     [N, 64] -> [N, 64]
 * Skip:    H_out = H1 + H2                      [N, 64]
 *
 * Edge modulation: A_eff[i][j] = A[i][j] * sigmoid(edgeFeatures[i][j] * W_edge)
 *
 * Total parameters: W1[20,64] + b1[64] + W2[64,64] + b2[64] + W_edge[14,1] = 5,518
 */

import type { ModelWeightsBundle } from '../SceneSpec';

// TF.js type stubs (dynamic import)
type TFModule = typeof import('@tensorflow/tfjs');

const NODE_DIM = 20;
const HIDDEN_DIM = 64;
const EDGE_DIM = 14;

type Tensor = ReturnType<TFModule['tensor2d']>;

export async function encode(
  tf: TFModule,
  nodeFeatures: Tensor,
  adjacencyMatrix: Tensor,
  edgeFeatureMatrix: Tensor,
  weights: ModelWeightsBundle,
): Promise<Tensor> {
  // Create weight tensors
  const W1 = tf.tensor2d(weights.encoder_w1, [NODE_DIM, HIDDEN_DIM]);
  const b1 = tf.tensor1d(weights.encoder_b1);
  const W2 = tf.tensor2d(weights.encoder_w2, [HIDDEN_DIM, HIDDEN_DIM]);
  const b2 = tf.tensor1d(weights.encoder_b2);
  const W_edge = tf.tensor2d(weights.edge_w, [EDGE_DIM, 1]);

  try {
    // Compute edge-modulated adjacency
    // edgeFeatureMatrix is [N, N, 14], W_edge is [14, 1]
    // edgeWeights = sigmoid(edgeFeatures * W_edge) -> [N, N, 1] -> squeeze to [N, N]
    const edgeWeights = tf.sigmoid(
      tf.matMul(
        tf.reshape(edgeFeatureMatrix, [-1, EDGE_DIM]),
        W_edge,
      ),
    );
    const edgeWeightMatrix = tf.reshape(edgeWeights, adjacencyMatrix.shape);

    // A_eff = A * edgeWeights (element-wise)
    const A = tf.add(adjacencyMatrix, tf.eye(adjacencyMatrix.shape[0])); // A + I
    const A_eff = tf.mul(A, edgeWeightMatrix);

    // Normalize: D^{-1/2} * A_eff * D^{-1/2}
    const D = tf.sum(A_eff, 1); // degree vector
    const D_inv_sqrt = tf.pow(tf.add(D, 1e-8), -0.5);
    const D_inv_sqrt_mat = tf.diag(D_inv_sqrt);
    const A_hat = tf.matMul(tf.matMul(D_inv_sqrt_mat, A_eff), D_inv_sqrt_mat);

    // Layer 1: H1 = ReLU(A_hat * H0 * W1 + b1)
    const H0 = nodeFeatures;
    const H1_raw = tf.add(tf.matMul(tf.matMul(A_hat, H0), W1), b1);
    const H1 = tf.relu(H1_raw);

    // Layer 2: H2 = ReLU(A_hat * H1 * W2 + b2)
    const H2_raw = tf.add(tf.matMul(tf.matMul(A_hat, H1), W2), b2);
    const H2 = tf.relu(H2_raw);

    // Skip connection: H_out = H1 + H2
    const H_out = tf.add(H1, H2);

    return H_out as ReturnType<TFModule['tensor2d']>;
  } finally {
    W1.dispose();
    b1.dispose();
    W2.dispose();
    b2.dispose();
    W_edge.dispose();
  }
}
