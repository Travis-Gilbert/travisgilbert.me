/* SPEC-VIE-3: Rule-based fallback (cold-start, no ML) */

import type {
  TheseusResponse, EvidenceNode, EvidenceEdge,
  TensionSection, ClusterContextSection,
} from '@/lib/theseus-types';
import type {
  SceneSpec, SceneNode, SceneEdge, DataLayerSpec,
  CameraSpec, ConstructionStep, InteractionRule, DataShape,
  GraphDecision, TopologyType,
} from '../SceneSpec';
import { NODE_TYPE_COLORS, RELATION_COLORS } from '../SceneSpec';
import { extractGraphFeatures, getTopologyType } from '../features/GraphFeatures';
import { extractDataFeatures } from '../features/DataFeatures';
import { parseResponseSections } from '../features/parseResponse';
import { computeForceLayout } from '../layouts/ForceLayout';
import { computeHierarchyLayout } from '../layouts/HierarchyLayout';
import { computeTensionLayout } from '../layouts/TensionLayout';
import { computeScatterLayout } from '../layouts/ScatterLayout';
import { generateVegaSpec } from '../data-viz/VegaSpecGenerator';
import { generateD3Spec } from '../data-viz/D3SpecGenerator';

export function ruleBasedConstruct(
  response: TheseusResponse,
  processedData?: unknown[],
  dataShape?: DataShape | null,
): SceneSpec {
  const startTime = performance.now();

  const { tensions, hypotheses, clusters: clusterSections, allNodes, allEdges } =
    parseResponseSections(response);

  // Features
  const graphFeatures = extractGraphFeatures(allNodes, allEdges, tensions.length, hypotheses.length);
  const dataFeatures = extractDataFeatures(dataShape ?? null);

  // Topology
  const topologyType = getTopologyType(graphFeatures, allNodes, allEdges);

  // Rule-based decisions
  const renderTarget = selectRenderTarget(dataFeatures);
  const layoutType = selectLayout(topologyType);

  // Compute positions via selected layout
  const positions = computePositions(layoutType, allNodes, allEdges, tensions, clusterSections);

  // Pre-compute graph-level stats once
  const maxStrength = Math.max(0, ...allNodes.map(n => n.gradual_strength));
  const avgDegree = allEdges.length * 2 / Math.max(1, allNodes.length);
  const degreeMap = new Map<string, number>();
  for (const nd of allNodes) degreeMap.set(nd.object_id, 0);
  for (const e of allEdges) {
    degreeMap.set(e.from_id, (degreeMap.get(e.from_id) || 0) + 1);
    degreeMap.set(e.to_id, (degreeMap.get(e.to_id) || 0) + 1);
  }

  // Build scene nodes
  const sceneNodes: SceneNode[] = allNodes.map((nd, i) => {
    let scale = 1.0;
    if (nd.gradual_strength === maxStrength && nd.gradual_strength > 0.5) scale = 1.5;
    const degree = degreeMap.get(nd.object_id) || 0;
    if (degree > avgDegree * 2 && scale === 1.0) scale = 0.7;

    return {
      id: nd.object_id,
      label: nd.title,
      object_type: nd.object_type,
      epistemic_role: nd.epistemic_role,
      position: positions[i] || [0, 0, 0],
      scale,
      color: NODE_TYPE_COLORS[nd.object_type] || NODE_TYPE_COLORS.note,
      opacity: 1.0,
      claims: nd.claims,
      gradual_strength: nd.gradual_strength,
      metadata: {},
      interactive: true,
      is_hypothesis: nd.epistemic_role === 'hypothetical',
      is_context_shelf: false,
    };
  });

  // Build scene edges
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

  // Camera: 2x bounding box diagonal, looking at center of mass
  const camera = computeCamera(sceneNodes);

  // Data layer
  let dataLayer: DataLayerSpec | undefined;
  if (processedData && dataShape) {
    const graphDecision: GraphDecision = {
      render_target: renderTarget,
      render_target_confidence: 1.0,
      layout_type: topologyType,
      layout_type_confidence: 1.0,
      data_viz_type: 'none',
      camera_position: camera.position,
      camera_lookAt: camera.lookAt,
    };

    if (renderTarget === 'vega-lite') {
      const vegaSpec = generateVegaSpec(dataShape, processedData, graphDecision);
      dataLayer = {
        type: vegaSpec.chartType || 'custom',
        data: processedData,
        x_field: vegaSpec.xField || '',
        y_field: vegaSpec.yField || '',
        color_scale: 'viridis',
        vega_spec: vegaSpec.spec,
        context_shelf_nodes: [],
      };
    } else if (renderTarget === 'd3') {
      const d3Spec = generateD3Spec(dataShape, processedData, graphDecision);
      dataLayer = {
        type: mapD3Type(d3Spec.type),
        data: processedData,
        x_field: d3Spec.xField || '',
        y_field: d3Spec.yField || '',
        color_scale: 'viridis',
        d3_spec: d3Spec.spec,
        context_shelf_nodes: [],
      };
    }
  }

  // Construction sequence
  const constructionSequence = buildConstructionSequence(sceneNodes, sceneEdges);

  // Interaction rules
  const interactions = buildInteractionRules(sceneNodes);

  return {
    render_target: renderTarget,
    nodes: sceneNodes,
    edges: sceneEdges,
    data_layer: dataLayer,
    camera,
    construction_sequence: constructionSequence,
    interactions,
    confidence: response.confidence.combined,
    topology_type: topologyType,
    layout_used: layoutType,
    inference_method: 'rule_based',
    inference_time_ms: performance.now() - startTime,
  };
}

