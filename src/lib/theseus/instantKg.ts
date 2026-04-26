// SSE consumer for the instant-KG capture pipeline. Mirrors the
// askTheseusAsyncStream scaffold in src/lib/theseus-api.ts: POST to the
// async endpoint, then attach an EventSource to the returned stream URL.
//
// Backend contract (per docs/plans/instant-kg/):
//   POST /api/v2/theseus/capture/instant-kg/   -> { job_id, stream_url }
//   GET  stream_url                            -> SSE events:
//     stage              pipeline progress (data: { name, ... })
//     document_created   parent Object created
//     chunk_created      chunk persisted and dispatched
//     entity_extracted   entity from a chunk
//     relation_extracted typed relation from a chunk
//     cross_doc_edge     SBERT cross-doc edge
//     complete           final response payload (terminal)
//     error              terminal error (terminal)

export interface InstantKgStreamHandlers {
  onStage?: (stage: { name: string; [k: string]: unknown }) => void;
  onDocument?: (event: InstantKgDocumentEvent) => void;
  onChunk?: (event: InstantKgChunkEvent) => void;
  onEntity?: (event: InstantKgEntityEvent) => void;
  onRelation?: (event: InstantKgRelationEvent) => void;
  onCrossDocEdge?: (event: InstantKgCrossDocEvent) => void;
  onComplete: (event: InstantKgCompleteEvent) => void;
  onTensionProposed?: (event: InstantKgTensionProposedEvent) => void;
  onError: (error: { message: string; transient: boolean; stage?: string; fallback_used?: string | null }) => void;
}

export interface InstantKgDocumentEvent {
  object_id: number | null;
  title: string;
  url: string | null;
  object_type: string;
  color: string;
  fetch_provenance: {
    tier: 'tavily' | 'trafilatura' | 'native_parser' | 'youtube_transcript_api' | 'pymupdf_fallback';
    tavily_credits_used: number | null;
    fallback_reason: string | null;
  };
}

export interface InstantKgChunkEvent {
  chunk_id: number | null;
  parent_object_id: number | null;
  chunk_index: number;
  text_preview: string;
  edge: {
    source: number;
    target: number;
    edge_type: 'part_of';
    engine: 'instant_kg';
    reason: string;
  };
}

export interface InstantKgTensionProposedEvent {
  tension_id: number;
  tension_type: 'spec_drift';
  scope: {
    proposing_model: string;
    original_surface_form: string;
    source_chunk_object_id: number;
    glirel_confidence: number;
    proposed_relation: { subject: string; predicate: string; object: string };
  };
}

export interface InstantKgEntityEvent {
  object_id: number | null;
  label: string;
  type: string;
  color: string;
  source_chunk_id: number | null;
  score: number;
  is_new_object: boolean;
}

export type InstantKgRelationRoute =
  | 'glirel'
  | 'open_extras'
  | 'open_extras_pending';

export interface InstantKgRelationEvent {
  edge_id: number | null;
  source_object_id: number | null;
  target_object_id: number | null;
  edge_type: string;
  weight: number;
  source_chunk_id: number | null;
  score: number;
  route: InstantKgRelationRoute;
}

export interface InstantKgCrossDocEvent {
  edge_id: number | null;
  source_object_id: number | null;
  target_object_id: number | null;
  edge_type: string;
  weight: number;
  sbert_score: number;
}

export interface InstantKgFocusNeighbor {
  object_id: number | null;
  ppr_score: number;
}

export interface InstantKgCompleteEvent {
  document_object_id: number | null;
  focus: {
    pivot_object_id: number | null;
    neighbors: InstantKgFocusNeighbor[];
  };
  totals: {
    chunks: number;
    entities: number;
    relations: number;
    cross_doc_edges: number;
    open_extras_proposals?: number;
  };
}

export type InstantKgMode = 'url' | 'file' | 'text';

export interface InstantKgRequest {
  mode: InstantKgMode;
  text?: string;
  file?: File | null;
  schema_constrained?: boolean;
  title_hint?: string;
  notebook_slug?: string;
}

export interface InstantKgStreamOptions {
  signal?: AbortSignal;
}

