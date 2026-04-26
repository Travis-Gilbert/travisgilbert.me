/**
 * Capture API client: file upload, text/URL capture, batch upload, status polling.
 *
 * Uses raw fetch (not apiFetch) because multipart/form-data uploads
 * must not have Content-Type set manually (browser sets boundary).
 */

import { API_BASE } from '@/lib/commonplace';
import type { InstantKgStreamHandlers } from '@/lib/theseus/instantKg';
import { startInstantKgStream } from '@/lib/theseus/instantKg';

/* ─────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────── */

export interface CaptureResult {
  object: {
    id: number;
    slug: string;
    title: string;
    body_preview?: string;
    object_type_slug?: string;
  };
  artifact_id: string;
  inferred_type: string;
  creation_node: Record<string, unknown>;
  engine_job_id: string;
}

export interface BatchResult {
  batch_id: string;
  task_id: string;
  file_count: number;
  status: string;
}

export interface BatchStatus {
  status: 'processing' | 'complete' | 'failed';
  total_files: number;
  processed_files: number;
  objects_created: number;
  failed_files: number;
}

export interface CaptureError {
  ok: false;
  error: string;
}

type CaptureResponse = (CaptureResult & { ok: true }) | CaptureError;
type BatchResponse = (BatchResult & { ok: true }) | CaptureError;
type BatchStatusResponse = (BatchStatus & { ok: true }) | CaptureError;

/* ─────────────────────────────────────────────────
   Auth header (mirrors commonplace-api.ts pattern)
   ───────────────────────────────────────────────── */

function authHeader(): Record<string, string> {
  const token =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_COMMONPLACE_API_TOKEN
      : undefined;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ─────────────────────────────────────────────────
   Single file capture
   ───────────────────────────────────────────────── */

export async function captureFile(
  file: File,
  options?: { title?: string; hintType?: string; notebookSlug?: string },
): Promise<CaptureResponse> {
  try {
    const form = new FormData();
    form.append('file', file);
    if (options?.title) form.append('title', options.title);
    if (options?.hintType) form.append('hint_type', options.hintType);
    if (options?.notebookSlug) form.append('notebook_slug', options.notebookSlug);

    const res = await fetch(`${API_BASE}/capture/`, {
      method: 'POST',
      headers: authHeader(),
      body: form,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.detail ?? `Upload failed (${res.status})` };
    }

    const data: CaptureResult = await res.json();
    return { ...data, ok: true };
  } catch {
    return { ok: false, error: 'Network error during file upload' };
  }
}

/* ─────────────────────────────────────────────────
   Text / URL capture
   ───────────────────────────────────────────────── */

export async function captureText(
  content: string,
  options?: { title?: string; hintType?: string },
): Promise<CaptureResponse> {
  try {
    const res = await fetch(`${API_BASE}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        content,
        title: options?.title,
        hint_type: options?.hintType,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.detail ?? `Capture failed (${res.status})` };
    }

    const data: CaptureResult = await res.json();
    return { ...data, ok: true };
  } catch {
    return { ok: false, error: 'Network error during text capture' };
  }
}

/* ─────────────────────────────────────────────────
   Batch file upload
   ───────────────────────────────────────────────── */

export async function captureBatch(
  files: File[],
  notebookSlug?: string,
): Promise<BatchResponse> {
  try {
    const form = new FormData();
    for (const file of files) {
      form.append('files', file);
    }
    if (notebookSlug) form.append('notebook_slug', notebookSlug);

    const res = await fetch(`${API_BASE}/ingest-batch/`, {
      method: 'POST',
      headers: authHeader(),
      body: form,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.detail ?? `Batch upload failed (${res.status})` };
    }

    const data: BatchResult = await res.json();
    return { ...data, ok: true };
  } catch {
    return { ok: false, error: 'Network error during batch upload' };
  }
}

/* ─────────────────────────────────────────────────
   Batch status polling
   ───────────────────────────────────────────────── */

export async function pollBatchStatus(taskId: string): Promise<BatchStatusResponse> {
  try {
    const res = await fetch(`${API_BASE}/batch-status/${taskId}/`, {
      headers: { ...authHeader() },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.detail ?? `Status check failed (${res.status})` };
    }

    const data: BatchStatus = await res.json();
    return { ...data, ok: true };
  } catch {
    return { ok: false, error: 'Network error during status poll' };
  }
}

/* ─────────────────────────────────────────────────
   Instant-KG SSE client
   ───────────────────────────────────────────────── */

export interface InstantKgRequest {
  input: string;
  kind: 'url' | 'youtube' | 'file' | 'text';
  files?: File[];
  relationConfidenceFloor?: number;
}

/**
 * POST to the instant-KG enqueue endpoint and attach an EventSource to
 * the returned stream URL. Multipart branch is taken when `files` is
 * non-empty; JSON branch otherwise. Returns the job_id and a close
 * handle so callers can unsubscribe before the SSE stream completes.
 */
export async function streamInstantKg(
  req: InstantKgRequest,
  handlers: InstantKgStreamHandlers,
): Promise<{ jobId: string; close: () => void }> {
  const endpoint = '/api/v2/theseus/capture/instant-kg/';

  let response: Response;
  if (req.files && req.files.length > 0) {
    const formData = new FormData();
    formData.append('kind', req.kind);
    formData.append('input', req.input || '');
    if (req.relationConfidenceFloor != null) {
      formData.append('relation_confidence_floor', String(req.relationConfidenceFloor));
    }
    for (const f of req.files) {
      formData.append('file', f);
    }
    response = await fetch(endpoint, { method: 'POST', body: formData });
  } else {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: req.input,
        kind: req.kind,
        relation_confidence_floor: req.relationConfidenceFloor,
      }),
    });
  }

  if (!response.ok) {
    throw new Error(`instant-kg POST failed: ${response.status}`);
  }
  const body = (await response.json()) as { job_id: string; stream_url: string };
  const close = startInstantKgStream(body.stream_url, handlers);
  return { jobId: body.job_id, close };
}
