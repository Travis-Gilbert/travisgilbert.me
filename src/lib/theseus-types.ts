/* Frontend-normalized Theseus response types. */

export interface TheseusResponse {
  query: string;
  mode: 'full' | 'brief' | 'objects_only';
  confidence: ConfidenceScore;
  sections: ResponseSection[];
  metadata: ResponseMetadata;
  follow_ups?: FollowUp[];
  raw_traversal?: TraversalMetadata;
  /** Optional reference image URL for visual answer construction (image-traced portraits) */
  reference_image_url?: string;
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
  | DataAcquisitionSection;

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
}
