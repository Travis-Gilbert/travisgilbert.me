/* Frontend-normalized Theseus response types. */

export interface TheseusResponse {
  query: string;
  /** Optional top-level answer for backward compatibility with v1 shape */
  answer?: string;
  /** Backend expression agent identifier, when available */
  answer_agent?: string;
  mode: 'full' | 'brief' | 'objects_only';
  confidence: ConfidenceScore;
  sections: ResponseSection[];
  metadata: ResponseMetadata;
  follow_ups?: FollowUp[];
  raw_traversal?: TraversalMetadata;
  /** Optional reference image URL for visual answer construction (image-traced portraits) */
  reference_image_url?: string;
  /** Geographic region overlay data for map-based answers */
  geographic_regions?: GeographicRegionsSection;
  /** Backend-classified answer type for visual construction routing */
  answer_type?: AnswerType;
  /** Full classification metadata from the answer router */
  answer_classification?: AnswerClassification;
  /** Structured visual directive from the visual pipeline */
  structured_visual?: StructuredVisual;
  /**
   * Backend-emitted VisionDirective from the 26B-external research
   * path. When present, drives the frontend image search + TF.js
   * tracing pipeline without running the keyword classifier
   * fallback. See apps/notebook/schemas/vision.py for the source.
   */
  vision_directive?: VisionDirective;
}

export interface StructuredVisualRegion {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  linked_evidence?: string[];
}

export interface StructuredVisual {
  visual_type: AnswerType;
  layout?: Record<string, unknown>;
  regions?: StructuredVisualRegion[];
  reference_image_url?: string;
  /**
   * Backend's authoritative renderer key, overrides answer_type when present.
   * Examples: 'comparison_table', 'timeline_strip', 'hierarchy_tree',
   * 'concept_map', 'process_flow', 'tfjs_stipple'.
   */
  renderer?: string;
  /**
   * Renderer-specific structured payload (steps for process_flow, center
   * for concept_map, stipple_points for tfjs_stipple, etc.). Opaque to
   * consumers other than the matching offscreen renderer.
   */
  structured?: Record<string, unknown>;
}

export type AnswerType =
  | 'geographic'
  | 'portrait'
  | 'diagram'
  | 'comparison'
  | 'timeline'
  | 'hierarchy'
  | 'explanation'
  | 'code'
  | 'simulation';

export interface AnswerClassification {
  answer_type: AnswerType;
  search_query: string | null;
  confidence?: number;
  reasoning?: string;
  extracted_entity?: string | null;
  /**
   * Backend-emitted trace configuration. Populated from the
   * 26B-external VisionDirective when the query has visual intent;
   * otherwise supplied by the frontend keyword fallback.
   */
  trace_config?: ImageTraceConfig;
  color_strategy?: 'geographic' | 'portrait' | 'diagram' | 'none';
  preselected_image_url?: string;
}

/**
 * Mirrors modal_app / apps/notebook/schemas/vision.py TraceConfig.
 * Frontend tracers consume this directly without translation.
 */
export interface ImageTraceConfig {
  preferVision: boolean;
  contrastBoost: boolean;
  maxDots: number;
  weightMultiplier: number;
}

/**
 * Vision directive payload emitted by the 26B-external research path
 * when the query has visual intent. When present on a TheseusResponse,
 * the frontend should (1) fire an image search with `search_query`,
 * (2) validate the returned image, and (3) pass it to the tracer with
 * `trace_config`. If `preselected_image_url` is set, the frontend can
 * skip the search step and validate that URL directly; it must still
 * be passed through `validateImageForStippling()` before tracing
 * because the backend does not guarantee the URL resolves to a
 * traceable image.
 *
 * Aligned with apps/notebook/schemas/vision.py::VisionDirective.
 */
export interface VisionDirective {
  answer_type: AnswerType;
  search_query: string;
  trace_config: ImageTraceConfig;
  color_strategy: 'geographic' | 'portrait' | 'diagram' | 'none';
  reasoning?: string;
  confidence: number;
  preselected_image_url?: string | null;
}

export interface ConfidenceScore {
  evidence: number;   // 0.0-1.0
  tension: number;    // 0.0-1.0
  coverage?: number;  // 0.0-1.0
  source_independence?: number; // 0.0-1.0
  combined: number;   // 0.0-1.0
}

