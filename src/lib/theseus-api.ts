import type {
  AnswerClassification,
  AnswerType,
  ArtifactMeta,
  AskOptions,
  ClaimResult,
  ClusterSummary,
  CodeContextResult,
  CodeEntityType,
  CodeExplainResult,
  CodeImpactResult,
  CodeProcess,
  CodeSymbol,
  ConnectionResult,
  DriftTension,
  EvidenceEdge,
  EvidenceNode,
  FixPattern,
  FollowUp,
  GeographicRegionsSection,
  GraphData,
  GraphDiff,
  GraphWeather,
  Hypothesis,
  IngestRequest,
  IngestionStats,
  LineageResult,
  PathResult,
  ResponseSection,
  StructuredVisual,
  StructuredVisualRegion,
  TensionResult,
  TheseusObject,
  TheseusResponse,
  VisualizationSection,
  WhatIfResult,
} from './theseus-types';

// Phase B: typed stage events for the async SSE pipeline.
// See Index-API commit 968a226 for the backend contract.
export type StageEvent =
  | { name: 'pipeline_start'; query?: string }
  | { name: 'e4b_classify_start' }
  | {
      name: 'e4b_classify_complete';
      answer_type?: string;
      search_query?: string;
      extracted_entity?: string;
      needs_image?: boolean;
      entity_object_ids: number[];
    }
  | { name: 'retrieval_start' }
  | {
      name: 'retrieval_complete';
      evidence_count: number;
      confidence: number;
      has_tensions: boolean;
      has_gaps: boolean;
      bm25_hits: Array<{ object_id: number; score: number }>;
      sbert_scores: Array<{ object_id: number; similarity: number }>;
      pagerank_scores: Record<string, number>;
      community_assignments: Record<string, number>;
      tensions: Array<{ object_a: number; object_b: number; nli_score: number }>;
    }
  | { name: 'objects_loaded'; object_count: number; focal_object_ids: number[] }
  | { name: 'expression_start' }
  | { name: 'expression_complete' };

export interface AsyncStreamHandlers {
  onStage: (event: StageEvent) => void;
  onToken: (token: string) => void;
  onVisualDelta?: (payload: ProgressiveVisualPayload) => void;
  onAnswerReady?: (result: TheseusResponse) => void;
  onVisualComplete?: (payload: ProgressiveVisualPayload) => void;
  onComplete: (result: TheseusResponse) => void;
  onError: (error: { message: string; transient: boolean }) => void;
}

export type ApiErrorReason = 'timeout' | 'network' | 'http' | 'aborted';

export interface ApiError {
  ok: false;
  status: number;
  message: string;
  reason: ApiErrorReason;
  transient: boolean;
}

export type ApiResult<T> = (T & { ok: true }) | ApiError;

interface RequestControls {
  signal?: AbortSignal;
  timeoutMs?: number;
  retryPolicy?: 'none' | 'transient-once';
}

const DEFAULT_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 250;

interface RawAnswerClassification {
  answer_type?: string;
  search_query?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
  extracted_entity?: string | null;
}

interface RawAskResponse {
  query: string;
  answer?: string;
  answer_agent?: string;
  answer_type?: string;
  answer_classification?: RawAnswerClassification;
  traversal: {
    objects_searched: number;
    clusters_touched: number;
    signals_used: string[];
    time_ms: number;
    web_augmented: boolean;
  };
  confidence: {
    evidence: number;
    tension: number;
    coverage: number;
    source_independence: number;
  };
  sections: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
  follow_ups: FollowUp[];
  reference_image_url?: string;
  geographic_regions?: GeographicRegionsSection;
  structured_visual?: Record<string, unknown>;
}

interface RawVisualizationSection {
  type?: string;
  data?: Record<string, unknown>;
}

interface RawProgressiveVisualPayload {
  sequence?: number;
  answer_type?: string;
  available?: boolean;
  reference_image_url?: string;
  geographic_regions?: GeographicRegionsSection;
  visualization?: RawVisualizationSection | Record<string, unknown>;
}

export interface ProgressiveVisualPayload {
  sequence: number;
  answer_type?: AnswerType;
  available?: boolean;
  reference_image_url?: string;
  geographic_regions?: GeographicRegionsSection;
  visualization?: VisualizationSection;
}

interface RawGraphWeather {
  total_objects: number;
  total_edges: number;
  iq_score: number;
  scorer_accuracy?: number | null;
  edges_added_24h: number;
  tensions_active: number;
  clusters_count: number;
  last_engine_run?: string | null;
}

interface RawHypothesisResponse {
  hypotheses: Array<{
    id: number;
    title: string;
    scores?: {
      novelty?: number | null;
      plausibility?: number | null;
      testability?: number | null;
      composite?: number | null;
    };
    validation_status?: string;
    hypothesis_type?: string | null;
    created_at?: string | null;
  }>;
}

interface RawObjectResponse {
  id?: number | string;
  pk?: number | string;
  title?: string;
  object_type?: string;
  object_type_slug?: string;
  snippet?: string;
  body?: string;
  body_preview?: string;
  created_at?: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

interface RawClusterResponse {
  clusters?: Array<{
    id?: number;
    label?: string;
    object_count?: number;
    member_count?: number;
    top_object_ids?: Array<string | number>;
    top_objects?: Array<string | number>;
  }>;
}

interface RawWhatIfRemoveResponse {
  removed_object_id?: string | number;
  affected_edges?: number;
  affected_clusters?: number;
  orphaned_objects?: Array<string | number>;
  narrative?: string;
}

function wrapOk<T extends object>(data: T): T & { ok: true } {
  return { ...data, ok: true as const };
}

function apiError(
  status: number,
  message: string,
  reason: ApiErrorReason,
  transient: boolean,
): ApiError {
  return { ok: false, status, message, reason, transient };
}

function canonicalizeTheseusUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;

  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    try {
      const url = new URL(pathOrUrl);
      if (url.pathname.length > 1) {
        url.pathname = url.pathname.replace(/\/+$/, '');
      }
      return url.toString();
    } catch {
      return pathOrUrl;
    }
  }

  if (pathOrUrl.length > 1) {
    return pathOrUrl.replace(/\/+$/, '');
  }

  return pathOrUrl;
}

async function apiFetch<TInput extends object, TOutput extends object = TInput>(
  path: string,
  init?: RequestInit,
  normalize?: (data: TInput) => TOutput,
  controls?: RequestControls,
): Promise<ApiResult<TOutput>> {
  const timeoutMs = controls?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryPolicy = controls?.retryPolicy ?? 'transient-once';
  const maxAttempts = retryPolicy === 'transient-once' ? 2 : 1;
  const requestPath = canonicalizeTheseusUrl(path);

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const externalSignal = controls?.signal;
    const externalAbort = () => controller.abort();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (externalSignal) {
      if (externalSignal.aborted) {
        return apiError(0, 'Request was cancelled.', 'aborted', false);
      }
      externalSignal.addEventListener('abort', externalAbort, { once: true });
    }

    try {
      const res = await fetch(requestPath, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });

      if (!res.ok) {
        const rawBody = await res.text().catch(() => res.statusText);
        const status = res.status;
        const transient = status === 408 || status === 429 || status >= 500;
        // The backend may return HTML for 404/5xx (reverse-proxy pages,
        // Django debug pages). Showing the raw HTML in a toast is noise;
        // collapse it to a short human-readable message.
        const trimmed = rawBody.trimStart();
        const looksLikeHtml =
          trimmed.startsWith('<!') ||
          trimmed.startsWith('<html') ||
          trimmed.startsWith('<!DOCTYPE');
        const message = looksLikeHtml
          ? `${status} ${res.statusText || 'Error'} (backend unavailable)`
          : rawBody || res.statusText || 'Request failed';
        lastError = apiError(status, message, 'http', transient);
      } else {
        const data: TInput = await res.json();
        return wrapOk(normalize ? normalize(data) : (data as unknown as TOutput));
      }
    } catch (err) {
      if (controller.signal.aborted) {
        if (controls?.signal?.aborted) {
          return apiError(0, 'Request was cancelled.', 'aborted', false);
        }
        lastError = apiError(0, 'Request timed out. The backend may be slow or unreachable.', 'timeout', true);
      } else {
        lastError = apiError(0, err instanceof Error ? err.message : 'Network error', 'network', true);
      }
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', externalAbort);
    }

    if (!lastError) {
      break;
    }

    const shouldRetry = lastError.transient && attempt < maxAttempts - 1;
    if (!shouldRetry) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  return lastError ?? apiError(0, 'Unknown API error', 'network', true);
}

