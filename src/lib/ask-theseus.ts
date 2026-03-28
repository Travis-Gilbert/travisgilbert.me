/**
 * Ask Theseus: types and API functions for the Q&A + training loop feature.
 *
 * Django endpoints provide retrieval; Next.js API route handles LLM synthesis.
 * Feedback signals flow back to Django for scorer training data.
 */

import { apiFetch } from '@/lib/commonplace-api';

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
}

export interface AskSynthesisResponse {
  answer: string;
  referenced_object_ids: number[];
}

export type AskFeedbackSignal = 'positive' | 'negative' | 'save';

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

/** Call the Next.js API route that synthesizes an answer via Anthropic. */
export async function synthesizeAnswer(
  question: string,
  retrieval: AskRetrievalResponse['retrieval'],
): Promise<AskSynthesisResponse> {
  const res = await fetch('/api/ai/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, retrieval }),
  });
  if (!res.ok) {
    throw new Error(`Synthesis failed: ${res.status}`);
  }
  return res.json();
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