export interface TraversalMetadata {
  objects_searched: number;
  clusters_touched: number;
  signals_used: string[];
  duration_ms: number;
  web_augmented: boolean;
}

export interface ResponseMetadata {
  duration_ms: number;
  objects_searched: number;
  engine_version: string;
  clusters_touched?: number;
  signals_used?: string[];
  web_augmented?: boolean;
}

export interface FollowUp {
  query: string;
  reason: string;
  gap_domains?: string[];
}

export type ResponseSection =
  | NarrativeSection
  | EvidencePathSection
  | ObjectsSection
  | TensionSection
  | StructuralGapSection
  | WebEvidenceSection
  | VisualizationSection
  | ClusterContextSection
  | HypothesisSection
  | DataAcquisitionSection
  | MapSection
  | GeographicRegionsSection;

export interface DataAcquisitionSection {
  type: 'data_acquisition';
  sources: DataSource[];
  queries: string[];
  fallback_description: string;
}

export interface DataSource {
  url: string;
  format: 'parquet' | 'csv' | 'json';
  table_name: string;
}

export interface NarrativeSection {
  type: 'narrative';
  content: string;
  /** 1 = fast answer (gemma4b), 2 = deep answer (theseus-26b, replaces tier 1) */
  tier: 1 | 2;
  attribution?: Record<string, unknown> | null;
}

export interface EvidencePathSection {
  type: 'evidence_path';
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}

export interface EvidenceNode {
  object_id: string;
  title: string;
  object_type: string;
  epistemic_role: 'substantive' | 'referential' | 'meta' | 'hypothetical' | 'axiomatic' | string;
  gradual_strength: number;
  claims: string[];
  metadata?: Record<string, unknown>;
}

export interface EvidenceEdge {
  from_id: string;
  to_id: string;
  signal_type: string;
  strength: number;
  relation: 'supports' | 'contradicts' | 'neutral' | 'elaborates' | 'temporal';
  metadata?: Record<string, unknown>;
}

export interface ObjectsSection {
  type: 'objects';
  objects: TheseusObject[];
  total_available?: number;
  scope_applied?: string;
}

export interface TensionSection {
  type: 'tension';
  claim_a: string;
  claim_b: string;
  domain: string;
  severity: number;
  status?: string;
}

export interface StructuralGapSection {
  type: 'structural_gap';
  message: string;
  domains: string[];
  suggested_action?: string;
  suggested_query?: string;
}

export interface HypothesisSection {
  type: 'hypothesis';
  title: string;
  description: string;
  confidence: number;
  supporting_objects: string[];
  structural_basis: string;
  created_at?: string;
  validation_status?: string;
  hypothesis_type?: string;
  search_queries?: string[];
}

export interface VisualizationSection {
  type: 'visualization';
  scene_id: string;
  scene_data: unknown;
}

export interface ClusterContextSection {
  type: 'cluster_context';
  cluster_id: number;
  label: string;
  member_count: number;
  bridging_objects: string[];
  relevance?: number;
}

export interface WebEvidenceSection {
  type: 'web_evidence';
  url: string;
  title: string;
  snippet: string;
  relevance: number;
  stance_vs_graph?: 'supports' | 'contradicts' | 'novel';
}

export interface TheseusObject {
  id: string;
  title: string;
  object_type: string;
  summary: string;
  created_at?: string;
  score?: number;
  is_new?: boolean;
  is_personal?: boolean;
  epistemic_role?: string;
  metadata?: Record<string, unknown>;
}

export interface ClusterSummary {
  id: number;
  label: string;
  member_count: number;
  top_objects: string[];
}

export interface WhatIfResult {
  removed_object_id: string;
  affected_edges: number;
  affected_clusters: number;
  orphaned_objects: string[];
  narrative: string;
}

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  confidence: number;
  supporting_objects: string[];
  structural_basis: string;
  created_at?: string;
  validation_status?: string;
  hypothesis_type?: string;
}

export interface GraphWeather {
  total_objects: number;
  total_edges: number;
  total_clusters: number;
  recent_activity: string;
  health_score: number;
  iq_score?: number;
  tensions_active?: number;
  scorer_accuracy?: number;
  last_engine_run?: string;
}