function normalizeId(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toUnitInterval(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  if (value <= 1) return Math.max(0, Math.min(1, value));
  return Math.max(0, Math.min(1, value / 100));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const KNOWN_ANSWER_TYPES = new Set<AnswerType>([
  'geographic',
  'portrait',
  'diagram',
  'comparison',
  'timeline',
  'hierarchy',
  'explanation',
  'code',
]);

function normalizeAnswerType(value: unknown): AnswerType | undefined {
  if (typeof value !== 'string') return undefined;
  return KNOWN_ANSWER_TYPES.has(value as AnswerType) ? (value as AnswerType) : undefined;
}

function normalizeAnswerClassification(
  raw: RawAnswerClassification | undefined,
  fallbackAnswerType?: AnswerType,
): AnswerClassification | undefined {
  const answerType = normalizeAnswerType(raw?.answer_type) ?? fallbackAnswerType;
  if (!answerType) return undefined;

  return {
    answer_type: answerType,
    search_query:
      typeof raw?.search_query === 'string'
        ? raw.search_query
        : raw?.search_query === null
          ? null
          : null,
    confidence: typeof raw?.confidence === 'number' ? toUnitInterval(raw.confidence) : undefined,
    reasoning: typeof raw?.reasoning === 'string' ? raw.reasoning : undefined,
    extracted_entity:
      typeof raw?.extracted_entity === 'string'
        ? raw.extracted_entity
        : raw?.extracted_entity === null
          ? null
          : undefined,
  };
}

function normalizeVisualizationSection(raw: unknown): VisualizationSection | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const rawSection = raw as RawVisualizationSection;
  const sceneData =
    rawSection.data && typeof rawSection.data === 'object'
      ? rawSection.data
      : (raw as Record<string, unknown>);

  return {
    type: 'visualization',
    scene_id: 'progressive-visualization',
    scene_data: sceneData,
  };
}

export function normalizeProgressiveVisualPayload(
  raw: RawProgressiveVisualPayload,
): ProgressiveVisualPayload {
  return {
    sequence: typeof raw.sequence === 'number' ? raw.sequence : 0,
    answer_type: normalizeAnswerType(raw.answer_type),
    available: typeof raw.available === 'boolean' ? raw.available : undefined,
    reference_image_url:
      typeof raw.reference_image_url === 'string' ? raw.reference_image_url : undefined,
    geographic_regions:
      typeof raw.geographic_regions === 'object' && raw.geographic_regions !== null
        ? raw.geographic_regions
        : undefined,
    visualization: normalizeVisualizationSection(raw.visualization),
  };
}

function withFallback<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}

function normalizeSignalType(value: unknown): EvidenceEdge['signal_type'] {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (['bm25', 'sbert', 'entity', 'nli', 'kge', 'gnn', 'analogy'].includes(raw)) {
    return raw;
  }
  return 'entity';
}

function normalizeRelation(value: unknown): EvidenceEdge['relation'] {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw === 'contradicts' || raw === 'contradiction') return 'contradicts';
  if (raw === 'neutral') return 'neutral';
  if (raw === 'elaborates') return 'elaborates';
  if (raw === 'temporal') return 'temporal';
  return 'supports';
}

function normalizeEpistemicRole(
  rawType: unknown,
  objectRole: unknown,
  rawRole: unknown,
): EvidenceNode['epistemic_role'] {
  const candidates = [rawType, objectRole];
  for (const candidate of candidates) {
    const value = typeof candidate === 'string' ? candidate.toLowerCase() : '';
    if (['substantive', 'referential', 'meta', 'hypothetical', 'axiomatic'].includes(value)) {
      return value;
    }
  }

  const value = typeof rawRole === 'string' ? rawRole.toLowerCase() : '';
  if (value === 'bridge') return 'referential';
  if (value === 'conclusion') return 'axiomatic';
  return 'substantive';
}

function normalizeTheseusObject(raw: Record<string, unknown>): TheseusObject {
  return {
    id: normalizeId((raw.id as string | number | undefined) ?? (raw.object_id as string | number | undefined)),
    title: typeof raw.title === 'string' ? raw.title : 'Untitled',
    object_type:
      typeof raw.object_type === 'string'
        ? raw.object_type
        : typeof raw.object_type_slug === 'string'
          ? raw.object_type_slug
          : 'note',
    summary:
      typeof raw.snippet === 'string'
        ? raw.snippet
        : typeof raw.body_snippet === 'string'
          ? raw.body_snippet
          : typeof raw.body_preview === 'string'
            ? raw.body_preview
            : '',
    created_at: typeof raw.created_at === 'string' ? raw.created_at : undefined,
    score: typeof raw.score === 'number' ? raw.score : undefined,
    is_new: typeof raw.is_new === 'boolean' ? raw.is_new : undefined,
    is_personal: typeof raw.is_personal === 'boolean' ? raw.is_personal : undefined,
    epistemic_role: typeof raw.epistemic_role === 'string' ? raw.epistemic_role : undefined,
    metadata: typeof raw.metadata === 'object' && raw.metadata !== null
      ? (raw.metadata as Record<string, unknown>)
      : undefined,
  };
}

function normalizeStructuredVisual(
  raw: Record<string, unknown> | undefined,
): StructuredVisual | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const visualType = normalizeAnswerType(raw.visual_type as string | undefined);
  if (!visualType) return undefined;

  const regions: StructuredVisualRegion[] = [];
  if (Array.isArray(raw.regions)) {
    for (const r of raw.regions as Record<string, unknown>[]) {
      if (typeof r.id === 'string' && typeof r.label === 'string') {
        regions.push({
          id: r.id,
          label: r.label,
          x: typeof r.x === 'number' ? r.x : 0,
          y: typeof r.y === 'number' ? r.y : 0,
          width: typeof r.width === 'number' ? r.width : 0,
          height: typeof r.height === 'number' ? r.height : 0,
          linked_evidence: Array.isArray(r.linked_evidence)
            ? (r.linked_evidence as (string | number)[]).map((v) => String(v))
            : undefined,
        });
      }
    }
  }

  return {
    visual_type: visualType,
    layout: typeof raw.layout === 'object' && raw.layout !== null
      ? raw.layout as Record<string, unknown>
      : undefined,
    regions: regions.length > 0 ? regions : undefined,
    reference_image_url: typeof raw.reference_image_url === 'string'
      ? raw.reference_image_url
      : undefined,
  };
}

