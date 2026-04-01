/* Response Protocol v1 types for the Theseus Visual Intelligence Engine */

export interface TheseusResponse {
  query: string;
  mode: 'full' | 'brief' | 'objects_only';
  confidence: ConfidenceScore;
  sections: ResponseSection[];
  metadata: ResponseMetadata;
}

export interface ConfidenceScore {
  evidence: number;   // 0.0-1.0
  tension: number;    // 0.0-1.0
  combined: number;   // 0.0-1.0
}

export interface ResponseMetadata {
  duration_ms: number;
  objects_searched: number;
  engine_version: string;
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
  | HypothesisSection;

export interface NarrativeSection {
  type: 'narrative';
  content: string;
  tier: 1 | 2;
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
  epistemic_role: 'substantive' | 'referential' | 'meta' | 'hypothetical' | 'axiomatic';
  gradual_strength: number;
  claims: string[];
}

export interface EvidenceEdge {
  from_id: string;
  to_id: string;
  signal_type: 'bm25' | 'sbert' | 'entity' | 'nli' | 'kge' | 'gnn' | 'analogy';
  strength: number;
  relation: 'supports' | 'contradicts' | 'neutral' | 'elaborates' | 'temporal';
}

export interface ObjectsSection {
  type: 'objects';
  objects: TheseusObject[];
}

export interface TensionSection {
  type: 'tension';
  claim_a: string;
  claim_b: string;
  domain: string;
  severity: number;
}

export interface StructuralGapSection {
  type: 'structural_gap';
  message: string;
  domains: string[];
}

export interface HypothesisSection {
  type: 'hypothesis';
  title: string;
  description: string;
  confidence: number;
  supporting_objects: string[];
  structural_basis: string;
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
}

export interface WebEvidenceSection {
  type: 'web_evidence';
  url: string;
  title: string;
  snippet: string;
  relevance: number;
}

export interface TheseusObject {
  id: string;
  title: string;
  object_type: string;
  summary: string;
  created_at: string;
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
  created_at: string;
}

export interface GraphWeather {
  total_objects: number;
  total_edges: number;
  total_clusters: number;
  recent_activity: string;
  health_score: number;
}

export interface AskOptions {
  mode?: 'full' | 'brief' | 'objects_only';
  personal_only?: boolean;
}
