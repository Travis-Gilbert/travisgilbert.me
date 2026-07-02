import {
  buildRustyWebMcpRequest,
  buildRustyWebSearchRequest,
  normalizeRustyWebMcpResponse,
  normalizeRustyWebProductResponse,
  type RustyWebSearchMode,
} from '@/lib/rustyweb-search';
import { THEOREM_HARNESS_MCP_URL, THEOREM_HARNESS_RUSTYWEB_SEARCH_URL } from '@/lib/theorem-hosted';

export const dynamic = 'force-dynamic';

const LOCAL_NODE_URL = 'http://127.0.0.1:17888';
const LOCAL_MCP_URL = `${LOCAL_NODE_URL}/mcp`;
const LOCAL_RUSTYWEB_SEARCH_URL = `${LOCAL_NODE_URL}/v1/rustyweb/search`;

interface SearchBody {
  query?: unknown;
  mode?: unknown;
  tenant?: unknown;
  limit?: unknown;
  providerLimit?: unknown;
  provider_limit?: unknown;
  providerTimeoutMs?: unknown;
  provider_timeout_ms?: unknown;
  requestTimeoutMs?: unknown;
  request_timeout_ms?: unknown;
}

const DEFAULT_WEB_PROVIDER_TIMEOUT_MS = 4_000;
const DEFAULT_FRACTAL_PROVIDER_TIMEOUT_MS = 8_000;

export async function POST(req: Request) {
  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    return json({ error: 'invalid_json', message: 'Expected JSON body.' }, 400);
  }

  const query = text(body.query);
  if (!query) {
    return json(
      { error: 'missing_query', message: 'RustyWeb search requires query.' },
      400,
    );
  }

  const mode: RustyWebSearchMode = body.mode === 'fractal' ? 'fractal' : 'web';
  const tenant = text(body.tenant) ?? 'Travis-Gilbert';
  const limit = clampNumber(body.limit, 10, 1, 20);
  const providerLimit = clampNumber(
    body.providerLimit ?? body.provider_limit,
    mode === 'web' ? 4 : 8,
    1,
    50,
  );
  const providerTimeoutMs = clampNumber(
    body.providerTimeoutMs ?? body.provider_timeout_ms,
    mode === 'web' ? DEFAULT_WEB_PROVIDER_TIMEOUT_MS : DEFAULT_FRACTAL_PROVIDER_TIMEOUT_MS,
    500,
    30_000,
  );
  const requestTimeoutMs = clampNumber(
    body.requestTimeoutMs ?? body.request_timeout_ms,
    Math.max(providerTimeoutMs + 4_000, 8_000),
    2_000,
    60_000,
  );
  const requestInput = {
    query,
    mode,
    tenant,
    limit,
    providerLimit,
    providerTimeoutMs,
    requestTimeoutMs,
  };

  if (mode === 'web') {
    const searchBody = buildRustyWebSearchRequest(requestInput);
    const errors: string[] = [];
    let timedOut = false;

    for (const upstream of rustyWebSearchCandidates()) {
      const requestTimeout = timeoutController(requestTimeoutMs);
      try {
        const res = await fetch(upstream, {
          method: 'POST',
          headers: upstreamHeaders(),
          body: JSON.stringify(searchBody),
          cache: 'no-store',
          signal: requestTimeout.signal,
        });
        if (!res.ok) {
          errors.push(`${upstream}: HTTP ${res.status}`);
          continue;
        }
        const raw = (await res.json()) as unknown;
        try {
          return json(normalizeRustyWebProductResponse(mode, raw), 200);
        } catch (err) {
          return json(
            {
              error: 'rustyweb_search_error',
              message: err instanceof Error ? err.message : String(err),
            },
            424,
          );
        }
      } catch (err) {
        if (isAbortError(err)) {
          timedOut = true;
          errors.push(`${upstream}: timed out after ${requestTimeoutMs}ms`);
        } else {
          errors.push(`${upstream}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        requestTimeout.clear();
      }
    }

    return json(
      {
        error: timedOut ? 'rustyweb_timeout' : 'rustyweb_unreachable',
        message: timedOut
          ? 'RustyWeb search backend timed out.'
          : 'RustyWeb search backend unreachable.',
        attempts: errors,
      },
      timedOut ? 504 : 502,
    );
  }

  const mcpBody = buildRustyWebMcpRequest(requestInput);
  const errors: string[] = [];
  let timedOut = false;

  for (const upstream of upstreamCandidates()) {
    const requestTimeout = timeoutController(requestTimeoutMs);
    try {
      const res = await fetch(upstream, {
        method: 'POST',
        headers: upstreamHeaders(),
        body: JSON.stringify(mcpBody),
        cache: 'no-store',
        signal: requestTimeout.signal,
      });
      if (!res.ok) {
        errors.push(`${upstream}: HTTP ${res.status}`);
        continue;
      }
      const raw = (await res.json()) as unknown;
      try {
        return json(normalizeRustyWebMcpResponse(mode, raw), 200);
      } catch (err) {
        return json(
          {
            error: 'rustyweb_tool_error',
            message: err instanceof Error ? err.message : String(err),
          },
          424,
        );
      }
    } catch (err) {
      if (isAbortError(err)) {
        timedOut = true;
        errors.push(`${upstream}: timed out after ${requestTimeoutMs}ms`);
      } else {
        errors.push(`${upstream}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      requestTimeout.clear();
    }
  }

  return json(
    {
      error: timedOut ? 'rustyweb_timeout' : 'rustyweb_unreachable',
      message: timedOut
        ? 'RustyWeb search backend timed out.'
        : 'RustyWeb search backend unreachable.',
      attempts: errors,
    },
    timedOut ? 504 : 502,
  );
}

function rustyWebSearchCandidates(): string[] {
  const explicit = text(
    process.env.RUSTYWEB_SEARCH_URL ??
      process.env.RUSTYRED_SEARCH_URL ??
      process.env.THEOREM_RUSTYWEB_SEARCH_URL,
  );
  if (explicit) return [trimSlash(explicit)];
  return process.env.NODE_ENV === 'development'
    ? [LOCAL_RUSTYWEB_SEARCH_URL, THEOREM_HARNESS_RUSTYWEB_SEARCH_URL]
    : [THEOREM_HARNESS_RUSTYWEB_SEARCH_URL];
}

function upstreamCandidates(): string[] {
  const explicit = text(
    process.env.RUSTYWEB_MCP_URL ??
      process.env.RUSTYRED_MCP_URL ??
      process.env.THEOREM_MCP_URL ??
      process.env.NEXT_PUBLIC_THEOREM_HARNESS_MCP_URL,
  );
  if (explicit) return [trimSlash(explicit)];
  return process.env.NODE_ENV === 'development'
    ? [LOCAL_MCP_URL, THEOREM_HARNESS_MCP_URL]
    : [THEOREM_HARNESS_MCP_URL];
}

function upstreamHeaders(): HeadersInit {
  const token = text(
    process.env.RUSTYWEB_MCP_BEARER ??
      process.env.RUSTYRED_MCP_BEARER ??
      process.env.THEOREM_MCP_BEARER ??
      process.env.HARNESS_API_KEY,
  );
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

function json(value: unknown, status: number): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function timeoutController(timeoutMs: number): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(n, max));
}