function normalizeAskResponse(raw: RawAskResponse): TheseusResponse {
  const sections: ResponseSection[] = [];
  const answerType = normalizeAnswerType(
    raw.answer_type ?? raw.answer_classification?.answer_type,
  );
  const answerClassification = normalizeAnswerClassification(
    raw.answer_classification,
    answerType,
  );

  const rawObjectsSection = raw.sections.find((section) => section.type === 'objects')?.data;
  const rawObjectItems = Array.isArray(rawObjectsSection?.items)
    ? rawObjectsSection.items as Record<string, unknown>[]
    : [];
  const objects = rawObjectItems.map(normalizeTheseusObject);
  const objectLookup = new Map(objects.map((object) => [object.id, object]));

  for (const section of raw.sections) {
    switch (section.type) {
      case 'narrative': {
        const backendTier = section.data.tier;
        const tier: 1 | 2 = backendTier === 'deep' ? 2 : 1;
        sections.push({
          type: 'narrative',
          content: typeof section.data.text === 'string' ? section.data.text : '',
          tier,
          attribution:
            typeof section.data.attribution === 'object' && section.data.attribution !== null
              ? (section.data.attribution as Record<string, unknown>)
              : null,
        });
        break;
      }

      case 'evidence_path': {
        const rawNodes = Array.isArray(section.data.nodes)
          ? section.data.nodes as Record<string, unknown>[]
          : [];
        const rawEdges = Array.isArray(section.data.edges)
          ? section.data.edges as Record<string, unknown>[]
          : [];

        const nodes: EvidenceNode[] = rawNodes.map((node) => {
          const objectId = normalizeId(node.object_id as string | number | undefined);
          const object = objectLookup.get(objectId);
          const title = typeof node.title === 'string' && node.title
            ? node.title
            : object?.title ?? 'Untitled';

          const summary = object?.summary ? [object.summary] : [];
          return {
            object_id: objectId,
            title,
            object_type: object?.object_type ?? 'note',
            epistemic_role: normalizeEpistemicRole(node.type, object?.epistemic_role, node.role),
            gradual_strength: Math.max(
              0.2,
              object?.score ?? 0.5,
              toUnitInterval(section.data.chain_confidence as number | undefined),
            ),
            claims: summary,
            metadata: {
              raw_type: node.type,
              raw_role: node.role,
            },
          };
        });

        const edges: EvidenceEdge[] = rawEdges.map((edge) => ({
          from_id: normalizeId(edge.from_id as string | number | undefined),
          to_id: normalizeId(edge.to_id as string | number | undefined),
          signal_type: normalizeSignalType(edge.signal),
          strength: typeof edge.strength === 'number' ? edge.strength : 0.5,
          relation: normalizeRelation(edge.signal),
          metadata: {
            acceptance_status: edge.acceptance_status,
          },
        }));

        sections.push({
          type: 'evidence_path',
          nodes,
          edges,
        });
        break;
      }

      case 'objects': {
        sections.push({
          type: 'objects',
          objects,
          total_available:
            typeof section.data.total_available === 'number'
              ? section.data.total_available
              : objects.length,
          scope_applied:
            typeof section.data.scope_applied === 'string'
              ? section.data.scope_applied
              : undefined,
        });
        break;
      }

      case 'tension': {
        const tensions = Array.isArray(section.data.tensions)
          ? section.data.tensions as Record<string, unknown>[]
          : [];

        tensions.forEach((tension) => {
          const claimA = tension.claim_a as Record<string, unknown> | undefined;
          const claimB = tension.claim_b as Record<string, unknown> | undefined;

          sections.push({
            type: 'tension',
            claim_a: typeof claimA?.text === 'string' ? claimA.text : '',
            claim_b: typeof claimB?.text === 'string' ? claimB.text : '',
            domain: typeof tension.domain === 'string' ? tension.domain : 'knowledge graph',
            severity: typeof tension.nli_confidence === 'number' ? tension.nli_confidence : 0.5,
            status: typeof tension.status === 'string' ? tension.status : undefined,
          });
        });
        break;
      }

      case 'structural_gap': {
        const gaps = Array.isArray(section.data.gaps)
          ? section.data.gaps as Record<string, unknown>[]
          : [];

        gaps.forEach((gap) => {
          sections.push({
            type: 'structural_gap',
            message: typeof gap.message === 'string' ? gap.message : '',
            domains: Array.isArray(gap.domains)
              ? gap.domains.filter((value): value is string => typeof value === 'string')
              : [],
            suggested_action:
              typeof gap.suggested_action === 'string' ? gap.suggested_action : undefined,
            suggested_query:
              typeof gap.suggested_query === 'string' ? gap.suggested_query : undefined,
          });
        });
        break;
      }

      case 'web_evidence': {
        const results = Array.isArray(section.data.results)
          ? section.data.results as Record<string, unknown>[]
          : [];

        results.forEach((result) => {
          sections.push({
            type: 'web_evidence',
            url: typeof result.url === 'string' ? result.url : '',
            title: typeof result.title === 'string' ? result.title : '',
            snippet: typeof result.snippet === 'string' ? result.snippet : '',
            relevance: typeof result.nli_confidence === 'number' ? result.nli_confidence : 0.5,
            stance_vs_graph:
              result.stance_vs_graph === 'supports'
              || result.stance_vs_graph === 'contradicts'
              || result.stance_vs_graph === 'novel'
                ? result.stance_vs_graph
                : undefined,
          });
        });
        break;
      }

      case 'cluster_context': {
        const clusters = Array.isArray(section.data.clusters)
          ? section.data.clusters as Record<string, unknown>[]
          : [];

        clusters.forEach((cluster) => {
          sections.push({
            type: 'cluster_context',
            cluster_id: typeof cluster.id === 'number' ? cluster.id : 0,
            label: typeof cluster.label === 'string' ? cluster.label : 'Untitled cluster',
            member_count:
              typeof cluster.object_count === 'number'
                ? cluster.object_count
                : 0,
            bridging_objects: Array.isArray(cluster.bridge_to)
              ? cluster.bridge_to.map((value) => normalizeId(value as string | number))
              : [],
            relevance: typeof cluster.relevance === 'number' ? cluster.relevance : undefined,
          });
        });
        break;
      }

      case 'hypothesis': {
        const candidates = Array.isArray(section.data.candidates)
          ? section.data.candidates as Record<string, unknown>[]
          : [];

        candidates.forEach((candidate) => {
          const title = typeof candidate.claim_text === 'string'
            ? candidate.claim_text
            : typeof candidate.title === 'string'
              ? candidate.title
              : 'Untitled hypothesis';

          sections.push({
            type: 'hypothesis',
            title,
            description:
              typeof candidate.description === 'string'
                ? candidate.description
                : title,
            confidence: average([
              toUnitInterval(candidate.composite as number | undefined),
              toUnitInterval(candidate.plausibility as number | undefined),
              toUnitInterval(candidate.testability as number | undefined),
            ]),
            supporting_objects: Array.isArray(candidate.supporting_objects)
              ? candidate.supporting_objects.map((value) => normalizeId(value as string | number))
              : [],
            structural_basis:
              typeof candidate.structural_basis === 'string'
                ? candidate.structural_basis
                : '',
            validation_status:
              typeof candidate.validation_status === 'string'
                ? candidate.validation_status
                : undefined,
            hypothesis_type:
              typeof candidate.hypothesis_type === 'string'
                ? candidate.hypothesis_type
                : undefined,
            search_queries: Array.isArray(candidate.search_queries)
              ? candidate.search_queries.filter((value): value is string => typeof value === 'string')
              : undefined,
          });
        });
        break;
      }

      case 'visualization': {
        sections.push({
          type: 'visualization',
          scene_id:
            typeof section.data.scene_id === 'string'
              ? section.data.scene_id
              : 'visualization',
          scene_data: section.data.scene_data ?? section.data,
        });
        break;
      }

      case 'data_acquisition': {
        const sources = Array.isArray(section.data.sources)
          ? section.data.sources as Array<Record<string, unknown>>
          : [];

        sections.push({
          type: 'data_acquisition',
          sources: sources.map((source) => ({
            url: typeof source.url === 'string' ? source.url : '',
            format:
              source.format === 'parquet' || source.format === 'csv' || source.format === 'json'
                ? source.format
                : 'json',
            table_name: typeof source.table_name === 'string' ? source.table_name : 'data',
          })),
          queries: Array.isArray(section.data.queries)
            ? section.data.queries.filter((value): value is string => typeof value === 'string')
            : [],
          fallback_description:
            typeof section.data.fallback_description === 'string'
              ? section.data.fallback_description
              : 'Data layer unavailable.',
        });
        break;
      }

      default:
        break;
    }
  }

  // Backward-compatible narrative fallback:
  // if backend supplied top-level answer but no narrative section,
  // synthesize one so UI rendering remains stable across API versions/modes.
  const hasNarrative = sections.some((section) => section.type === 'narrative');
  if (!hasNarrative && typeof raw.answer === 'string' && raw.answer.trim().length > 0) {
    const model =
      raw.answer_agent === 'speaking_26b'
        ? 'theseus-26b'
        : raw.answer_agent === 'speaking_26b_analyst'
          ? 'theseus-26b-analyst'
          : raw.answer_agent === 'gemma4b'
            ? 'gemma4b'
            : null;

    sections.unshift({
      type: 'narrative',
      content: raw.answer,
      tier: model && model.startsWith('theseus-26b') ? 2 : 1,
      attribution: model ? { model } : null,
    });
  }

  const evidence = toUnitInterval(raw.confidence.evidence);
  const tension = toUnitInterval(raw.confidence.tension);
  const coverage = toUnitInterval(raw.confidence.coverage);
  const sourceIndependence = toUnitInterval(raw.confidence.source_independence);

  return {
    query: raw.query,
    answer: raw.answer,
    answer_agent: raw.answer_agent,
    mode: 'full',
    confidence: {
      evidence,
      tension,
      coverage,
      source_independence: sourceIndependence,
      combined: average([evidence, coverage, sourceIndependence]),
    },
    sections,
    metadata: {
      duration_ms: raw.traversal.time_ms,
      objects_searched: raw.traversal.objects_searched,
      engine_version: 'index-api-v2',
      clusters_touched: raw.traversal.clusters_touched,
      signals_used: raw.traversal.signals_used,
      web_augmented: raw.traversal.web_augmented,
    },
    follow_ups: raw.follow_ups,
    raw_traversal: {
      objects_searched: raw.traversal.objects_searched,
      clusters_touched: raw.traversal.clusters_touched,
      signals_used: raw.traversal.signals_used,
      duration_ms: raw.traversal.time_ms,
      web_augmented: raw.traversal.web_augmented,
    },
    reference_image_url: raw.reference_image_url,
    geographic_regions: raw.geographic_regions,
    answer_type: answerType,
    answer_classification: answerClassification,
    structured_visual: normalizeStructuredVisual(raw.structured_visual),
  };
}

