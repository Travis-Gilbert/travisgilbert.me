/**
 * Ask Theseus: types and API functions for the Q&A + training loop feature.
 *
 * Django handles retrieval and LM synthesis (Gemma 4B / Qwen / compose_engine).
 * Feedback signals flow back to Django for scorer training data.
 */

import { apiFetch } from '@/lib/commonplace-api';
import type { MapSection } from '@/lib/theseus-types';
import type {
  SavedMap,
  SavedMapListItem,
  SaveMapInput,
  MapRerunResult,
  MicroscopeInput,
} from '@/lib/map-types';

/* ─────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────── */

/** Full object shape with type-specific fields for polymorphic rendering. */
export interface AskRetrievalObject {
  id: number;
  slug: string;
  title: string;
  object_type_slug: string;
  object_type_color: string;
  body_preview: string;
  edge_count: number;
  /* Task fields */
  priority?: string;
  progress?: number;
  done?: boolean;
  subtasks?: Array<{ title: string; done: boolean }>;
  due_date?: string;
  project_name?: string;
  provenance?: string;
  /* Event fields */
  event_date?: string;
  event_time?: string;
  event_duration?: string;
  /* Source fields */
  author?: string;
  year?: string;
  /* Hunch fields */
  confidence?: string;
  /* Generic fields */
  fields?: Record<string, string>;
}

export interface AskRetrievalClaim {
  id: number;
  text: string;
  status: string;
  source_object_id: number;
}

export interface AskRetrievalResponse {
  question_id: string;
  retrieval: {
    objects: AskRetrievalObject[];
    claims: AskRetrievalClaim[];
    engines_used: string[];
  };
  /** LM-generated answer (Gemma 4B, Qwen, or compose_engine fallback). */
  answer: string;
  /** Which agent produced the answer: 'gemma4b', 'communicator', 'compose_engine', or 'none'. */
  answer_agent: string;
}

/** Map agent identifiers to human-readable display names. */
export const AGENT_DISPLAY_NAME: Record<string, string> = {
  gemma4b: 'Gemma 4B',
  communicator: 'Qwen 7B',
  compose_engine: 'Compose Engine',
  none: 'Retrieval Only',
};

export type AskFeedbackSignal = 'positive' | 'negative' | 'save';
export type ProblemSolvingSignal = 'not_helpful' | 'somewhat' | 'solved';

export interface AskSuggestion {
  text: string;
  type: 'question' | 'gap' | 'tension';
  source_id?: number;
}

export interface GraphWeatherData {
  headline: string;
  detail: string;
  edge_delta: number;
  object_delta: number;
  composite_iq: number;
  total_objects: number;
  total_edges: number;
  last_engine_run?: string;
}

/* ─────────────────────────────────────────────────
   API functions
   ───────────────────────────────────────────────── */

/** Submit a question to the Django retrieval pipeline. */
export async function submitQuestion(question: string): Promise<AskRetrievalResponse> {
  return apiFetch<AskRetrievalResponse>('/ask/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

/** Submit feedback on an answer (positive/negative/save). */
export async function submitFeedback(
  questionId: string,
  signal: AskFeedbackSignal,
  objectIds: number[],
): Promise<{ ok: boolean; saved_object_id?: number }> {
  return apiFetch<{ ok: boolean; saved_object_id?: number }>('/ask/feedback/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_id: questionId,
      signal,
      retrieved_object_ids: objectIds,
    }),
  });
}

const PROBLEM_SOLVING_TO_API: Record<ProblemSolvingSignal, { signal: string; discovery_signal: string }> = {
  solved:      { signal: 'positive', discovery_signal: 'solves_problem' },
  somewhat:    { signal: 'positive', discovery_signal: 'relevant' },
  not_helpful: { signal: 'negative', discovery_signal: 'obvious' },
};

/** Submit problem-solving outcome feedback on chain edges. */
export async function submitProblemSolvingFeedback(
  questionId: string,
  signal: ProblemSolvingSignal,
  objectIds: number[],
): Promise<{ ok: boolean; count?: number }> {
  const mapped = PROBLEM_SOLVING_TO_API[signal];
  return apiFetch<{ ok: boolean; count?: number }>('/ask/feedback/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_id: questionId,
      signal: mapped.signal,
      discovery_signal: mapped.discovery_signal,
      retrieved_object_ids: objectIds,
    }),
  });
}

/** Fetch the Graph Weather header data. */
export async function fetchGraphWeather(): Promise<GraphWeatherData> {
  return apiFetch<GraphWeatherData>('/graph-weather/');
}

/** Fetch gap-driven question suggestions. */
export async function fetchAskSuggestions(): Promise<AskSuggestion[]> {
  const data = await apiFetch<{ suggestions: AskSuggestion[] }>('/ask/suggestions/');
  return data.suggestions;
}

/* ─────────────────────────────────────────────────
   Daily Briefing
   ───────────────────────────────────────────────── */

export interface DailyBriefingResponse {
  question: string;
  retrieval: AskRetrievalResponse['retrieval'];
  generated_at: string;
}

/** Fetch today's proactive briefing. Generates one if none exists. */
export async function fetchDailyBriefing(): Promise<DailyBriefingResponse> {
  return apiFetch<DailyBriefingResponse>('/briefing/');
}

/* ─────────────────────────────────────────────────
   Maps (TMS-powered epistemic topology)
   ───────────────────────────────────────────────── */

/** Generate a map from a query (no save). */
export async function generateMap(
  query: string,
  notebookSlug?: string,
): Promise<MapSection> {
  const body: Record<string, unknown> = { query };
  if (notebookSlug) body.notebook_slug = notebookSlug;
  const data = await apiFetch<{ truth_map_data: MapSection }>(
    '/tms-map/generate/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return data.truth_map_data;
}

/** Generate a map from a graph region (microscope mode). */
export async function microscopeMap(
  input: MicroscopeInput,
): Promise<MapSection> {
  const data = await apiFetch<{ truth_map_data: MapSection }>(
    '/tms-map/microscope/',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
  return data.truth_map_data;
}

/** Save a map as a persistent artifact. */
export async function saveMap(
  input: SaveMapInput,
): Promise<SavedMap> {
  return apiFetch<SavedMap>('/tms-maps/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** List saved maps. */
export async function listMaps(params?: {
  page?: number;
  notebook_slug?: string;
}): Promise<{ results: SavedMapListItem[]; count: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.notebook_slug) searchParams.set('notebook', params.notebook_slug);
  const qs = searchParams.toString();
  return apiFetch<{ results: SavedMapListItem[]; count: number }>(
    `/tms-maps/${qs ? `?${qs}` : ''}`,
  );
}

/** Load a single saved map with full epistemic data. */
export async function loadMap(slug: string): Promise<SavedMap> {
  return apiFetch<SavedMap>(`/tms-maps/${slug}/`);
}

/** Re-run a saved map against current graph state. */
export async function rerunMap(
  slug: string,
): Promise<MapRerunResult> {
  return apiFetch<MapRerunResult>(`/tms-maps/${slug}/rerun/`, {
    method: 'POST',
  });
}

/** Soft-delete a saved map. */
export async function deleteMap(slug: string): Promise<void> {
  await apiFetch(`/tms-maps/${slug}/`, { method: 'DELETE' });
}