export async function instantKgStream(
  request: InstantKgRequest,
  options: InstantKgStreamOptions,
  handlers: InstantKgStreamHandlers,
): Promise<() => void> {
  const body = await buildRequestBody(request);
  if (!body.ok) {
    handlers.onError({ message: body.message, transient: false });
    return () => {};
  }

  // File uploads route to the multipart endpoint; URL and text route
  // to the JSON endpoint. Both return the same {job_id, stream_url}
  // shape so the EventSource connection below is identical.
  const endpoint =
    request.mode === 'file'
      ? '/api/v2/theseus/capture/instant-kg/file/'
      : '/api/v2/theseus/capture/instant-kg/';

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: body.headers,
      body: body.body,
      signal: options.signal,
    });
  } catch (err) {
    handlers.onError({
      message: err instanceof Error ? err.message : 'Network error enqueuing instant-kg',
      transient: true,
    });
    return () => {};
  }

  if (!response.ok) {
    handlers.onError({
      message: `Failed to enqueue instant-kg (${response.status})`,
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
  const streamUrl =
    payload.stream_url ??
    (jobId ? `/api/v2/theseus/capture/instant-kg/stream/${jobId}/` : '');
  if (!streamUrl) {
    handlers.onError({ message: 'Missing job_id in enqueue response', transient: false });
    return () => {};
  }

  const es = new EventSource(streamUrl);

  const safeParse = <T,>(raw: string, label: string): T | null => {
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[instant-kg-sse] failed to parse ${label}`, err);
      return null;
    }
  };

  es.addEventListener('stage', (e) => {
    const data = safeParse<{ name: string }>((e as MessageEvent).data, 'stage');
    if (data) handlers.onStage?.(data);
  });

  es.addEventListener('document_created', (e) => {
    const data = safeParse<InstantKgDocumentEvent>((e as MessageEvent).data, 'document_created');
    if (data) handlers.onDocument?.(data);
  });

  es.addEventListener('chunk_created', (e) => {
    const data = safeParse<InstantKgChunkEvent>((e as MessageEvent).data, 'chunk_created');
    if (data) handlers.onChunk?.(data);
  });

  es.addEventListener('entity_extracted', (e) => {
    const data = safeParse<InstantKgEntityEvent>((e as MessageEvent).data, 'entity_extracted');
    if (data) handlers.onEntity?.(data);
  });

  es.addEventListener('relation_extracted', (e) => {
    const data = safeParse<InstantKgRelationEvent>((e as MessageEvent).data, 'relation_extracted');
    if (data) handlers.onRelation?.(data);
  });

  es.addEventListener('cross_doc_edge', (e) => {
    const data = safeParse<InstantKgCrossDocEvent>((e as MessageEvent).data, 'cross_doc_edge');
    if (data) handlers.onCrossDocEdge?.(data);
  });

  es.addEventListener('tension_proposed', (e) => {
    if (!handlers.onTensionProposed) return;
    const data = safeParse<InstantKgTensionProposedEvent>(
      (e as MessageEvent).data,
      'tension_proposed',
    );
    if (data) handlers.onTensionProposed(data);
  });

  es.addEventListener('complete', (e) => {
    const data = safeParse<InstantKgCompleteEvent>((e as MessageEvent).data, 'complete');
    if (data) handlers.onComplete(data);
    es.close();
  });

  es.addEventListener('error', (e) => {
    // Named SSE 'error' frames carry a JSON payload; the built-in
    // EventSource 'error' (connection drop) does not.
    const raw = (e as MessageEvent).data;
    let message = 'Stream error';
    if (typeof raw === 'string' && raw.length > 0) {
      const parsed = safeParse<{ error?: string; message?: string }>(raw, 'error');
      if (parsed?.error) message = parsed.error;
      else if (parsed?.message) message = parsed.message;
    }
    handlers.onError({ message, transient: true });
    es.close();
  });

  if (options.signal) {
    options.signal.addEventListener('abort', () => es.close(), { once: true });
  }

  return () => es.close();
}

interface RequestBodyOk {
  ok: true;
  headers: HeadersInit;
  body: BodyInit;
}

interface RequestBodyErr {
  ok: false;
  message: string;
}

async function buildRequestBody(
  request: InstantKgRequest,
): Promise<RequestBodyOk | RequestBodyErr> {
  if (request.mode === 'file') {
    if (!request.file) {
      return { ok: false, message: 'mode=file requires a File' };
    }
    // Multipart body. The backend's /file/ endpoint reads the file
    // bytes off the upload, stashes them in the RQ payload, and the
    // worker hands them to the native parser shim. Do NOT set
    // Content-Type explicitly: the browser sets the multipart
    // boundary correctly only when the header is absent.
    const form = new FormData();
    form.append('file', request.file, request.file.name);
    form.append(
      'schema_constrained',
      String(request.schema_constrained ?? true),
    );
    form.append('title_hint', request.title_hint ?? '');
    form.append('notebook_slug', request.notebook_slug ?? '');
    return {
      ok: true,
      headers: {},
      body: form,
    };
  }

  const text = request.text ?? '';
  if (!text.trim()) {
    return { ok: false, message: 'instant-kg input must be non-empty' };
  }

  return {
    ok: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: text,
      mode: request.mode,
      schema_constrained: request.schema_constrained ?? true,
      title_hint: request.title_hint ?? '',
      notebook_slug: request.notebook_slug ?? '',
    }),
  };
}
