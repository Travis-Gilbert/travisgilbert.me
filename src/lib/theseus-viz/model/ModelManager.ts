/* SPEC-VIE-3 v3: Model orchestration with TF.js fallback to rules */

import type { TheseusResponse, EvidenceNode, EvidenceEdge, EvidencePathSection } from '@/lib/theseus-types';
import type { SceneDirective, ModelWeightsBundle, RenderTargetDirective } from '../SceneDirective';
import { RENDER_TARGETS, TOPOLOGY_SHAPES, DATA_VIZ_TYPES } from '../SceneDirective';
import type { DataShape } from '../SceneSpec';
import { extractNodeFeatures, NODE_FEATURE_DIM } from '../features/NodeFeatures';
import { extractEdgeFeatures, EDGE_FEATURE_DIM } from '../features/EdgeFeatures';
import { extractGraphFeatures } from '../features/GraphFeatures';
import { extractDataFeatures } from '../features/DataFeatures';
import { parseResponseSections } from '../features/parseResponse';
import { loadWeights, saveWeights } from '../training/ModelWeights';
import { ruleBasedDirect } from '../rules/RuleEngine';
import { scoreSalience } from '../intelligence/SalienceScorer';
import { styleHypotheses } from '../intelligence/HypothesisStyler';
import { selectContextShelf } from '../intelligence/ContextShelfSelector';
import { composeSequence } from '../intelligence/SequenceComposer';
import { configureForces } from '../intelligence/ForceConfigurator';
import { composeCamera } from '../intelligence/CameraComposer';
import { interpretTopology } from '../intelligence/TopologyInterpreter';

type TFModule = typeof import('@tensorflow/tfjs');

class ModelManager {
  private weights: ModelWeightsBundle | null = null;
  private tf: TFModule | null = null;

  async initialize(): Promise<void> {
    this.weights = await loadWeights();
    try {
      this.tf = await import('@tensorflow/tfjs');
    } catch {
      this.tf = null;
    }
  }

  isModelLoaded(): boolean {
    return this.weights !== null && this.tf !== null;
  }

