/* SPEC-VIE-3 v3: SceneDirective output contract and all shared types */

// ---- Topology ----

export type TopologyShape =
  | 'linear_chain'
  | 'star'
  | 'dense_cluster'
  | 'bipartite_tension'
  | 'multi_cluster'
  | 'tree'
  | 'ring'
  | 'hierarchical'
  | 'mixed'
  | 'truth_map_archipelago'
  | 'truth_map_continental'
  | 'truth_map_constellation';

// ---- Job 1: Salience ----

export interface NodeSalience {
  node_id: string;
  importance: number;           // 0.0-1.0, drives node scale
  visual_weight: number;        // 0.0-1.0, drives opacity + emissive
  is_focal: boolean;            // true for 1-3 most important nodes
  label_priority: number;       // lower = show label first (0 = always show)
  suggested_scale: number;      // 0.3-2.0
  suggested_opacity: number;    // 0.2-1.0
  suggested_emissive: number;   // 0.0-0.5
}

// ---- Job 2: Hypothesis styling ----

export interface HypothesisEdgeStyle {
  edge_key: string;                  // "from_id->to_id"
  visibility: number;               // 0.0-1.0
  dash_scale: number;               // 1.0 = normal, 2.0 = wider gaps (more uncertain)
  color_override?: string;          // amber for hypothesis, null for default
}

export interface HypothesisStyle {
  has_hypothetical_content: boolean;
  global_tentative_factor: number;   // 0.0 (fully confirmed) to 1.0 (all speculative)
  edge_styles: HypothesisEdgeStyle[];
}

// ---- Job 3: Context shelf ----

export interface ContextAnchor {
  node_id: string;
  relevance_to_data: number;         // 0.0-1.0
  anchor_label: string;              // short label connecting this node to the data
}

export interface ContextShelfDirective {
  enabled: boolean;                  // true when external data is part of the answer
  anchor_nodes: ContextAnchor[];     // max 6, ordered by relevance
  shelf_position: 'left' | 'top';   // where graph context sits relative to data viz
}

// ---- Job 4: Construction sequence ----

export type ConstructionPhaseName =
  | 'focal_nodes_appear'
  | 'supporting_nodes_appear'
  | 'edges_draw'
  | 'clusters_coalesce'
  | 'data_builds'
  | 'labels_fade_in'
  | 'crystallize'
  | 'agreement_clusters_form'
  | 'tensions_bridge'
  | 'blind_spots_reveal'
  | 'entrenchment_pulse';

export interface ConstructionPhase {
  name: ConstructionPhaseName;
  target_ids: string[];
  delay_ms: number;
  duration_ms: number;
  easing: 'ease-out' | 'ease-in-out' | 'spring' | 'linear';
}

export interface ConstructionSequence {
  phases: ConstructionPhase[];
  total_duration_ms: number;          // minimum 10,000 for CONSTRUCTING state
  theatricality: number;              // 0.0 (restrained) to 1.0 (dramatic)
}

// ---- Job 5: Force configuration ----

export interface NodeForceDirective {
  node_id: string;
  pin_position?: [number, number, number];
  center_pull: number;               // 0.0-1.0
  mass: number;                      // 1.0 = normal, >1 = harder to move
}

export interface ForceGroup {
  group_id: string;
  node_ids: string[];
  cohesion: number;                  // 0.0-1.0
  center_hint?: [number, number, number];
}

export interface LinkStrengthOverride {
  from_id: string;
  to_id: string;
  strength: number;                  // 0.0-1.0
}

export interface ForceConfig {
  simulation_alpha: number;           // 0.3-1.0
  simulation_alpha_decay: number;     // 0.01-0.05
  warmup_ticks: number;               // 0-300
  node_forces: NodeForceDirective[];
  groups: ForceGroup[];
  link_strengths: LinkStrengthOverride[];
  center_gravity: number;             // 0.0-1.0
  charge_strength: number;            // typically -30 to -300
  collision_radius_factor: number;    // 1.0 = node radius, 1.5 = extra padding
}

// ---- Job 6: Camera ----

export interface CameraDirective {
  initial_position: [number, number, number];
  initial_look_at: [number, number, number];
  initial_fov: number;
  transition_duration_ms: number;
  focal_node_id?: string;
  distance_factor: number;           // 1.0 default, 0.5 close, 2.0 zoomed out
}

// ---- Job 7: Topology ----