function normalizeObject(raw: RawObjectResponse): TheseusObject {
  return {
    id: normalizeId(raw.id ?? raw.pk),
    title: withFallback(raw.title, 'Untitled'),
    object_type: withFallback(raw.object_type ?? raw.object_type_slug, 'note'),
    summary: withFallback(raw.snippet ?? raw.body_preview ?? raw.body, ''),
    created_at: raw.created_at,
    score: raw.score,
    metadata: raw.metadata,
  };
}

function normalizeClusters(raw: RawClusterResponse): { clusters: ClusterSummary[] } {
  return {
    clusters: Array.isArray(raw.clusters)
      ? raw.clusters.map((cluster) => ({
          id: typeof cluster.id === 'number' ? cluster.id : 0,
          label: withFallback(cluster.label, 'Untitled cluster'),
          member_count:
            typeof cluster.member_count === 'number'
              ? cluster.member_count
              : typeof cluster.object_count === 'number'
                ? cluster.object_count
                : 0,
          top_objects: Array.isArray(cluster.top_objects)
            ? cluster.top_objects.map((value) => normalizeId(value))
            : Array.isArray(cluster.top_object_ids)
              ? cluster.top_object_ids.map((value) => normalizeId(value))
              : [],
        }))
      : [],
  };
}

function normalizeWhatIfRemove(raw: RawWhatIfRemoveResponse): WhatIfResult {
  return {
    removed_object_id: normalizeId(raw.removed_object_id),
    affected_edges: raw.affected_edges ?? 0,
    affected_clusters: raw.affected_clusters ?? 0,
    orphaned_objects: Array.isArray(raw.orphaned_objects)
      ? raw.orphaned_objects.map((value) => normalizeId(value))
      : [],
    narrative: withFallback(raw.narrative, ''),
  };
}

function normalizeHypotheses(raw: RawHypothesisResponse): { hypotheses: Hypothesis[] } {
  return {
    hypotheses: raw.hypotheses.map((hypothesis) => ({
      id: normalizeId(hypothesis.id),
      title: hypothesis.title,
      description: hypothesis.title,
      confidence: average([
        toUnitInterval(hypothesis.scores?.composite ?? undefined),
        toUnitInterval(hypothesis.scores?.plausibility ?? undefined),
      ]),
      supporting_objects: [],
      structural_basis: hypothesis.hypothesis_type ?? '',
      created_at: hypothesis.created_at ?? undefined,
      validation_status: hypothesis.validation_status,
      hypothesis_type: hypothesis.hypothesis_type ?? undefined,
    })),
  };
}

function normalizeGraphWeather(raw: RawGraphWeather): GraphWeather {
  const iqScore = toUnitInterval(raw.iq_score);
  const scorerAccuracy = raw.scorer_accuracy == null ? undefined : toUnitInterval(raw.scorer_accuracy);
  const healthInputs = [iqScore];
  if (typeof scorerAccuracy === 'number') {
    healthInputs.push(scorerAccuracy);
  }

  return {
    total_objects: raw.total_objects,
    total_edges: raw.total_edges,
    total_clusters: raw.clusters_count,
    recent_activity:
      raw.edges_added_24h > 0
        ? `${raw.edges_added_24h} new edges in the last 24h`
        : raw.last_engine_run
          ? `Last engine run: ${raw.last_engine_run}`
          : '',
    health_score: average(healthInputs),
    iq_score: raw.iq_score,
    tensions_active: raw.tensions_active,
    scorer_accuracy: scorerAccuracy,
    last_engine_run: raw.last_engine_run ?? undefined,
  };
}

function buildAskBody(query: string, options?: AskOptions) {
  return {
    query,
    mode: options?.mode ?? 'full',
    include_web: options?.include_web ?? false,
    max_objects: options?.max_objects ?? 12,
    scope: options?.scope ?? (options?.personal_only ? 'personal' : 'all'),
  };
}