  async direct(
    response: TheseusResponse,
    processedData?: unknown[],
    dataShape?: DataShape | null,
  ): Promise<SceneDirective> {
    if (!this.isModelLoaded()) {
      return ruleBasedDirect(response, processedData, dataShape);
    }

    const startTime = performance.now();
    const tf = this.tf!;
    const weights = this.weights!;

    try {
      const { tensions, hypotheses, allNodes, allEdges } =
        parseResponseSections(response);

      const n = allNodes.length;
      if (n === 0) {
        return ruleBasedDirect(response, processedData, dataShape);
      }

      // Build feature matrices
      const evidencePath: EvidencePathSection = { type: 'evidence_path', nodes: allNodes, edges: allEdges };
      const nodeFeatureData = new Float32Array(n * NODE_FEATURE_DIM);
      for (let i = 0; i < n; i++) {
        const feat = extractNodeFeatures(allNodes[i], evidencePath);
        nodeFeatureData.set(feat, i * NODE_FEATURE_DIM);
      }
      const nodeFeatures = tf.tensor2d(nodeFeatureData, [n, NODE_FEATURE_DIM]);

      // Adjacency + edge features
      const adjData = new Float32Array(n * n);
      const edgeFeatData = new Float32Array(n * n * EDGE_FEATURE_DIM);
      const idToIdx = new Map<string, number>();
      allNodes.forEach((nd, i) => idToIdx.set(nd.object_id, i));

      for (const edge of allEdges) {
        const fi = idToIdx.get(edge.from_id);
        const ti = idToIdx.get(edge.to_id);
        if (fi === undefined || ti === undefined) continue;
        adjData[fi * n + ti] = 1;
        adjData[ti * n + fi] = 1;
        const ef = extractEdgeFeatures(edge);
        edgeFeatData.set(ef, (fi * n + ti) * EDGE_FEATURE_DIM);
        edgeFeatData.set(ef, (ti * n + fi) * EDGE_FEATURE_DIM);
      }

      const adjacencyMatrix = tf.tensor2d(adjData, [n, n]);
      const edgeFeatureMatrix = tf.tensor3d(edgeFeatData, [n, n, EDGE_FEATURE_DIM]);

      // Run encoder
      const { encode } = await import('./GraphEncoder');
      const nodeEmbeddings = await encode(tf, nodeFeatures, adjacencyMatrix, edgeFeatureMatrix, weights);

      // Run intelligence heads
      const graphFeatures = extractGraphFeatures(allNodes, allEdges, tensions.length, hypotheses.length);
      const dataFeat = extractDataFeatures(dataShape ?? null);
      const { runHeads } = await import('./IntelligenceHead');
      const heads = await runHeads(tf, nodeEmbeddings, graphFeatures, dataFeat, weights);

      // Feed learned outputs into intelligence modules

      // Job 7: Topology
      const topology = interpretTopology(
        allNodes, allEdges, tensions.length, hypotheses.length,
        { logits: heads.topologyLogits },
      );

      // Job 1: Salience
      const salience = scoreSalience(allNodes, allEdges, {
        perNode: heads.saliencePerNode,
      });

      // Job 2: Hypothesis styling
      const hypothesisStyle = styleHypotheses(allNodes, allEdges, {
        params: heads.hypothesisParams,
      });

      // Job 3: Context shelf
      const is3D = !dataShape;
      const contextShelf = selectContextShelf(allNodes, dataShape ?? null, is3D, {
        perNode: heads.shelfPerNode,
      });

      // Job 4: Construction sequence
      const isConstructing = !!processedData && processedData.length > 0;
      const construction = composeSequence(allNodes, allEdges, salience, isConstructing, {
        params: heads.sequenceParams,
      });

      // Job 5: Force configuration
      const forceConfig = configureForces(allNodes, allEdges, topology.primary_shape, {
        globalParams: heads.forceParams,
        perNode: heads.nodeForcePerNode,
      });

      // Job 6: Camera
      const camera = composeCamera(allNodes, salience, {
        params: heads.cameraParams,
      });

      // Render target from classification heads
      const renderTarget = classifyRenderTarget(heads.renderTargetLogits, heads.dataVizLogits, allNodes.length);

      // Cleanup tensors
      nodeFeatures.dispose();
      adjacencyMatrix.dispose();
      edgeFeatureMatrix.dispose();
      nodeEmbeddings.dispose();

      return {
        salience,
        hypothesis_style: hypothesisStyle,
        context_shelf: contextShelf,
        construction,
        force_config: forceConfig,
        camera,
        topology,
        render_target: renderTarget,
        inference_method: 'learned',
        inference_time_ms: performance.now() - startTime,
      };
    } catch {
      return ruleBasedDirect(response, processedData, dataShape);
    }
  }

  async updateWeights(bundle: ModelWeightsBundle): Promise<void> {
    this.weights = bundle;
    await saveWeights(bundle);
  }
}

function classifyRenderTarget(
  rtLogits: Float32Array,
  dvLogits: Float32Array,
  nodeCount: number,
): RenderTargetDirective {
  const rtIdx = argmax(rtLogits);
  const dvIdx = argmax(dvLogits);

  const primary = RENDER_TARGETS[rtIdx] as RenderTargetDirective['primary'];
  const dataVizType = DATA_VIZ_TYPES[dvIdx] as RenderTargetDirective['data_viz_type'];

  // Determine fallback
  const fallback: RenderTargetDirective['fallback'] =
    primary === 'sigma-2d' ? 'force-graph-3d' : 'sigma-2d';

  return {
    primary,
    fallback,
    reason: `learned model selected ${primary} (${nodeCount} nodes)`,
    data_viz_type: dataVizType,
  };
}

function argmax(arr: Float32Array): number {
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

export const modelManager = new ModelManager();