export interface TopologyInterpretation {
  primary_shape: TopologyShape;
  secondary_shapes: TopologyShape[];
  shape_confidence: number;           // 0.0-1.0
  description: string;               // human-readable
}

// ---- Render target ----

export interface RenderTargetDirective {
  primary: 'particle-field' | 'force-graph-3d' | 'sigma-2d' | 'vega-lite' | 'd3';
  fallback: 'force-graph-3d' | 'sigma-2d';
  reason: string;
  data_viz_type?: 'heatmap' | 'bar' | 'line' | 'scatter' | 'geographic'
    | 'surface' | 'sankey' | 'chord' | 'custom' | 'none';
  vega_spec?: object;
  d3_spec?: object;
}

// ---- Truth Map topology (epistemic overlay) ----

export interface TruthMapAgreementRegion {
  id: string;
  node_ids: string[];
  center_hint: [number, number, number];
  radius: number;
  entrenchment: number;
  label: string;
}

export interface TruthMapTensionBridge {
  from_region_id: string;
  to_region_id: string;
  tension_pk: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TruthMapBlindSpotVoid {
  id: string;
  position_hint: [number, number, number];
  radius: number;
  description: string;
}

export interface TruthMapTopologyDirective {
  agreement_regions: TruthMapAgreementRegion[];
  tension_bridges: TruthMapTensionBridge[];
  blind_spot_voids: TruthMapBlindSpotVoid[];
}

// ---- Top-level SceneDirective ----

export interface SceneDirective {
  salience: NodeSalience[];
  hypothesis_style: HypothesisStyle;
  context_shelf: ContextShelfDirective;
  construction: ConstructionSequence;
  force_config: ForceConfig;
  camera: CameraDirective;
  topology: TopologyInterpretation;
  render_target: RenderTargetDirective;
  inference_method: 'learned' | 'rule_based';
  inference_time_ms: number;
  /** Present only for truth map render mode. Describes epistemic topology. */
  truth_map_topology?: TruthMapTopologyDirective;
}

// ---- Model weights bundle (v3: ~12,415 params) ----

export interface ModelWeightsBundle {
  // Encoder: 5,518 params
  encoder_w1: Float32Array;   // [20 * 64]
  encoder_b1: Float32Array;   // [64]
  encoder_w2: Float32Array;   // [64 * 64]
  encoder_b2: Float32Array;   // [64]
  edge_w: Float32Array;       // [14]

  // Shared layer: 4,368 params
  shared_w: Float32Array;     // [90 * 48]
  shared_b: Float32Array;     // [48]

  // Head weights: 2,529 params total
  sal_w: Float32Array;        // [64 * 5]
  sal_b: Float32Array;        // [5]
  hyp_w: Float32Array;        // [48 * 2]
  hyp_b: Float32Array;        // [2]
  shelf_w: Float32Array;      // [64 * 1]
  shelf_b: Float32Array;      // [1]
  seq_w: Float32Array;        // [48 * 4]
  seq_b: Float32Array;        // [4]
  force_w: Float32Array;      // [48 * 5]
  force_b: Float32Array;      // [5]
  nf_w: Float32Array;         // [64 * 2]
  nf_b: Float32Array;         // [2]
  cam_w: Float32Array;        // [48 * 7]
  cam_b: Float32Array;        // [7]
  topo_w: Float32Array;       // [48 * 9]
  topo_b: Float32Array;       // [9]
  rt_w: Float32Array;         // [48 * 4]
  rt_b: Float32Array;         // [4]
  dv_w: Float32Array;         // [48 * 10]
  dv_b: Float32Array;         // [10]

  version: number;
  trained_on_samples: number;
}

// ---- Feedback types ----

export interface VizFeedback {
  query_hash: string;
  topology_primary: TopologyShape;
  render_target_used: string;
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

export const RENDER_TARGETS = ['force-graph-3d', 'sigma-2d', 'vega-lite', 'd3'] as const;
export const TOPOLOGY_SHAPES: TopologyShape[] = [
  'linear_chain', 'star', 'dense_cluster', 'bipartite_tension',
  'multi_cluster', 'tree', 'ring', 'hierarchical', 'mixed',
  'truth_map_archipelago', 'truth_map_continental', 'truth_map_constellation',
];
export const DATA_VIZ_TYPES = [
  'heatmap', 'bar', 'line', 'scatter', 'geographic',
  'surface', 'sankey', 'chord', 'custom', 'none',
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