export async function askTheseus(
  query: string,
  options?: AskOptions,
): Promise<ApiResult<TheseusResponse>> {
  if (options?.stream) {
    return askTheseusStream(query, options);
  }

  return apiFetch<RawAskResponse, TheseusResponse>('/api/v2/theseus/ask', {
    method: 'POST',
    body: JSON.stringify(buildAskBody(query, options)),
  }, normalizeAskResponse, {
    signal: options?.signal,
    timeoutMs: options?.timeoutMs,
    retryPolicy: options?.retryPolicy,
  });
}

/**
 * SSE wrapper for the ask endpoint. Currently emits a single 'answer'
 * event after the full pipeline completes. Reserved for future
 * incremental streaming when the backend supports it.
 */
async function askTheseusStream(
  query: string,
  options?: AskOptions,
): Promise<ApiResult<TheseusResponse>> {
  const controller = new AbortController();
  const externalSignal = options?.signal;

  if (externalSignal?.aborted) {
    return apiError(0, 'Request was cancelled.', 'aborted', false);
  }

  const externalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', externalAbort, { once: true });

  const timeoutMs = options?.timeoutMs ?? 120_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('/api/v2/theseus/ask/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildAskBody(query, options)),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      const transient = res.status === 408 || res.status === 429 || res.status >= 500;
      return apiError(res.status, text || res.statusText, 'http', transient);
    }

    if (!res.body) {
      return apiError(0, 'No response body for SSE stream', 'network', true);
    }

    let lastResponse: TheseusResponse | null = null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const events = buffer.split('\n\n');
      // Keep the last incomplete chunk in the buffer
      buffer = events.pop() ?? '';

      for (const eventBlock of events) {
        if (!eventBlock.trim()) continue;

        let eventName = '';
        let eventData = '';

        for (const line of eventBlock.split('\n')) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          }
        }

        if (eventName === 'done') {
          break;
        }

        if (eventName === 'answer' && eventData) {
          try {
            const raw: RawAskResponse = JSON.parse(eventData);
            const normalized = normalizeAskResponse(raw);
            lastResponse = normalized;
          } catch {
            // Skip malformed SSE data
          }
        }
      }
    }

    if (lastResponse) {
      return wrapOk(lastResponse);
    }
    return apiError(0, 'SSE stream ended without any answer', 'network', true);

  } catch (err) {
    if (controller.signal.aborted) {
      if (externalSignal?.aborted) {
        return apiError(0, 'Request was cancelled.', 'aborted', false);
      }
      return apiError(0, 'Request timed out.', 'timeout', true);
    }
    return apiError(0, err instanceof Error ? err.message : 'Network error', 'network', true);
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', externalAbort);
  }
}

/**
 * Async SSE consumer for the RQ-backed ask pipeline (Index-API 968a226).
 *
 * Two-step flow:
 *   1. POST /api/v2/theseus/ask/async/  -> { job_id, stream_url }
 *   2. EventSource stream_url           -> stage / token / answer_ready /
 *                                          visual_delta / visual_complete /
 *                                          complete / error events
 *
 * Distinct from askTheseusStream (legacy sync POST-SSE endpoint).
 * Phase B uses this to drive the ThinkingChoreographer visualizations.
 *
 * Returns a cleanup function that closes the EventSource. Handlers are
 * called progressively as the backend emits them. `complete` remains
 * the source of truth; earlier events are partial render hints.
 */
