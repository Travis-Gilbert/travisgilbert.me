/**
 * Client for the local commonplace-desktop-runtime control endpoint
 * (HANDOFF-CODE-SURFACE-UI backend seams). The runtime serves, on loopback
 * with device-pairing bearer auth:
 *   GET  /v1/runs/{id}/events   SSE: Trace | Obligation | Diff | Status
 *   POST /v1/pty                { workspace_root, cols, rows } -> { pty_id }
 *   GET  /v1/pty/{id}/ws        WebSocket: binary io + {"resize":{...}} frames
 *   DELETE /v1/pty/{id}
 *
 * Availability is a capability, not an assumption: every consumer renders
 * nothing (or a quiet line) when the runtime is unreachable, per the house
 * empty-state rule. Nothing here fabricates liveness.
 */

export interface RuntimeConfig {
  baseUrl: string;
  token: string;
}

const STORAGE_KEY = 'commonplace.runtime';

export function getRuntimeConfig(): RuntimeConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RuntimeConfig>;
    if (!parsed.baseUrl || !parsed.token) return null;
    return { baseUrl: parsed.baseUrl.replace(/\/$/, ''), token: parsed.token };
  } catch {
    return null;
  }
}

export function setRuntimeConfig(config: RuntimeConfig | null): void {
  if (typeof window === 'undefined') return;
  if (!config) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function probeRuntime(config = getRuntimeConfig()): Promise<boolean> {
  if (!config) return false;
  try {
    const res = await fetch(`${config.baseUrl}/v1/health`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type RuntimeRunEvent =
  | { kind: 'trace'; line: string; at: string }
  | { kind: 'diff'; path: string; added: number; removed: number; summary: string; at: string }
  | { kind: 'status'; state: string; detail?: string; at: string }
  | { kind: 'obligation'; label: string; at: string };

/**
 * Subscribe to a run's event stream. EventSource cannot send Authorization
 * headers, so this uses fetch + ReadableStream SSE parsing. Returns an abort
 * function. onDone fires when the stream ends or errors (stream end is the
 * runtime's signal, not a fabricated terminal state).
 */
export function subscribeRunEvents(
  runId: string,
  onEvent: (event: RuntimeRunEvent) => void,
  onDone: (error?: Error) => void,
  config = getRuntimeConfig(),
): () => void {
  if (!config) {
    onDone(new Error('runtime unavailable'));
    return () => {};
  }
  const controller = new AbortController();
  (async () => {
    try {
      const res = await fetch(`${config.baseUrl}/v1/runs/${encodeURIComponent(runId)}/events`, {
        headers: { Authorization: `Bearer ${config.token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`run events: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const data = frame
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
            .join('\n');
          if (!data) continue;
          const parsed = parseRunEvent(data);
          if (parsed) onEvent(parsed);
        }
      }
      onDone();
    } catch (error) {
      if (!controller.signal.aborted) onDone(error as Error);
      else onDone();
    }
  })();
  return () => controller.abort();
}

function parseRunEvent(data: string): RuntimeRunEvent | null {
  try {
    const raw = JSON.parse(data) as Record<string, unknown>;
    const at = typeof raw.at === 'string' ? raw.at : new Date().toISOString();
    const kind = String(raw.kind ?? raw.type ?? '').toLowerCase();
    if (kind === 'trace') return { kind: 'trace', line: String(raw.line ?? raw.detail ?? ''), at };
    if (kind === 'diff')
      return {
        kind: 'diff',
        path: String(raw.path ?? ''),
        added: Number(raw.added ?? 0),
        removed: Number(raw.removed ?? 0),
        summary: String(raw.summary ?? ''),
        at,
      };
    if (kind === 'status') return { kind: 'status', state: String(raw.state ?? ''), detail: stringOrUndefined(raw.detail), at };
    if (kind === 'obligation') return { kind: 'obligation', label: String(raw.label ?? ''), at };
    return null;
  } catch {
    return null;
  }
}

function stringOrUndefined(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export async function createPty(input: {
  workspaceRoot: string | null;
  cols: number;
  rows: number;
}): Promise<{ ptyId: string; socket: WebSocket } | null> {
  const config = getRuntimeConfig();
  if (!config) return null;
  const res = await fetch(`${config.baseUrl}/v1/pty`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspace_root: input.workspaceRoot, cols: input.cols, rows: input.rows }),
  });
  if (!res.ok) return null;
  const { pty_id: ptyId } = (await res.json()) as { pty_id: string };
  const wsBase = config.baseUrl.replace(/^http/, 'ws');
  // Browsers cannot set headers on WebSocket; the runtime accepts the pairing
  // token as a query parameter for the upgrade request.
  const socket = new WebSocket(`${wsBase}/v1/pty/${encodeURIComponent(ptyId)}/ws?token=${encodeURIComponent(config.token)}`);
  socket.binaryType = 'arraybuffer';
  return { ptyId, socket };
}

export function ptyResizeFrame(cols: number, rows: number): string {
  return JSON.stringify({ resize: { cols, rows } });
}

export async function killPty(ptyId: string): Promise<void> {
  const config = getRuntimeConfig();
  if (!config) return;
  await fetch(`${config.baseUrl}/v1/pty/${encodeURIComponent(ptyId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${config.token}` },
  }).catch(() => {});
}
