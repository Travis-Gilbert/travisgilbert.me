import type {
  EvidencePathSection,
  ObjectsSection,
  TheseusObject,
  TheseusResponse,
} from '@/lib/theseus-types';
import type {
  ConstructionPhase,
  SceneDirective,
} from '@/lib/theseus-viz/SceneDirective';

const TYPE_COLORS: Record<string, string> = {
  source: '#2D5F6B',
  concept: '#7B5EA7',
  person: '#C4503C',
  hunch: '#C49A4A',
  note: '#E8E5E0',
  event: '#4A8A96',
  task: '#D4B06A',
  paper: '#9A8E82',
};

const RELATION_COLORS: Record<string, string> = {
  supports: '#4A8A96',
  contradicts: '#C4503C',
  neutral: '#5C5851',
  elaborates: '#7B5EA7',
  temporal: '#C49A4A',
};

export interface RendererNode {
  id: string;
  label: string;
  objectType: string;
  color: string;
  baseScale: number;
  opacity: number;
  emissive: number;
  labelPriority: number;
  isHypothesis: boolean;
  isFocal: boolean;
  claims: string[];
  metadata?: Record<string, unknown>;
  initialPosition: [number, number, number];
}

export interface RendererEdge {
  id: string;
  source: string;
  target: string;
  strength: number;
  width: number;
  color: string;
  dashed: boolean;
  dashScale: number;
  relation: string;
  visibility: number;
}

export type PhaseName = ConstructionPhase['name'];

