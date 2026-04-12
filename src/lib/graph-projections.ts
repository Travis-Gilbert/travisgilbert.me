import type Graph from 'graphology';
import type { InvestigationView, TheseusResponse, EvidencePathSection } from './theseus-types';

export interface NodeStyle {
  color?: string;
  size?: number;
  opacity?: number;
}

export interface EdgeStyle {
  color?: string;
  size?: number;
  opacity?: number;
}

export interface ProjectedGraph {
  visibleNodes: Set<string>;
  visibleEdges: Set<string>;
  nodeStyles: Map<string, NodeStyle>;
  edgeStyles: Map<string, EdgeStyle>;
}

export interface ViewContext {
  response: TheseusResponse | null;
  retrievalObjectIds?: Set<string>;
  focalObjectIds?: Set<string>;
}

// Pipeline stage colors for reasoning_trace view
const STAGE_COLORS: Record<string, string> = {
  L1: '#2D5F6B',
  L2: '#7B5EA7',
  L3: '#C4503C',
  L4: '#C49A4A',
};

// Ingestion method colors for provenance view
const INGESTION_COLORS: Record<string, string> = {
  corpus: '#2D5F6B',
  personal: '#C49A4A',
  web: '#C4503C',
  openalex: '#7B5EA7',
};

function allView(graph: Graph): ProjectedGraph {
  const visibleNodes = new Set<string>();
  const visibleEdges = new Set<string>();
  graph.forEachNode((node) => visibleNodes.add(node));
  graph.forEachEdge((edge) => visibleEdges.add(edge));
  return {
    visibleNodes,
    visibleEdges,
    nodeStyles: new Map(),
    edgeStyles: new Map(),
  };
}

function evidenceView(graph: Graph, context: ViewContext): ProjectedGraph {
  const visibleNodes = new Set<string>();
  const visibleEdges = new Set<string>();
  const nodeStyles = new Map<string, NodeStyle>();
  const edgeStyles = new Map<string, EdgeStyle>();

  if (!context.response) {
    return { visibleNodes, visibleEdges, nodeStyles, edgeStyles };
  }

  // Find evidence_path sections
  const evidenceSections = context.response.sections.filter(
    (s): s is EvidencePathSection => s.type === 'evidence_path',
  );

  for (const section of evidenceSections) {
    for (const node of section.nodes) {
      const id = String(node.object_id);
      visibleNodes.add(id);

      // Teal gradient by gradual_strength
      const strength = node.gradual_strength;
      const alpha = 0.3 + strength * 0.7;
      nodeStyles.set(id, {
        color: `rgba(45, 95, 107, ${alpha})`,
        size: 6 + strength * 16,
      });
    }

    for (const edge of section.edges) {
      const fromId = String(edge.from_id);
      const toId = String(edge.to_id);

      // Find matching edge in graph
      graph.forEachEdge(fromId, (edgeKey, _attrs, source, target) => {
        if ((source === fromId && target === toId) || (source === toId && target === fromId)) {
          visibleEdges.add(edgeKey);
          edgeStyles.set(edgeKey, {
            color: 'rgba(74, 138, 150, 0.5)',
            size: 1 + edge.strength * 2,
          });
        }
      });
    }
  }

  return { visibleNodes, visibleEdges, nodeStyles, edgeStyles };
}

function claimTensionView(graph: Graph): ProjectedGraph {
  const visibleNodes = new Set<string>();
  const visibleEdges = new Set<string>();
  const nodeStyles = new Map<string, NodeStyle>();
  const edgeStyles = new Map<string, EdgeStyle>();

  graph.forEachNode((node, attrs) => {
    const objectType = attrs.object_type as string;
    // Include nodes that are likely to have claims or tensions
    if (['source', 'concept', 'hunch', 'note'].includes(objectType)) {
      visibleNodes.add(node);
    }
  });

  graph.forEachEdge((edge, attrs, source, target) => {
    const edgeType = attrs.edge_type as string;
    if (edgeType === 'nli' || edgeType === 'tension' || edgeType === 'contradicts') {
      visibleEdges.add(edge);
      edgeStyles.set(edge, {
        color: '#C4503C',
        size: 2,
      });
      // Color contested nodes red
      nodeStyles.set(source, { color: '#C4503C' });
      nodeStyles.set(target, { color: '#C4503C' });
    }
  });

  // Default accepted nodes to green
  for (const node of visibleNodes) {
    if (!nodeStyles.has(node)) {
      nodeStyles.set(node, { color: '#5A8A5E' });
    }
  }

  return { visibleNodes, visibleEdges, nodeStyles, edgeStyles };
}