export interface AskOptions {
  mode?: 'full' | 'brief' | 'objects_only';
  personal_only?: boolean;
  scope?: 'personal' | 'corpus' | 'all';
  include_web?: boolean;
  max_objects?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  retryPolicy?: 'none' | 'transient-once';
  /** Use SSE endpoint for streaming response */
  stream?: boolean;
}

/* ─────────────────────────────────────────────────
   Map: TMS-powered epistemic topology
   ───────────────────────────────────────────────── */

export interface MapClaim {
  pk: number;
  text: string;
  status: string;
  entrenchment: number;
  source_object_ids: number[];
  justification_group_count: number;
  is_defeasible: boolean;
}

export interface AgreementGroup {
  id: string;
  label: string;
  claims: MapClaim[];
  mean_entrenchment: number;
  source_object_ids: number[];
  source_independence: number;
}

export type TensionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface TensionZone {
  id: string;
  tension_pk: number;
  title: string;
  claim_a: { pk: number; text: string; entrenchment: number };
  claim_b: { pk: number; text: string; entrenchment: number };
  severity: TensionSeverity;
  domain: string;
  bridging_objects: number[];
}

export type BlindSpotMethod =
  | 'structural_gap'
  | 'single_source'
  | 'low_corroboration'
  | 'temporal_gap';

export interface BlindSpot {
  id: string;
  description: string;
  detection_method: BlindSpotMethod;
  related_claim_pks: number[];
  suggested_query: string;
}

export interface MapSourceObject {
  pk: number;
  title: string;
  object_type_slug: string;
  entrenchment: number;
}

export interface WhatIfSensitivity {
  object_pk: number;
  would_retract_count: number;
  would_weaken_count: number;
  label: string;
}

export interface MapSection {
  type: 'truth_map';
  agreement_groups: AgreementGroup[];
  tension_zones: TensionZone[];
  blind_spots: BlindSpot[];
  claims_by_status: Record<string, number>;
  source_objects: MapSourceObject[];
  what_if_sensitivities: WhatIfSensitivity[];
  source_independence_score: number;
  computed_at: string;
}

export interface GeographicRegion {
  id: string;
  name: string;
  score: number;
  center_x: number;
  center_y: number;
  radius: number;
  explanation: string;
}

export interface GeographicRegionsSection {
  type: 'geographic_regions';
  location: string;
  regions: GeographicRegion[];
  legend: {
    metric: string;
    tiers: Array<{ min: number; label: string; color: string }>;
  };
}

/* ─────────────────────────────────────────────────
   Explorer: graph data + investigation views
   ───────────────────────────────────────────────── */

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    node_count: number;
    edge_count: number;
    type_distribution: Record<string, number>;
    truncated: boolean;
  };
}

export interface GraphNode {
  id: string;
  title: string;
  slug: string;
  body_preview: string;
  object_type: string;
  object_type_color: string;
  object_type_icon: string;
  edge_count: number;
  size: number;
  status: string;
  /** Structural metrics from the nightly engine. All optional because
   *  compute_pagerank / detect_communities / backfill_k_core may not have
   *  run yet on a given Object. */
  pagerank?: number | null;
  leiden_community?: number | null;
  k_core_number?: number | null;
  graph_uncertainty?: number | null;
  novelty_score?: number | null;
  captured_at?: string | null;
  epistemic_role?: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edge_type: string;
  strength: number;
  reason: string;
  engine: string;
}

export interface PathResult {
  nodes: string[];
  edges: Array<{
    from: string;
    to: string;
    edge_type: string;
    strength: number;
  }>;
  length: number;
}

export interface GraphDiff {
  added_objects: TheseusObject[];
  removed_objects: TheseusObject[];
  new_edges: GraphEdge[];
  retracted_claims: ClaimResult[];
  resolved_tensions: TensionResult[];
  new_tensions: TensionResult[];
  summary: string;
}

export type InvestigationView =
  | 'all'
  | 'evidence'
  | 'claim_tension'
  | 'entity_network'
  | 'reasoning_trace'
  | 'provenance';

export interface ArtifactMeta {
  id: string;
  artifact_type: 'evidence_map' | 'tension_report' | 'hypothesis_doc' | 'knowledge_diff';
  title: string;
  query: string;
  created_at: string;
  object_id: string;
  share_url: string;
  embed_html: string;
}

/* ─────────────────────────────────────────────────
   Explorer: object neighborhood data
   ───────────────────────────────────────────────── */

