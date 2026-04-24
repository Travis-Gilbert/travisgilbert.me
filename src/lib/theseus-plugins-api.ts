/**
 * Typed client for the SPEC-C plugin runtime at `/api/v2/plugins/*`.
 *
 * All endpoints are served by the Index-API Django backend; in this
 * Next.js app we go through the rewrite at `next.config.ts`, so the
 * browser stays same-origin and no env var is needed.
 *
 * The endpoint surface mirrors `apps/plugins/api.py` in the Index-API
 * repo — see the shipped runtime guide at
 * https://github.com/Travis-Gilbert/Index-API/blob/main/docs/runtime/plugin-runtime-guide.md
 */

const BASE = '/api/v2/plugins';

export type PluginCategory =
  | 'connector'
  | 'scorer'
  | 'verb'
  | 'surface'
  | 'theorem';

export type PluginState =
  | 'discovered'
  | 'enabled'
  | 'disabled'
  | 'failing'
  | 'quarantined';

export type PluginRunStatus =
  | 'ok'
  | 'error'
  | 'timeout'
  | 'resource_exceeded'
  | 'capability_denied';

export interface PluginHealthLevel {
  level: 'ok' | 'degraded' | 'failing';
  message: string;
  checked_at?: string | null;
}

export interface PluginManifestEntry {
  slug: string;
  category: PluginCategory;
  version: string;
  description: string;
  capabilities: string[];
  state: PluginState;
  health: PluginHealthLevel | null;
  installed_at: string | null;
}

export interface PluginHealthEntry {
  slug: string;
  status: PluginHealthLevel;
  recent_error_rate: number;
  recent_runs: number;
}

export interface PluginRunSummary {
  plugin_slug: string;
  method: string;
  invoked_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: PluginRunStatus;
  error_message: string | null;
  input_hash: string;
  capability_used: string | null;
}

export interface RunnerCapabilities {
  mechanism: string;
  cgroups_available: boolean;
  memory_limit_enforced: boolean;
  cpu_limit_enforced: boolean;
  wall_clock_limit_enforced: boolean;
  default_memory_mb: number;
  default_wall_clock_s: number;
}

export interface LifecycleTransitionResult {
  slug: string;
  state: string;
  state_reason: string;
}

/**
 * Error thrown on non-2xx responses. ``fromState`` / ``toState`` are
 * populated for 409 lifecycle conflicts so the UI can show the
 * specific transition that was rejected.
 */
export class PluginsApiError extends Error {
  status: number;
  body: unknown;
  fromState?: string;
  toState?: string;
  network: boolean;

  constructor(
    status: number,
    message: string,
    body: unknown = null,
    network = false,
  ) {
    super(message);
    this.status = status;
    this.body = body;
    this.network = network;
    if (body && typeof body === 'object') {
      const rec = body as Record<string, unknown>;
      if (typeof rec.from_state === 'string') this.fromState = rec.from_state;
      if (typeof rec.to_state === 'string') this.toState = rec.to_state;
    }
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      cache: 'no-store',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch (err) {
    throw new PluginsApiError(
      0,
      'Network error: could not reach the plugin runtime',
      err,
      true,
    );
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore — non-JSON error body, leave as null
    }
    const rec = (body ?? {}) as Record<string, unknown>;
    const message =
      (typeof rec.error === 'string' && rec.error) ||
      (typeof rec.detail === 'string' && rec.detail) ||
      `Plugin runtime error ${res.status}`;
    throw new PluginsApiError(res.status, message, body);
  }
  return (await res.json()) as T;
}

// Every Index-API v2 Ninja route is registered with a trailing slash;
// requests without one resolve to Django's 404. Keep all paths ending in '/'.

/** GET /api/v2/plugins/manifest/ — every known plugin. */
export function fetchPluginsManifest(): Promise<PluginManifestEntry[]> {
  return request<PluginManifestEntry[]>('/manifest/');
}

/** GET /api/v2/plugins/{slug}/. */
export function fetchPluginDetail(
  slug: string,
): Promise<PluginManifestEntry> {
  return request<PluginManifestEntry>(`/${encodeURIComponent(slug)}/`);
}

/** GET /api/v2/plugins/health/ — aggregated health report. */
export function fetchPluginHealth(): Promise<PluginHealthEntry[]> {
  return request<PluginHealthEntry[]>('/health/');
}

/** GET /api/v2/plugins/capabilities/ — runner isolation guarantees. */
export function fetchRunnerCapabilities(): Promise<RunnerCapabilities> {
  return request<RunnerCapabilities>('/capabilities/');
}

/** GET /api/v2/plugins/{slug}/runs/?limit=N. */
export function fetchPluginRuns(
  slug: string,
  limit = 25,
): Promise<PluginRunSummary[]> {
  const q = `?limit=${encodeURIComponent(String(limit))}`;
  return request<PluginRunSummary[]>(
    `/${encodeURIComponent(slug)}/runs/${q}`,
  );
}

/** POST /api/v2/plugins/{slug}/enable/. */
export function enablePlugin(
  slug: string,
): Promise<LifecycleTransitionResult> {
  return request<LifecycleTransitionResult>(
    `/${encodeURIComponent(slug)}/enable/`,
    { method: 'POST' },
  );
}

/** POST /api/v2/plugins/{slug}/disable/. */
export function disablePlugin(
  slug: string,
): Promise<LifecycleTransitionResult> {
  return request<LifecycleTransitionResult>(
    `/${encodeURIComponent(slug)}/disable/`,
    { method: 'POST' },
  );
}

/** POST /api/v2/plugins/{slug}/rehabilitate/. */
export function rehabilitatePlugin(
  slug: string,
): Promise<LifecycleTransitionResult> {
  return request<LifecycleTransitionResult>(
    `/${encodeURIComponent(slug)}/rehabilitate/`,
    { method: 'POST' },
  );
}

/** POST /api/v2/plugins/{slug}/uninstall/. */
export function uninstallPlugin(
  slug: string,
): Promise<LifecycleTransitionResult> {
  return request<LifecycleTransitionResult>(
    `/${encodeURIComponent(slug)}/uninstall/`,
    { method: 'POST' },
  );
}

/**
 * Convenience label for a `PluginState`. UI chips use the title-cased
 * form, but the underlying string stays the source of truth.
 */
export function pluginStateLabel(state: PluginState): string {
  switch (state) {
    case 'discovered':
      return 'Discovered';
    case 'enabled':
      return 'Enabled';
    case 'disabled':
      return 'Disabled';
    case 'failing':
      return 'Failing';
    case 'quarantined':
      return 'Quarantined';
  }
}