function entityNetworkView(graph: Graph): ProjectedGraph {
  const visibleNodes = new Set<string>();
  const visibleEdges = new Set<string>();
  const nodeStyles = new Map<string, NodeStyle>();
  const edgeStyles = new Map<string, EdgeStyle>();

  graph.forEachNode((node, attrs) => {
    const objectType = attrs.object_type as string;
    if (['person', 'concept'].includes(objectType)) {
      visibleNodes.add(node);
    }
  });

  graph.forEachEdge((edge, attrs, source, target) => {
    if (visibleNodes.has(source) || visibleNodes.has(target)) {
      visibleEdges.add(edge);
      // Also include the other end
      visibleNodes.add(source);
      visibleNodes.add(target);
    }
  });

  return { visibleNodes, visibleEdges, nodeStyles, edgeStyles };
}

function reasoningTraceView(graph: Graph, context: ViewContext): ProjectedGraph {
  const visibleNodes = new Set<string>();
  const visibleEdges = new Set<string>();
  const nodeStyles = new Map<string, NodeStyle>();
  const edgeStyles = new Map<string, EdgeStyle>();

  if (!context.response || !context.retrievalObjectIds) {
    return { visibleNodes, visibleEdges, nodeStyles, edgeStyles };
  }

  // Color nodes by retrieval stage
  let step = 0;
  const stages = ['L1', 'L2', 'L3', 'L4'];
  const idsPerStage = Math.ceil(context.retrievalObjectIds.size / stages.length);

  for (const id of context.retrievalObjectIds) {
    const stageIndex = Math.min(Math.floor(step / Math.max(idsPerStage, 1)), stages.length - 1);
    const stage = stages[stageIndex];
    visibleNodes.add(id);
    nodeStyles.set(id, {
      color: STAGE_COLORS[stage] ?? '#9a958d',
      size: 8 + (stages.length - stageIndex) * 3,
    });
    step++;
  }

  // Include edges between visible nodes
  graph.forEachEdge((edge, _attrs, source, target) => {
    if (visibleNodes.has(source) && visibleNodes.has(target)) {
      visibleEdges.add(edge);
    }
  });

  return { visibleNodes, visibleEdges, nodeStyles, edgeStyles };
}

function provenanceView(graph: Graph): ProjectedGraph {
  const visibleNodes = new Set<string>();
  const visibleEdges = new Set<string>();
  const nodeStyles = new Map<string, NodeStyle>();
  const edgeStyles = new Map<string, EdgeStyle>();

  graph.forEachNode((node, attrs) => {
    visibleNodes.add(node);
    // Color by ingestion method if available in metadata
    const metadata = attrs.metadata as Record<string, unknown> | undefined;
    const method = (metadata?.ingestion_method as string) ?? '';
    const color = INGESTION_COLORS[method] ?? '#9a958d';
    nodeStyles.set(node, { color });
  });

  graph.forEachEdge((edge) => visibleEdges.add(edge));

  return { visibleNodes, visibleEdges, nodeStyles, edgeStyles };
}

export function projectGraph(
  graph: Graph,
  view: InvestigationView,
  context: ViewContext,
): ProjectedGraph {
  switch (view) {
    case 'all':
      return allView(graph);
    case 'evidence':
      return evidenceView(graph, context);
    case 'claim_tension':
      return claimTensionView(graph);
    case 'entity_network':
      return entityNetworkView(graph);
    case 'reasoning_trace':
      return reasoningTraceView(graph, context);
    case 'provenance':
      return provenanceView(graph);
    default:
      return allView(graph);
  }
}
