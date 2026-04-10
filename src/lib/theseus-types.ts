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
}

export type AnswerType =
  | 'geographic'
  | 'portrait'
  | 'diagram'
  | 'comparison'
  | 'timeline'
  | 'hierarchy'
  | 'explanation';

export interface AnswerClassification {
  answer_type: AnswerType;
  search_query: string | null;
  confidence?: number;
  reasoning?: string;
  extracted_entity?: string | null;
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
