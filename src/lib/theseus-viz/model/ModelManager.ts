/* SPEC-VIE-3: Model orchestration with TF.js fallback to rules */

import type {
  TheseusResponse, EvidenceNode, EvidenceEdge,
  TensionSection, ClusterContextSection, EvidencePathSection,
} from '@/lib/theseus-types';
import type { SceneSpec, SceneNode, SceneEdge, DataShape, ModelWeightsBundle } from '../SceneSpec';
import { NODE_TYPE_COLORS, RELATION_COLORS } from '../SceneSpec';
import { extractNodeFeatures, NODE_FEATURE_DIM } from '../features/NodeFeatures';
import { extractEdgeFeatures, EDGE_FEATURE_DIM } from '../features/EdgeFeatures';
import { extractGraphFeatures } from '../features/GraphFeatures';
import { extractDataFeatures } from '../features/DataFeatures';
import { parseResponseSections } from '../features/parseResponse';
import { loadWeights, saveWeights } from '../training/ModelWeights';
import { ruleBasedConstruct, buildConstructionSequence, buildInteractionRules } from '../rules/RuleEngine';
import { computeForceLayout } from '../layouts/ForceLayout';
import { computeHierarchyLayout } from '../layouts/HierarchyLayout';
import { computeTensionLayout } from '../layouts/TensionLayout';
import { computeScatterLayout } from '../layouts/ScatterLayout';

type TFModule = typeof import('@tensorflow/tfjs');

class ModelManager {
  private weights: ModelWeightsBundle | null = null;
  private tf: TFModule | null = null;

  async initialize(): Promise<void> {
    // Load weights from IndexedDB
    this.weights = await loadWeights();

    // Try loading TF.js
    try {
      this.tf = await import('@tensorflow/tfjs');
    } catch {
      this.tf = null;
    }
  }

  isModelLoaded(): boolean {
    return this.weights !== null && this.tf !== null;
  }

  async construct(
    response: TheseusResponse,
    processedData?: unknown[],
    dataShape?: DataShape | null,
  ): Promise<SceneSpec> {
    if (!this.isModelLoaded()) {
      return ruleBasedConstruct(response, processedData, dataShape);
    }

    const startTime = performance.now();
    const tf = this.tf!;
    const weights = this.weights!;

    try {
      const { tensions, hypotheses, clusters, allNodes, allEdges } =
        parseResponseSections(response);

      const n = allNodes.length;
      if (n === 0) {
        return ruleBasedConstruct(response, processedData, dataShape);
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

      // Run graph head
      const graphFeatures = extractGraphFeatures(allNodes, allEdges, tensions.length, hypotheses.length);
      const dataFeat = extractDataFeatures(dataShape ?? null);
      const { classifyGraph } = await import('./GraphHead');
      const graphDecision = await classifyGraph(tf, nodeEmbeddings, graphFeatures, dataFeat, weights);

      // Run node head
      const { predictNodeLayouts } = await import('./NodeHead');
      const nodeLayouts = await predictNodeLayouts(tf, nodeEmbeddings, weights);

      // Refine positions with layout algorithm
      const initialPositions = nodeLayouts.map(nl => nl.initial_position);
      const positions = refinePositions(
        graphDecision.layout_type, allNodes, allEdges, tensions, clusters, initialPositions,
      );

      // Build scene
      const sceneNodes: SceneNode[] = allNodes.map((nd, i) => ({
        id: nd.object_id,
        label: nd.title,
        object_type: nd.object_type,
        epistemic_role: nd.epistemic_role,
        position: positions[i] || [0, 0, 0],
        scale: nodeLayouts[i]?.scale ?? 1.0,
        color: NODE_TYPE_COLORS[nd.object_type] || NODE_TYPE_COLORS.note,
        opacity: nodeLayouts[i]?.opacity ?? 1.0,
        claims: nd.claims,
        gradual_strength: nd.gradual_strength,
        metadata: {},
        interactive: true,
        is_hypothesis: nd.epistemic_role === 'hypothetical',
        is_context_shelf: false,
      }));

      const sceneEdges: SceneEdge[] = allEdges.map(e => ({
        from: e.from_id,
        to: e.to_id,
        strength: e.strength,
        signal_type: e.signal_type,
        relation: e.relation,
        dashed: e.signal_type === 'analogy' || e.strength < 0.2,
        color: RELATION_COLORS[e.relation] || RELATION_COLORS.neutral,
        width: 1 + e.strength * 2,
      }));

      // Camera from model
      const camera = {
        position: graphDecision.camera_position,
        lookAt: graphDecision.camera_lookAt,
        fov: 50,
        transition_duration_ms: 1200,
      };

      const constructionSequence = buildConstructionSequence(sceneNodes, sceneEdges);
      const interactions = buildInteractionRules(sceneNodes);

      // Cleanup tensors
      nodeFeatures.dispose();
      adjacencyMatrix.dispose();
      edgeFeatureMatrix.dispose();
      nodeEmbeddings.dispose();

      return {
        render_target: graphDecision.render_target,
        nodes: sceneNodes,
        edges: sceneEdges,
        camera,
        construction_sequence: constructionSequence,
        interactions,
        confidence: graphDecision.render_target_confidence,
        topology_type: graphDecision.layout_type,
        layout_used: graphDecision.layout_type,
        inference_method: 'learned',
        inference_time_ms: performance.now() - startTime,
      };
    } catch {
      // Fall back to rules on any failure
      return ruleBasedConstruct(response, processedData, dataShape);
    }
  }

  async updateWeights(bundle: ModelWeightsBundle): Promise<void> {
    this.weights = bundle;
    await saveWeights(bundle);
  }
}

function refinePositions(
  layoutType: string,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  tensions: TensionSection[],
  clusters: ClusterContextSection[],
  initialPositions: [number, number, number][],
): [number, number, number][] {
  switch (layoutType) {
    case 'force':
    case 'star':
    case 'dense_cluster':
    case 'mixed':
      return computeForceLayout(nodes, edges, initialPositions);
    case 'hierarchy':
    case 'linear_chain':
    case 'tree':
      return computeHierarchyLayout(nodes, edges);
    case 'bipartite_tension':
    case 'tension':
      return computeTensionLayout(nodes, edges, tensions);
    case 'scatter':
    case 'multi_cluster':
      return computeScatterLayout(nodes, edges, clusters);
    default:
      return computeForceLayout(nodes, edges, initialPositions);
  }
}

export const modelManager = new ModelManager();
