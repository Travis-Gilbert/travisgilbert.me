/**
 * Theseus API client: v2 intelligence endpoints.
 *
 * Calls the Ninja v2 API through the Next.js rewrite proxy.
 * No CORS needed. Auth via NEXT_PUBLIC_COMMONPLACE_API_TOKEN.
 */

/* ─────────────────────────────────────────────────
   Base
   ───────────────────────────────────────────────── */

const V2_BASE = '/api/v2';

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token =
    typeof window !== 'undefined'
      ? undefined
      : process.env.NEXT_PUBLIC_COMMONPLACE_API_TOKEN;
  // Client-side: token from env at build time
  const clientToken = process.env.NEXT_PUBLIC_COMMONPLACE_API_TOKEN;
  if (clientToken) {
    headers['Authorization'] = `Bearer ${clientToken}`;
  } else if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function v2Fetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${V2_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...options?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? body.error ?? `API error ${res.status}`);
  }
  return res.json();
}

/* ─────────────────────────────────────────────────
   Response Protocol types
   ───────────────────────────────────────────────── */

export interface Confidence {
  evidence: number;
  tension: number;
  coverage: number;
  source_independence: number;
}

export interface Traversal {
  objects_searched: number;
  clusters_touched: number;
  signals_used: string[];
  time_ms: number;
  web_augmented: boolean;
}

export interface EvidenceNode {
  object_id: number;
  type: string;
  title: string;
  role: 'premise' | 'bridge' | 'conclusion';
}

export interface EvidenceEdge {
  from_id: number;
  to_id: number;
  signal: string;
  strength: number;
  acceptance_status: string;
}

export interface EvidencePath {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  chain_confidence: number;
}

export interface ObjectItem {
  id: number;
  object_type: string;
  title: string;
  snippet: string;
  score: number;
  signals: Record<string, number> | null;
  is_new: boolean;
  is_personal: boolean;
  epistemic_role: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TensionItem {
  id: number | null;
  claim_a: { text: string; object_id?: number; confidence: number };
  claim_b: { text: string; object_id?: number; confidence: number };
  nli_label: string;
  nli_confidence: number;
  domain: string | null;
  status: string;
}

export interface Section {
  type:
    | 'narrative'
    | 'evidence_path'
    | 'objects'
    | 'tension'
    | 'structural_gap'
    | 'web_evidence'
    | 'cluster_context'
    | 'visualization'
    | 'hypothesis';
  data: Record<string, unknown>;
}

export interface FollowUp {
  query: string;
  reason: string;
  gap_domains: string[] | null;
}

export interface AskResponse {
  query: string;
  traversal: Traversal;
  confidence: Confidence;
  sections: Section[];
  follow_ups: FollowUp[];
}

export interface GraphWeather {
  total_objects: number;
  total_edges: number;
  iq_score: number;
  scorer_accuracy: number | null;
  edges_added_24h: number;
  tensions_active: number;
  clusters_count: number;
  last_engine_run: string | null;
}

export interface ObjectDetail {
  id: number;
  object_type: string;
  title: string;
  body: string;
  url: string;
  epistemic_role: string | null;
  is_corpus: boolean;
  cluster: { id: number; name: string } | null;
  created_at: string;
  connections: Array<{
    edge_id: number;
    direction: string;
    connected_object: { id: number; title: string; object_type: string };
    edge_type: string;
    strength: number;
    reason: string;
    acceptance_status: string;
  }>;
}

export interface WhatIfResult {
  affected_claims: Array<Record<string, unknown>>;
  orphaned_objects: Array<Record<string, unknown>>;
  cluster_impact: Array<Record<string, unknown>>;
  cascade_depth: number;
  message?: string;
}

/* ─────────────────────────────────────────────────
   API functions
   ───────────────────────────────────────────────── */

/** Main ask endpoint: query the knowledge graph. */
export async function askTheseus(
  query: string,
  options?: {
    mode?: 'full' | 'brief' | 'objects_only';
    scope?: 'personal' | 'corpus' | 'all';
    max_objects?: number;
    include_web?: boolean;
  },
): Promise<AskResponse> {
  return v2Fetch<AskResponse>('/theseus/ask/', {
    method: 'POST',
    body: JSON.stringify({
      query,
      mode: options?.mode ?? 'full',
      scope: options?.scope ?? 'all',
      max_objects: options?.max_objects ?? 12,
      include_web: options?.include_web ?? true,
    }),
  });
}

/** Graph weather for the stats strip. */
export async function fetchGraphWeather(): Promise<GraphWeather> {
  return v2Fetch<GraphWeather>('/theseus/graph-weather/');
}

/** Object detail with connections. */
export async function fetchObjectDetail(id: number): Promise<ObjectDetail> {
  return v2Fetch<ObjectDetail>(`/objects/${id}/`);
}

/** TMS what-if-remove. */
export async function whatIfRemove(objectId: number): Promise<WhatIfResult> {
  return v2Fetch<WhatIfResult>(`/objects/${objectId}/what-if-remove/`);
}

/** List clusters. */
export async function fetchClusters(): Promise<{
  clusters: Array<{
    id: number;
    label: string;
    object_count: number;
    label_tags: string[];
  }>;
}> {
  return v2Fetch('/clusters/');
}

/** List tensions. */
export async function fetchTensions(
  status?: string,
): Promise<{
  tensions: Array<{
    id: number;
    title: string;
    description: string;
    tension_type: string;
    confidence: number;
    severity: string;
    status: string;
  }>;
}> {
  const qs = status ? `?status=${status}` : '';
  return v2Fetch(`/tensions/${qs}`);
}

/* ─────────────────────────────────────────────────
   Section extractors (convenience functions)
   ───────────────────────────────────────────────── */

/** Extract the narrative text from an AskResponse. */
export function extractNarrative(response: AskResponse): string | null {
  const section = response.sections.find((s) => s.type === 'narrative');
  return (section?.data as { text?: string })?.text ?? null;
}

/** Extract the evidence path from an AskResponse. */
export function extractEvidencePath(
  response: AskResponse,
): EvidencePath | null {
  const section = response.sections.find((s) => s.type === 'evidence_path');
  if (!section) return null;
  return section.data as unknown as EvidencePath;
}

/** Extract object results from an AskResponse. */
export function extractObjects(response: AskResponse): ObjectItem[] {
  const section = response.sections.find((s) => s.type === 'objects');
  if (!section) return [];
  return (section.data as { items?: ObjectItem[] })?.items ?? [];
}

/** Extract tensions from an AskResponse. */
export function extractTensionItems(response: AskResponse): TensionItem[] {
  const section = response.sections.find((s) => s.type === 'tension');
  if (!section) return [];
  return (section.data as { tensions?: TensionItem[] })?.tensions ?? [];
}

/** Build a follow-up query anchored to a specific node. */
export function buildFollowUpQuery(
  originalQuery: string,
  node: { title: string; object_type: string },
): string {
  return `Tell me more about "${node.title}" in the context of: ${originalQuery}`;
}