export interface ConnectionResult {
  edge_id: string;
  connected_object: {
    id: string;
    title: string;
    object_type: string;
  };
  signal_type: string;      // bm25, sbert, entity, nli, kge, gnn
  strength: number;          // 0-1
  direction: 'outgoing' | 'incoming';
  acceptance_status?: string;
}

export interface ClaimResult {
  id: string;
  text: string;
  confidence: number;
  epistemic_status: string;  // accepted, contested, pending
  source_object_id: string;
}

export interface TensionResult {
  id: string;
  claim_a_text: string;
  claim_b_text: string;
  severity: number;          // 0-1
  status: string;            // active, resolved, dismissed
  domain: string;
}

export interface LineageResult {
  source_url?: string;
  ingested_at?: string;
  parent_objects: string[];
  ingestion_method: string;  // quick_capture, corpus_crawl, openalex, etc.
}

/* ─────────────────────────────────────────────────
   Code Intelligence (SPEC-CODE-INTELLIGENCE)

   Matches the backend discrimination: Objects with
   source_system='codebase' carry a properties.code_entity_type
   field. Edges use edge_type (not edge_subtype) with the
   Tree-sitter derived vocabulary.
   ───────────────────────────────────────────────── */

export type CodeEntityType =
  | 'code_file'
  | 'code_structure'
  | 'code_member'
  | 'code_process'
  | 'specification'
  | 'fix_pattern'
  | 'commit';

export type CodeEdgeType =
  | 'imports'
  | 'calls'
  | 'inherits'
  | 'has_member'
  | 'references'
  | 'belongs_to_process'
  | 'specified_by'
  | 'contradicts_spec';

export interface CodeSymbol {
  object_id: string;
  name: string;
  entity_type: CodeEntityType;
  file_path: string;
  line_number?: number;
  language: string;
  community_id?: number;
  metadata?: Record<string, unknown>;
}

export interface ImpactSymbol {
  object_id: string;
  name: string;
  entity_type: CodeEntityType;
  ppr_score: number;
  edge_types: CodeEdgeType[];
  processes: string[];
}

export interface ImpactGroup {
  depth: number;
  symbols: ImpactSymbol[];
}

export interface CodeImpactResult {
  target: string;
  direction: 'upstream' | 'downstream' | 'both';
  depth_groups: ImpactGroup[];
  total_affected: number;
}

export interface CodeContextEdge {
  symbol: CodeSymbol;
  edge_type: CodeEdgeType;
  strength: number;
}

export interface CodeContextResult {
  symbol: CodeSymbol;
  incoming: CodeContextEdge[];
  outgoing: CodeContextEdge[];
  processes: Array<{ id: string; title: string; step_count: number }>;
  cluster: { id: number; label: string; member_count: number } | null;
}

export interface CodeProcess {
  id: string;
  title: string;
  entry_point: string;
  steps: Array<{ object_id: string; name: string; order: number }>;
  language: string;
}

export interface DriftTension {
  id: string;
  title: string;
  severity: number;
  tension_type: 'spec_drift';
  spec_expectation: string;
  code_reality: string;
  spec_object_id: string;
  code_object_id?: string;
  status: 'active' | 'resolved' | 'dismissed';
}

export interface FixPattern {
  id: string;
  title: string;
  problem: string;
  root_cause: string;
  fix_summary: string;
  reasoning_steps: string[];
  feedback_label: string;
  files_involved: string[];
  created_at: string;
  ppr_score?: number;
}

export interface IngestionStats {
  // Delta: what this run added.
  objects_created: number;
  edges_created: number;
  processes_detected: number;
  // Totals in the graph after this run. Default to 0 for forward-compat
  // with older backend responses that did not emit totals.
  objects_total?: number;
  edges_total?: number;
  processes_total?: number;
  languages: string[];
  duration_ms: number;
}

export interface IngestRequest {
  repo?: string;
  path?: string;
  language?: string;
  notebook_id?: string;
  paths?: string[];
}

export interface CodeExplainEntry {
  object_id: string;
  title: string;
  type: string;
  epistemic_role: string;
  relationship: string;
  snippet: string;
}

export interface CodeExplainResult {
  symbol: string;
  explanations: CodeExplainEntry[];
  specifications: Array<{ title: string; object_id: string }>;
}