export interface ConstructionPlayback {
  elapsedMs: number;
  totalMs: number;
  phaseProgress: Record<PhaseName, number>;
  isComplete: boolean;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function getEvidenceSection(response: TheseusResponse): EvidencePathSection | null {
  return response.sections.find(
    (section): section is EvidencePathSection => section.type === 'evidence_path',
  ) ?? null;
}

function getObjectsSection(response: TheseusResponse): ObjectsSection | null {
  return response.sections.find(
    (section): section is ObjectsSection => section.type === 'objects',
  ) ?? null;
}

export function buildObjectLookup(response: TheseusResponse): Map<string, TheseusObject> {
  const objects = getObjectsSection(response)?.objects ?? [];
  return new Map(objects.map((object) => [object.id, object]));
}

function buildInitialPosition(index: number, count: number): [number, number, number] {
  if (count <= 1) return [0, 0, 0];
  const radius = Math.max(4, Math.min(10, count * 0.35));
  const angle = (Math.PI * 2 * index) / count;
  const height = ((index % 5) - 2) * 0.8;
  return [
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius,
  ];
}

export function buildRendererGraph(
  response: TheseusResponse,
  directive: SceneDirective,
): { nodes: RendererNode[]; edges: RendererEdge[] } {
  const evidence = getEvidenceSection(response);
  if (!evidence) {
    return { nodes: [], edges: [] };
  }

  const objectLookup = buildObjectLookup(response);
  const salienceByNodeId = new Map(
    directive.salience.map((salience) => [salience.node_id, salience]),
  );
  const hypothesisStyleByEdge = new Map(
    directive.hypothesis_style.edge_styles.map((style) => [style.edge_key, style]),
  );

  const nodes = evidence.nodes.map((node, index) => {
    const object = objectLookup.get(node.object_id);
    const salience = salienceByNodeId.get(node.object_id);
    const objectType = object?.object_type ?? node.object_type ?? 'note';

    return {
      id: node.object_id,
      label: node.title || object?.title || 'Untitled',
      objectType,
      color: TYPE_COLORS[objectType] ?? '#9A958D',
      baseScale: salience?.suggested_scale ?? clamp(node.gradual_strength, 0.45, 1.8),
      opacity: salience?.suggested_opacity ?? clamp(node.gradual_strength + 0.2, 0.2, 1),
      emissive: salience?.suggested_emissive ?? clamp(node.gradual_strength * 0.25, 0.05, 0.5),
      labelPriority: salience?.label_priority ?? index,
      isHypothesis:
        node.epistemic_role === 'hypothetical'
        || objectType === 'hunch',
      isFocal: salience?.is_focal ?? false,
      claims: node.claims,
      metadata: node.metadata,
      initialPosition: buildInitialPosition(index, evidence.nodes.length),
    };
  });

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  const edges = evidence.edges.map((edge) => {
    const edgeKey = `${edge.from_id}->${edge.to_id}`;
    const hypothesisStyle = hypothesisStyleByEdge.get(edgeKey);
    const sourceNode = nodeMap.get(edge.from_id);
    const targetNode = nodeMap.get(edge.to_id);
    const contradiction = edge.relation === 'contradicts';
    const hypothesis = hypothesisStyle || sourceNode?.isHypothesis || targetNode?.isHypothesis;

    return {
      id: edgeKey,
      source: edge.from_id,
      target: edge.to_id,
      strength: edge.strength,
      width: 0.5 + clamp((edge.strength - 0.3) / 0.7) * 2.5,
      color:
        contradiction
          ? '#C4503C'
          : hypothesisStyle?.color_override ?? RELATION_COLORS[edge.relation] ?? '#4A8A96',
      dashed: Boolean(hypothesis),
      dashScale: hypothesisStyle?.dash_scale ?? 1,
      relation: edge.relation,
      visibility: hypothesisStyle?.visibility ?? 1,
    };
  });

  return { nodes, edges };
}

export function getVisibleLabelIds(
  nodes: RendererNode[],
  playback: ConstructionPlayback,
): Set<string> {
  const labelPhaseProgress = Math.max(
    playback.phaseProgress.labels_fade_in,
    playback.phaseProgress.crystallize,
  );

  if (labelPhaseProgress <= 0) {
    return new Set();
  }

  const sorted = [...nodes].sort((left, right) => left.labelPriority - right.labelPriority);
  const maxLabels = Math.min(15, Math.max(1, Math.ceil(15 * labelPhaseProgress)));
  return new Set(sorted.slice(0, maxLabels).map((node) => node.id));
}

function getPhase(directive: SceneDirective, name: PhaseName): ConstructionPhase | undefined {
  return directive.construction.phases.find((phase) => phase.name === name);
}

export function getNodeRevealProgress(
  nodeId: string,
  directive: SceneDirective,
  playback: ConstructionPlayback,
): number {
  const focal = getPhase(directive, 'focal_nodes_appear');
  const supporting = getPhase(directive, 'supporting_nodes_appear');
  const crystallize = playback.phaseProgress.crystallize;

  if (focal?.target_ids.includes(nodeId)) {
    return clamp(Math.max(playback.phaseProgress.focal_nodes_appear, crystallize));
  }
  if (supporting?.target_ids.includes(nodeId)) {
    return clamp(Math.max(playback.phaseProgress.supporting_nodes_appear, crystallize));
  }
  return clamp(crystallize > 0 ? crystallize : 1);
}

export function getEdgeRevealProgress(
  edgeId: string,
  directive: SceneDirective,
  playback: ConstructionPlayback,
): number {
  const edgePhase = getPhase(directive, 'edges_draw');
  if (!edgePhase?.target_ids.includes(edgeId)) {
    return playback.phaseProgress.crystallize > 0 ? playback.phaseProgress.crystallize : 1;
  }

  return clamp(Math.max(playback.phaseProgress.edges_draw, playback.phaseProgress.crystallize));
}

export function getClusterCoalesceProgress(playback: ConstructionPlayback): number {
  return clamp(Math.max(playback.phaseProgress.clusters_coalesce, playback.phaseProgress.crystallize));
}

export function getDataBuildProgress(playback: ConstructionPlayback): number {
  return clamp(Math.max(playback.phaseProgress.data_builds, playback.phaseProgress.crystallize));
}

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${clamp(alpha)})`;
}
