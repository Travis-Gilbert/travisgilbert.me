import type {
  AskOptions,
  ClusterSummary,
  EvidenceEdge,
  EvidenceNode,
  FollowUp,
  GeographicRegionsSection,
  GraphWeather,
  Hypothesis,
  ResponseSection,
  TheseusObject,
  TheseusResponse,
  WhatIfResult,
} from './theseus-types';

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

const DEFAULT_TIMEOUT_MS = 14_000;
const RETRY_DELAY_MS = 250;

interface RawAskResponse {
  query: string;
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

async function apiFetch<TInput extends object, TOutput extends object = TInput>(
  path: string,
  init?: RequestInit,
  normalize?: (data: TInput) => TOutput,
  controls?: RequestControls,
): Promise<ApiResult<TOutput>> {
  const timeoutMs = controls?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryPolicy = controls?.retryPolicy ?? 'transient-once';
  const maxAttempts = retryPolicy === 'transient-once' ? 2 : 1;

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
      const res = await fetch(path, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        const status = res.status;
        const transient = status === 408 || status === 429 || status >= 500;
        lastError = apiError(status, text || res.statusText, 'http', transient);
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

function normalizeAskResponse(raw: RawAskResponse): TheseusResponse {
  const sections: ResponseSection[] = [];

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

  const evidence = toUnitInterval(raw.confidence.evidence);
  const tension = toUnitInterval(raw.confidence.tension);
  const coverage = toUnitInterval(raw.confidence.coverage);
  const sourceIndependence = toUnitInterval(raw.confidence.source_independence);

  return {
    query: raw.query,
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

  return apiFetch<RawAskResponse, TheseusResponse>('/api/v2/theseus/ask/', {
    method: 'POST',
    body: JSON.stringify(buildAskBody(query, options)),
  }, normalizeAskResponse, {
    signal: options?.signal,
    timeoutMs: options?.timeoutMs,
    retryPolicy: options?.retryPolicy,
  });
}

/**
 * Progressive answer via SSE: fast answer arrives in 2 to 4s,
 * deep answer (if warranted) replaces it 15 to 45s later.
 *
 * Calls the /ask/stream/ endpoint which emits SSE events:
 *   fast_answer -> deep_answer (optional) -> done
 *
 * The returned promise resolves with the final (best) answer.
 * Use options.onFastAnswer to render the fast answer immediately.
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
    const res = await fetch('/api/v2/theseus/ask/stream/', {
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

        if ((eventName === 'fast_answer' || eventName === 'deep_answer') && eventData) {
          try {
            const raw: RawAskResponse = JSON.parse(eventData);
            const normalized = normalizeAskResponse(raw);
            lastResponse = normalized;

            if (eventName === 'fast_answer' && options?.onFastAnswer) {
              options.onFastAnswer(normalized);
            }
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

export async function getObject(
  id: string,
): Promise<ApiResult<TheseusObject>> {
  return apiFetch<RawObjectResponse, TheseusObject>(`/api/v2/theseus/objects/${id}/`, undefined, normalizeObject);
}

export async function getClusters(): Promise<ApiResult<{ clusters: ClusterSummary[] }>> {
  return apiFetch<RawClusterResponse, { clusters: ClusterSummary[] }>('/api/v2/theseus/clusters/', undefined, normalizeClusters);
}

export async function whatIfRemove(
  objectId: string,
): Promise<ApiResult<WhatIfResult>> {
  return apiFetch<RawWhatIfRemoveResponse, WhatIfResult>(`/api/v2/theseus/what-if-remove/${objectId}/`, undefined, normalizeWhatIfRemove);
}

export async function getHypotheses(): Promise<ApiResult<{ hypotheses: Hypothesis[] }>> {
  return apiFetch<RawHypothesisResponse, { hypotheses: Hypothesis[] }>('/api/v2/theseus/hypotheses/', undefined, normalizeHypotheses);
}

export async function getGraphWeather(): Promise<ApiResult<GraphWeather>> {
  return apiFetch<RawGraphWeather, GraphWeather>('/api/v2/theseus/graph-weather/', undefined, normalizeGraphWeather);
}