export async function askTheseusAsyncStream(
  query: string,
  options: { include_web?: boolean; signal?: AbortSignal },
  handlers: AsyncStreamHandlers,
): Promise<() => void> {
  let response: Response;
  try {
    response = await fetch('/api/v2/theseus/ask/async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        include_web: options.include_web ?? true,
      }),
      signal: options.signal,
    });
  } catch (err) {
    handlers.onError({
      message: err instanceof Error ? err.message : 'Network error enqueuing ask',
      transient: true,
    });
    return () => {};
  }

  if (!response.ok) {
    handlers.onError({
      message: `Failed to enqueue ask (${response.status})`,
      transient: response.status >= 500 || response.status === 408 || response.status === 429,
    });
    return () => {};
  }

  let payload: { job_id?: string; stream_url?: string };
  try {
    payload = await response.json();
  } catch {
    handlers.onError({ message: 'Malformed enqueue response', transient: false });
    return () => {};
  }

  const jobId = payload.job_id;
  const streamUrl = canonicalizeTheseusUrl(
    payload.stream_url ?? (jobId ? `/api/v2/theseus/ask/stream/${jobId}` : ''),
  );
  if (!streamUrl) {
    handlers.onError({ message: 'Missing job_id in enqueue response', transient: false });
    return () => {};
  }

  const es = new EventSource(streamUrl);

  const safeParse = <T,>(raw: string, label: string): T | null => {
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[theseus-sse] failed to parse ${label}`, err);
      return null;
    }
  };

  es.addEventListener('stage', (e) => {
    const data = safeParse<StageEvent>((e as MessageEvent).data, 'stage');
    if (data) handlers.onStage(data);
  });

  es.addEventListener('token', (e) => {
    const data = safeParse<{ text: string }>((e as MessageEvent).data, 'token');
    if (data?.text) handlers.onToken(data.text);
  });

  es.addEventListener('visual_delta', (e) => {
    const data = safeParse<RawProgressiveVisualPayload>((e as MessageEvent).data, 'visual_delta');
    if (data) {
      handlers.onVisualDelta?.(normalizeProgressiveVisualPayload(data));
    }
  });

  es.addEventListener('answer_ready', (e) => {
    const data = safeParse<RawAskResponse>((e as MessageEvent).data, 'answer_ready');
    if (!data) return;

    try {
      handlers.onAnswerReady?.(normalizeAskResponse(data));
    } catch (err) {
      handlers.onError({
        message: err instanceof Error ? err.message : 'Failed to normalize answer_ready payload',
        transient: false,
      });
    }
  });

  es.addEventListener('visual_complete', (e) => {
    const data = safeParse<RawProgressiveVisualPayload>((e as MessageEvent).data, 'visual_complete');
    if (data) {
      handlers.onVisualComplete?.(normalizeProgressiveVisualPayload(data));
    }
  });

  es.addEventListener('complete', (e) => {
    const data = safeParse<RawAskResponse>((e as MessageEvent).data, 'complete');
    if (data) {
      try {
        const normalized = normalizeAskResponse(data);
        handlers.onComplete(normalized);
      } catch (err) {
        handlers.onError({
          message: err instanceof Error ? err.message : 'Failed to normalize response',
          transient: false,
        });
      }
    }
    es.close();
  });

  es.addEventListener('error', () => {
    handlers.onError({ message: 'Stream error', transient: true });
    es.close();
  });

  // Honor external abort signal
  if (options.signal) {
    options.signal.addEventListener('abort', () => es.close(), { once: true });
  }

  return () => es.close();
}

export async function getObject(
  id: string,
): Promise<ApiResult<TheseusObject>> {
  return apiFetch<RawObjectResponse, TheseusObject>(`/api/v2/theseus/objects/${id}`, undefined, normalizeObject);
}

export async function getClusters(): Promise<ApiResult<{ clusters: ClusterSummary[] }>> {
  return apiFetch<RawClusterResponse, { clusters: ClusterSummary[] }>('/api/v2/theseus/clusters', undefined, normalizeClusters);
}

export async function whatIfRemove(
  objectId: string,
): Promise<ApiResult<WhatIfResult>> {
  return apiFetch<RawWhatIfRemoveResponse, WhatIfResult>(`/api/v2/theseus/what-if-remove/${objectId}`, undefined, normalizeWhatIfRemove);
}

export async function getHypotheses(): Promise<ApiResult<{ hypotheses: Hypothesis[] }>> {
  return apiFetch<RawHypothesisResponse, { hypotheses: Hypothesis[] }>('/api/v2/theseus/hypotheses', undefined, normalizeHypotheses);
}

export async function getGraphWeather(): Promise<ApiResult<GraphWeather>> {
  return apiFetch<RawGraphWeather, GraphWeather>('/api/v2/theseus/graph-weather', undefined, normalizeGraphWeather);
}

/* ─────────────────────────────────────────────────
   Explorer: object neighborhood fetchers
   ───────────────────────────────────────────────── */

interface RawEdge {
  id?: number | string;
  pk?: number | string;
  source_object?: Record<string, unknown>;
  target_object?: Record<string, unknown>;
  source_object_id?: number | string;
  target_object_id?: number | string;
  signal_type?: string;
  combined_score?: number;
  strength?: number;
  acceptance_status?: string;
}

function normalizeConnections(
  raw: { results?: RawEdge[] } | RawEdge[],
  objectId: string,
): { connections: ConnectionResult[] } {
  const edges = Array.isArray(raw) ? raw : Array.isArray(raw.results) ? raw.results : [];
  return {
    connections: edges.map((edge) => {
      const edgeId = normalizeId(edge.id ?? edge.pk);
      const sourceRec = edge.source_object as Record<string, unknown> | undefined;
      const targetRec = edge.target_object as Record<string, unknown> | undefined;
      const sourceId = normalizeId(
        (edge.source_object_id ?? sourceRec?.id) as string | number | undefined,
      );
      const targetId = normalizeId(
        (edge.target_object_id ?? targetRec?.id) as string | number | undefined,
      );
      const isOutgoing = sourceId === objectId;
      const connectedRaw = isOutgoing ? edge.target_object : edge.source_object;
      const connectedId = isOutgoing ? targetId : sourceId;

      return {
        edge_id: edgeId,
        connected_object: {
          id: connectedId,
          title:
            typeof connectedRaw === 'object' && connectedRaw !== null && typeof (connectedRaw as Record<string, unknown>).title === 'string'
              ? (connectedRaw as Record<string, unknown>).title as string
              : 'Untitled',
          object_type:
            typeof connectedRaw === 'object' && connectedRaw !== null
              ? (((connectedRaw as Record<string, unknown>).object_type_slug ?? (connectedRaw as Record<string, unknown>).object_type) as string) ?? 'note'
              : 'note',
        },
        signal_type: typeof edge.signal_type === 'string' ? edge.signal_type : 'entity',
        strength: toUnitInterval(edge.combined_score ?? edge.strength),
        direction: isOutgoing ? 'outgoing' as const : 'incoming' as const,
        acceptance_status: typeof edge.acceptance_status === 'string' ? edge.acceptance_status : undefined,
      };
    }),
  };
}

export async function getObjectConnections(
  objectId: string,
  limit = 20,
): Promise<ApiResult<{ connections: ConnectionResult[] }>> {
  type RawResponse = { results?: RawEdge[] } | RawEdge[];
  return apiFetch<RawResponse, { connections: ConnectionResult[] }>(
    `/api/v1/edges/?object_id=${objectId}&limit=${limit}`,
    undefined,
    (raw) => normalizeConnections(raw, objectId),
  );
}

interface RawClaim {
  id?: number | string;
  pk?: number | string;
  text?: string;
  claim_text?: string;
  confidence?: number;
  entrenchment?: number;
  epistemic_status?: string;
  status?: string;
  source_object_id?: number | string;
  source_object?: number | string;
}

function normalizeClaims(
  raw: { results?: RawClaim[] } | RawClaim[],
): { claims: ClaimResult[] } {
  const items = Array.isArray(raw) ? raw : Array.isArray(raw.results) ? raw.results : [];
  return {
    claims: items.map((claim) => ({
      id: normalizeId(claim.id ?? claim.pk),
      text: typeof claim.text === 'string' ? claim.text : typeof claim.claim_text === 'string' ? claim.claim_text : '',
      confidence: toUnitInterval(claim.confidence ?? claim.entrenchment),
      epistemic_status:
        typeof claim.epistemic_status === 'string'
          ? claim.epistemic_status
          : typeof claim.status === 'string'
            ? claim.status
            : 'pending',
      source_object_id: normalizeId(claim.source_object_id ?? claim.source_object),
    })),
  };
}

export async function getObjectClaims(
  objectId: string,
): Promise<ApiResult<{ claims: ClaimResult[] }>> {
  type RawResponse = { results?: RawClaim[] } | RawClaim[];
  return apiFetch<RawResponse, { claims: ClaimResult[] }>(
    `/api/v1/claims/?object_id=${objectId}`,
    undefined,
    normalizeClaims,
  );
}

interface RawTension {
  id?: number | string;
  pk?: number | string;
  claim_a?: { text?: string; claim_text?: string };
  claim_b?: { text?: string; claim_text?: string };
  claim_a_text?: string;
  claim_b_text?: string;
  nli_confidence?: number;
  severity?: number;
  status?: string;
  domain?: string;
}

function normalizeTensions(
  raw: { results?: RawTension[] } | RawTension[],
): { tensions: TensionResult[] } {
  const items = Array.isArray(raw) ? raw : Array.isArray(raw.results) ? raw.results : [];
  return {
    tensions: items.map((tension) => ({
      id: normalizeId(tension.id ?? tension.pk),
      claim_a_text:
        typeof tension.claim_a_text === 'string'
          ? tension.claim_a_text
          : tension.claim_a?.text ?? tension.claim_a?.claim_text ?? '',
      claim_b_text:
        typeof tension.claim_b_text === 'string'
          ? tension.claim_b_text
          : tension.claim_b?.text ?? tension.claim_b?.claim_text ?? '',
      severity: toUnitInterval(tension.nli_confidence ?? tension.severity),
      status: typeof tension.status === 'string' ? tension.status : 'active',
      domain: typeof tension.domain === 'string' ? tension.domain : 'knowledge graph',
    })),
  };
}

export async function getObjectTensions(
  objectId: string,
): Promise<ApiResult<{ tensions: TensionResult[] }>> {
  type RawResponse = { results?: RawTension[] } | RawTension[];
  return apiFetch<RawResponse, { tensions: TensionResult[] }>(
    `/api/v1/tensions/?object_id=${objectId}`,
    undefined,
    normalizeTensions,
  );
}

interface RawLineage {
  source_url?: string;
  ingested_at?: string;
  created_at?: string;
  parent_objects?: Array<string | number>;
  parent_object_ids?: Array<string | number>;
  ingestion_method?: string;
  source_type?: string;
}

function normalizeLineage(raw: RawLineage): { lineage: LineageResult } {
  return {
    lineage: {
      source_url: typeof raw.source_url === 'string' ? raw.source_url : undefined,
      ingested_at: raw.ingested_at ?? raw.created_at,
      parent_objects: Array.isArray(raw.parent_objects)
        ? raw.parent_objects.map((v) => normalizeId(v))
        : Array.isArray(raw.parent_object_ids)
          ? raw.parent_object_ids.map((v) => normalizeId(v))
          : [],
      ingestion_method: raw.ingestion_method ?? raw.source_type ?? 'unknown',
    },
  };
}

export async function getObjectLineage(
  objectId: string,
): Promise<ApiResult<{ lineage: LineageResult }>> {
  return apiFetch<RawLineage, { lineage: LineageResult }>(
    `/api/v1/objects/${objectId}/lineage`,
    undefined,
    normalizeLineage,
  );
}

/* ─────────────────────────────────────────────────
   Graph Explorer: graph data, path, artifacts, diff
   ───────────────────────────────────────────────── */

export async function getGraphData(
  params?: { center?: string; hops?: number; limit?: number },
): Promise<ApiResult<GraphData>> {
  const searchParams = new URLSearchParams();
  if (params?.center) searchParams.set('center', params.center);
  if (params?.hops) searchParams.set('hops', String(params.hops));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  const qs = searchParams.toString();
  const path = `/api/v1/notebook/graph/${qs ? `?${qs}` : ''}`;

  return apiFetch<Record<string, unknown>, GraphData>(path, undefined, (raw) => {
    const nodes = Array.isArray(raw.nodes) ? (raw.nodes as Record<string, unknown>[]).map((n) => ({
      id: normalizeId(n.id as string | number),
      title: typeof n.title === 'string' ? n.title : 'Untitled',
      slug: typeof n.slug === 'string' ? n.slug : '',
      body_preview: typeof n.body_preview === 'string' ? n.body_preview : '',
      object_type: typeof n.object_type === 'string' ? n.object_type : 'note',
      object_type_color: typeof n.object_type_color === 'string' ? n.object_type_color : '#9a958d',
      object_type_icon: typeof n.object_type_icon === 'string' ? n.object_type_icon : '',
      edge_count: typeof n.edge_count === 'number' ? n.edge_count : 0,
      size: typeof n.size === 'number' ? n.size : 1,
      status: typeof n.status === 'string' ? n.status : '',
    })) : [];

    const edges = Array.isArray(raw.edges) ? (raw.edges as Record<string, unknown>[]).map((e) => ({
      id: typeof e.id === 'string' ? e.id : `${e.source}-${e.target}`,
      source: normalizeId(e.source as string | number ?? e.from_object as string | number),
      target: normalizeId(e.target as string | number ?? e.to_object as string | number),
      edge_type: typeof e.edge_type === 'string' ? e.edge_type : 'connection',
      strength: typeof e.strength === 'number' ? e.strength : 0.5,
      reason: typeof e.reason === 'string' ? e.reason : '',
      engine: typeof e.engine === 'string' ? e.engine : '',
    })) : [];

    const meta = typeof raw.meta === 'object' && raw.meta !== null ? raw.meta as Record<string, unknown> : {};
    return {
      nodes,
      edges,
      meta: {
        node_count: typeof meta.node_count === 'number' ? meta.node_count : nodes.length,
        edge_count: typeof meta.edge_count === 'number' ? meta.edge_count : edges.length,
        type_distribution: typeof meta.type_distribution === 'object' && meta.type_distribution !== null
          ? meta.type_distribution as Record<string, number>
          : {},
        truncated: typeof meta.truncated === 'boolean' ? meta.truncated : false,
      },
    };
  });
}

export async function searchObjects(
  query: string,
  limit = 10,
): Promise<ApiResult<{ objects: TheseusObject[] }>> {
  return apiFetch<Record<string, unknown>, { objects: TheseusObject[] }>(
    `/api/v2/theseus/objects/?q=${encodeURIComponent(query)}&limit=${limit}`,
    undefined,
    (raw) => {
      // Backend returns `items` (v2 endpoint shape)
      const items = Array.isArray(raw.items) ? raw.items
        : Array.isArray(raw.results) ? raw.results
        : [];
      return {
        objects: (items as Record<string, unknown>[]).map(normalizeTheseusObject),
      };
    },
  );
}

export async function pathBetween(
  pkA: string,
  pkB: string,
): Promise<ApiResult<PathResult>> {
  return apiFetch<Record<string, unknown>, PathResult>(
    `/api/v1/notebook/objects/${pkA}/path-to/${pkB}/`,
    undefined,
    (raw) => ({
      nodes: Array.isArray(raw.nodes) ? (raw.nodes as (string | number)[]).map(String) : [],
      edges: Array.isArray(raw.edges) ? (raw.edges as Record<string, unknown>[]).map((e) => ({
        from: String(e.from ?? e.source ?? ''),
        to: String(e.to ?? e.target ?? ''),
        edge_type: typeof e.edge_type === 'string' ? e.edge_type : 'connection',
        strength: typeof e.strength === 'number' ? e.strength : 0.5,
      })) : [],
      length: typeof raw.length === 'number' ? raw.length : -1,
    }),
  );
}

export async function createArtifact(
  data: {
    artifact_type: string;
    title: string;
    query: string;
    response_snapshot: Record<string, unknown>;
    graph_snapshot: Record<string, unknown>;
  },
): Promise<ApiResult<ArtifactMeta>> {
  return apiFetch<Record<string, unknown>, ArtifactMeta>(
    '/api/v1/notebook/artifacts/',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    (raw) => ({
      id: String(raw.id ?? ''),
      artifact_type: (raw.artifact_type as ArtifactMeta['artifact_type']) ?? 'evidence_map',
      title: typeof raw.title === 'string' ? raw.title : '',
      query: typeof raw.query === 'string' ? raw.query : '',
      created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
      object_id: String(raw.object_id ?? ''),
      share_url: typeof raw.share_url === 'string' ? raw.share_url : '',
      embed_html: typeof raw.embed_html === 'string' ? raw.embed_html : '',
    }),
  );
}

export async function getArtifact(
  artifactId: string,
): Promise<ApiResult<ArtifactMeta & { response_snapshot: Record<string, unknown>; graph_snapshot: Record<string, unknown> }>> {
  return apiFetch<Record<string, unknown>, ArtifactMeta & { response_snapshot: Record<string, unknown>; graph_snapshot: Record<string, unknown> }>(
    `/api/v1/notebook/artifacts/${artifactId}/`,
    undefined,
    (raw) => ({
      id: String(raw.id ?? ''),
      artifact_type: (raw.artifact_type as ArtifactMeta['artifact_type']) ?? 'evidence_map',
      title: typeof raw.title === 'string' ? raw.title : '',
      query: typeof raw.query === 'string' ? raw.query : '',
      created_at: typeof raw.created_at === 'string' ? raw.created_at : '',
      object_id: String(raw.object_id ?? ''),
      share_url: typeof raw.share_url === 'string' ? raw.share_url : '',
      embed_html: typeof raw.embed_html === 'string' ? raw.embed_html : '',
      response_snapshot: typeof raw.response_snapshot === 'object' && raw.response_snapshot !== null
        ? raw.response_snapshot as Record<string, unknown>
        : {},
      graph_snapshot: typeof raw.graph_snapshot === 'object' && raw.graph_snapshot !== null
        ? raw.graph_snapshot as Record<string, unknown>
        : {},
    }),
  );
}

export async function getGraphDiff(
  fromDate: string,
  toDate: string,
): Promise<ApiResult<GraphDiff>> {
  return apiFetch<Record<string, unknown>, GraphDiff>(
    `/api/v1/notebook/graph/diff/?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`,
    undefined,
    (raw) => ({
      added_objects: Array.isArray(raw.added_objects)
        ? (raw.added_objects as Record<string, unknown>[]).map(normalizeTheseusObject)
        : [],
      removed_objects: Array.isArray(raw.removed_objects)
        ? (raw.removed_objects as Record<string, unknown>[]).map(normalizeTheseusObject)
        : [],
      new_edges: Array.isArray(raw.new_edges)
        ? (raw.new_edges as Record<string, unknown>[]).map((e) => ({
            id: typeof e.id === 'string' ? e.id : `${e.source}-${e.target}`,
            source: String(e.source ?? e.from_object ?? ''),
            target: String(e.target ?? e.to_object ?? ''),
            edge_type: typeof e.edge_type === 'string' ? e.edge_type : 'connection',
            strength: typeof e.strength === 'number' ? e.strength : 0.5,
            reason: typeof e.reason === 'string' ? e.reason : '',
            engine: typeof e.engine === 'string' ? e.engine : '',
          }))
        : [],
      retracted_claims: Array.isArray(raw.retracted_claims)
        ? (raw.retracted_claims as Record<string, unknown>[]).map((c) => ({
            id: String(c.id ?? ''),
            text: typeof c.text === 'string' ? c.text : '',
            confidence: typeof c.confidence === 'number' ? c.confidence : 0,
            epistemic_status: typeof c.epistemic_status === 'string' ? c.epistemic_status : 'pending',
            source_object_id: String(c.source_object_id ?? ''),
          }))
        : [],
      resolved_tensions: Array.isArray(raw.resolved_tensions)
        ? (raw.resolved_tensions as Record<string, unknown>[]).map((t) => ({
            id: String(t.id ?? ''),
            claim_a_text: typeof t.claim_a_text === 'string' ? t.claim_a_text : '',
            claim_b_text: typeof t.claim_b_text === 'string' ? t.claim_b_text : '',
            severity: typeof t.severity === 'number' ? t.severity : 0,
            status: typeof t.status === 'string' ? t.status : 'resolved',
            domain: typeof t.domain === 'string' ? t.domain : '',
          }))
        : [],
      new_tensions: Array.isArray(raw.new_tensions)
        ? (raw.new_tensions as Record<string, unknown>[]).map((t) => ({
            id: String(t.id ?? ''),
            claim_a_text: typeof t.claim_a_text === 'string' ? t.claim_a_text : '',
            claim_b_text: typeof t.claim_b_text === 'string' ? t.claim_b_text : '',
            severity: typeof t.severity === 'number' ? t.severity : 0,
            status: typeof t.status === 'string' ? t.status : 'active',
            domain: typeof t.domain === 'string' ? t.domain : '',
          }))
        : [],
      summary: typeof raw.summary === 'string' ? raw.summary : '',
    }),
  );
}

/* ─────────────────────────────────────────────────
   Code Intelligence (Ninja, /api/v2/theseus/code/*)

   These endpoints sit on the Theseus UI API (Ninja)
   rather than the gated product API (DRF). All paths
   proxy through the Next.js rewrite in next.config.ts.
   ───────────────────────────────────────────────── */

export async function codeImpact(
  symbolName: string,
  options?: {
    direction?: 'upstream' | 'downstream' | 'both';
    maxDepth?: number;
    minConfidence?: number;
  },
  controls?: RequestControls,
): Promise<ApiResult<CodeImpactResult>> {
  const params = new URLSearchParams({ symbol: symbolName });
  if (options?.direction) params.set('direction', options.direction);
  if (typeof options?.maxDepth === 'number') params.set('max_depth', String(options.maxDepth));
  if (typeof options?.minConfidence === 'number') params.set('min_confidence', String(options.minConfidence));
  return apiFetch<CodeImpactResult>(
    `/api/v2/theseus/code/impact/?${params.toString()}`,
    undefined,
    undefined,
    controls,
  );
}

export async function codeContext(
  symbolName: string,
  controls?: RequestControls,
): Promise<ApiResult<CodeContextResult>> {
  return apiFetch<CodeContextResult>(
    `/api/v2/theseus/code/context/?symbol=${encodeURIComponent(symbolName)}`,
    undefined,
    undefined,
    controls,
  );
}

export async function codeProcesses(
  options?: { entryPointType?: string },
  controls?: RequestControls,
): Promise<ApiResult<{ processes: CodeProcess[] }>> {
  const qs = options?.entryPointType
    ? `?entry_point_type=${encodeURIComponent(options.entryPointType)}`
    : '';
  return apiFetch<{ processes: CodeProcess[] }>(
    `/api/v2/theseus/code/processes/${qs}`,
    undefined,
    undefined,
    controls,
  );
}

export async function codeDrift(
  specObjectId: string,
  controls?: RequestControls,
): Promise<ApiResult<{ tensions: DriftTension[] }>> {
  return apiFetch<{ tensions: DriftTension[] }>(
    `/api/v2/theseus/code/drift/?spec_id=${encodeURIComponent(specObjectId)}`,
    undefined,
    undefined,
    controls,
  );
}

export async function codeExplain(
  symbolName: string,
  controls?: RequestControls,
): Promise<ApiResult<CodeExplainResult>> {
  return apiFetch<CodeExplainResult>(
    `/api/v2/theseus/code/explain/?symbol=${encodeURIComponent(symbolName)}`,
    undefined,
    undefined,
    controls,
  );
}

export async function getCodeSymbols(
  options?: { entityType?: CodeEntityType; language?: string; search?: string },
  controls?: RequestControls,
): Promise<ApiResult<{ symbols: CodeSymbol[] }>> {
  const params = new URLSearchParams();
  if (options?.entityType) params.set('entity_type', options.entityType);
  if (options?.language) params.set('language', options.language);
  if (options?.search) params.set('search', options.search);
  const qs = params.toString();
  return apiFetch<{ symbols: CodeSymbol[] }>(
    `/api/v2/theseus/code/symbols/${qs ? `?${qs}` : ''}`,
    undefined,
    undefined,
    controls,
  );
}

export async function ingestCodebase(
  payload: IngestRequest,
  controls?: RequestControls,
): Promise<ApiResult<IngestionStats>> {
  return apiFetch<IngestionStats>(
    '/api/v2/theseus/code/ingest/',
    { method: 'POST', body: JSON.stringify(payload) },
    undefined,
    controls,
  );
}

export async function getFixPatterns(
  symbolName?: string,
  controls?: RequestControls,
): Promise<ApiResult<{ patterns: FixPattern[] }>> {
  const qs = symbolName ? `?symbol=${encodeURIComponent(symbolName)}` : '';
  return apiFetch<{ patterns: FixPattern[] }>(
    `/api/v2/theseus/code/patterns/${qs}`,
    undefined,
    undefined,
    controls,
  );
}

export async function submitFixPattern(
  patternId: string,
  controls?: RequestControls,
): Promise<ApiResult<{ submitted: boolean; message: string }>> {
  return apiFetch<{ submitted: boolean; message: string }>(
    '/api/v2/theseus/code/patterns/submit/',
    { method: 'POST', body: JSON.stringify({ pattern_id: patternId }) },
    undefined,
    controls,
  );
}

/**
 * Resolve a drift tension. Hits the DRF tension endpoint
 * (not Ninja) because tension CRUD lives on /api/v1/notebook/.
 */
export async function resolveDriftTension(
  tensionId: string,
  action: 'update_spec' | 'flag' | 'dismiss',
  controls?: RequestControls,
): Promise<ApiResult<{ status: string }>> {
  const nextStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
  return apiFetch<{ status: string }>(
    `/api/v1/notebook/tensions/${encodeURIComponent(tensionId)}/`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        status: nextStatus,
        resolution_note: `drift_action:${action}`,
      }),
    },
    undefined,
    controls,
  );
}
