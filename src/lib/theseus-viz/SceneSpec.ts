/* SPEC-VIE-3: SceneSpec output contract and all shared types */

// ---- Topology ----

export type TopologyType =
  | 'linear_chain'
  | 'star'
  | 'dense_cluster'
  | 'bipartite_tension'
  | 'multi_cluster'
  | 'tree'
  | 'mixed';

// ---- DataShape (describes processed tabular data) ----

export interface ColumnDescriptor {
  name: string;
  type: 'numeric' | 'categorical' | 'temporal' | 'geographic' | 'text';
  unique_count?: number;
}

export interface DataShape {
  columns: ColumnDescriptor[];
  row_count: number;
  has_geographic: boolean;
  has_temporal: boolean;
  has_categorical: boolean;
  has_numeric: boolean;
}

// ---- Scene nodes and edges ----

export interface SceneNode {
  id: string;
  label: string;
  object_type: string;
  epistemic_role: string;
  position: [number, number, number];
  scale: number;
  color: string;
  opacity: number;
  claims: string[];
  gradual_strength: number;
  metadata: Record<string, unknown>;
  interactive: boolean;
  is_hypothesis: boolean;
  is_context_shelf: boolean;
}

export interface SceneEdge {
  from: string;
  to: string;
  strength: number;
  signal_type: string;
  relation: string;
  dashed: boolean;
  color: string;
  width: number;
}

// ---- Data layer ----

export interface DataLayerSpec {
  type: 'heatmap' | 'surface' | 'scatter' | 'bar' | 'line' | 'geographic' | 'custom';
  data: unknown[];
  x_field: string;
  y_field: string;
  value_field?: string;
  color_scale: string;
  geo_bounds?: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
  vega_spec?: object;
  d3_spec?: object;
  context_shelf_nodes: string[];
}

// ---- Camera ----

export interface CameraSpec {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
  transition_duration_ms: number;
}

// ---- Construction animation ----

export interface ConstructionStep {
  phase: 'nodes_appear' | 'edges_draw' | 'clusters_form' | 'data_builds' | 'crystallize';
  target_ids: string[];
  delay_ms: number;
  duration_ms: number;
  easing: 'ease-out' | 'ease-in-out' | 'spring';
}

// ---- Interaction rules ----

export interface InteractionRule {
  target_id: string;
  on_click: 'narrate' | 'expand_neighborhood' | 'validate_hypothesis';
  on_remove: 'tms_cascade' | 'none';
  on_hover: 'highlight_edges' | 'show_label' | 'none';
}

// ---- Graph decision (model output) ----

export interface GraphDecision {
  render_target: 'r3f' | 'd3' | 'vega-lite';
  render_target_confidence: number;
  layout_type: TopologyType;
  layout_type_confidence: number;
  data_viz_type: string;
  camera_position: [number, number, number];
  camera_lookAt: [number, number, number];
}

// ---- Node layout (model output per node) ----

export interface NodeLayout {
  initial_position: [number, number, number];
  scale: number;   // 0.3 to 2.0
  opacity: number; // 0.2 to 1.0
}

// ---- Top-level SceneSpec ----

export interface SceneSpec {
  render_target: 'r3f' | 'd3' | 'vega-lite';

  // Graph layer (always present)
  nodes: SceneNode[];
  edges: SceneEdge[];

  // Data layer (present for data-driven answers)
  data_layer?: DataLayerSpec;

  // Camera
  camera: CameraSpec;

  // How to build this scene (animation timeline)
  construction_sequence: ConstructionStep[];

  // What the user can do
  interactions: InteractionRule[];

  // Metadata
  confidence: number;
  topology_type: TopologyType;
  layout_used: string;
  inference_method: 'learned' | 'rule_based';
  inference_time_ms: number;
}

// ---- Model weights bundle ----

export interface ModelWeightsBundle {
  encoder_w1: Float32Array;   // [20 * 64]
  encoder_b1: Float32Array;   // [64]
  encoder_w2: Float32Array;   // [64 * 64]
  encoder_b2: Float32Array;   // [64]
  edge_w: Float32Array;       // [14]
  head_w3: Float32Array;      // [90 * 32]
  head_b3: Float32Array;      // [32]
  head_w_rt: Float32Array;    // [32 * 3]
  head_b_rt: Float32Array;    // [3]
  head_w_lt: Float32Array;    // [32 * 7]
  head_b_lt: Float32Array;    // [7]
  head_w_dv: Float32Array;    // [32 * 8]
  head_b_dv: Float32Array;    // [8]
  head_w_cam: Float32Array;   // [32 * 6]
  head_b_cam: Float32Array;   // [6]
  node_w: Float32Array;       // [64 * 5]
  node_b: Float32Array;       // [5]
  version: number;
  trained_on_samples: number;
}

// ---- Feedback types ----

export interface VizFeedback {
  query_hash: string;
  topology_type: TopologyType;
  render_target: string;
  layout_used: string;
  inference_method: 'learned' | 'rule_based';
  node_count: number;
  edge_count: number;
  has_data_layer: boolean;

  nodes_clicked: string[];
  nodes_clicked_within_3s: string[];
  nodes_visible_not_clicked: string[];
  dwell_time_per_node: Record<string, number>;
  what_if_removals: number;
  cluster_what_ifs: number;
  follow_ups_asked: number;
  model_saved: boolean;
  gif_exported: boolean;

  thumbs: 'up' | 'down' | null;
  wrong_connections: string[];
  useful_connections: string[];

  time_to_first_interaction_ms: number;
  total_session_ms: number;
  construction_watched_fully: boolean;
}

export interface TrainingSample {
  graph_features: number[];   // [16]
  data_features: number[];    // [10]
  node_count: number;
  render_target_label: number;
  layout_type_label: number;
  engagement_score: number;
}

export interface TrainingBatch {
  samples: TrainingSample[];
  collected_at: string;
}

// ---- Color constants ----

export const NODE_TYPE_COLORS: Record<string, string> = {
  source: '#2D5F6B',
  concept: '#7B5EA7',
  person: '#C4503C',
  hunch: '#C49A4A',
  note: '#e8e5e0',
};

export const RELATION_COLORS: Record<string, string> = {
  supports: '#5A7A4A',
  contradicts: '#C4503C',
  neutral: '#999999',
  elaborates: '#7B5EA7',
  temporal: '#2D5F6B',
};

// ---- Enum indices (for model classification heads) ----

export const RENDER_TARGETS = ['r3f', 'd3', 'vega-lite'] as const;
export const LAYOUT_TYPES: TopologyType[] = [
  'linear_chain', 'star', 'dense_cluster', 'bipartite_tension',
  'multi_cluster', 'tree', 'mixed',
];
export const DATA_VIZ_TYPES = [
  'heatmap', 'surface', 'scatter', 'bar', 'line', 'geographic', 'custom', 'none',
] as const;
export const SIGNAL_TYPES = [
  'bm25', 'sbert', 'entity', 'nli', 'kge', 'gnn', 'analogy',
] as const;
export const RELATION_TYPES = [
  'supports', 'contradicts', 'neutral', 'elaborates', 'temporal',
] as const;
export const OBJECT_TYPES = [
  'source', 'concept', 'person', 'hunch', 'note',
] as const;
export const EPISTEMIC_ROLES = [
  'substantive', 'referential', 'meta', 'hypothetical', 'axiomatic',
] as const;