// ---- Rule-based decision functions ----

function selectRenderTarget(
  dataFeatures: Float32Array,
): 'r3f' | 'd3' | 'vega-lite' {
  if (dataFeatures[9] === 1.0) return 'd3';            // is_spatial
  if (dataFeatures[8] === 1.0) return 'vega-lite';     // is_timeseries
  if (dataFeatures[2] === 1.0 && dataFeatures[3] === 1.0) return 'vega-lite'; // categorical + numeric
  return 'r3f';
}

function selectLayout(topology: TopologyType): string {
  switch (topology) {
    case 'linear_chain': return 'hierarchy';
    case 'star': return 'force';
    case 'dense_cluster': return 'force';
    case 'bipartite_tension': return 'tension';
    case 'multi_cluster': return 'scatter';
    case 'tree': return 'hierarchy';
    case 'mixed': return 'force';
  }
}

function mapD3Type(type: string): DataLayerSpec['type'] {
  const mapping: Record<string, DataLayerSpec['type']> = {
    geo_heatmap: 'geographic',
    scatter_3d: 'scatter',
    network: 'custom',
    custom: 'custom',
  };
  return mapping[type] || 'custom';
}

function computePositions(
  layout: string,
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  tensions: TensionSection[],
  clusters: ClusterContextSection[],
): [number, number, number][] {
  switch (layout) {
    case 'hierarchy':
      return computeHierarchyLayout(nodes, edges);
    case 'tension':
      return computeTensionLayout(nodes, edges, tensions);
    case 'scatter':
      return computeScatterLayout(nodes, edges, clusters);
    case 'force':
    default:
      return computeForceLayout(nodes, edges);
  }
}

function computeCamera(nodes: SceneNode[]): CameraSpec {
  if (nodes.length === 0) {
    return { position: [0, 15, 20], lookAt: [0, 0, 0], fov: 50, transition_duration_ms: 1200 };
  }

  // Center of mass
  let cx = 0, cy = 0, cz = 0;
  for (const nd of nodes) {
    cx += nd.position[0];
    cy += nd.position[1];
    cz += nd.position[2];
  }
  cx /= nodes.length;
  cy /= nodes.length;
  cz /= nodes.length;

  // Bounding box diagonal
  let maxDist = 0;
  for (const nd of nodes) {
    const dx = nd.position[0] - cx;
    const dy = nd.position[1] - cy;
    const dz = nd.position[2] - cz;
    maxDist = Math.max(maxDist, Math.sqrt(dx * dx + dy * dy + dz * dz));
  }

  const cameraDist = Math.max(10, maxDist * 2);

  return {
    position: [cx, cy + cameraDist * 0.5, cz + cameraDist],
    lookAt: [cx, cy, cz],
    fov: 50,
    transition_duration_ms: 1200,
  };
}

export function buildConstructionSequence(
  nodes: SceneNode[],
  edges: SceneEdge[],
): ConstructionStep[] {
  const steps: ConstructionStep[] = [];

  // Phase 1: nodes appear
  steps.push({
    phase: 'nodes_appear',
    target_ids: nodes.map(n => n.id),
    delay_ms: 0,
    duration_ms: 600,
    easing: 'ease-out',
  });

  // Phase 2: edges draw
  if (edges.length > 0) {
    steps.push({
      phase: 'edges_draw',
      target_ids: edges.map(e => `${e.from}-${e.to}`),
      delay_ms: 400,
      duration_ms: 800,
      easing: 'ease-in-out',
    });
  }

  // Phase 3: crystallize
  steps.push({
    phase: 'crystallize',
    target_ids: [],
    delay_ms: 1000,
    duration_ms: 400,
    easing: 'spring',
  });

  return steps;
}

export function buildInteractionRules(nodes: SceneNode[]): InteractionRule[] {
  return nodes.map(nd => ({
    target_id: nd.id,
    on_click: nd.is_hypothesis ? 'validate_hypothesis' as const : 'narrate' as const,
    on_remove: nd.is_hypothesis ? 'none' as const : 'tms_cascade' as const,
    on_hover: 'highlight_edges' as const,
  }));
}
