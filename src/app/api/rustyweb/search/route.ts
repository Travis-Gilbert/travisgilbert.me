import {
  buildRustyWebMcpRequest,
  normalizeRustyWebMcpResponse,
  type RustyWebSearchMode,
} from '@/lib/rustyweb-search';

export const dynamic = 'force-dynamic';

const LOCAL_MCP_URL = 'http://127.0.0.1:17888/mcp';
const HOSTED_MCP_URL = 'https://rustyredcore-theorem-production.up.railway.app/mcp';

interface SearchBody {
  query?: unknown;
  mode?: unknown;
  tenant?: unknown;
  limit?: unknown;
  providerLimit?: unknown;
  provider_limit?: unknown;
}

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
    10,
    1,
    50,
  );
  const mcpBody = buildRustyWebMcpRequest({
    query,
    mode,
    tenant,
    limit,
    providerLimit,
  });
  const errors: string[] = [];

  for (const upstream of upstreamCandidates()) {
    try {
      const res = await fetch(upstream, {
        method: 'POST',
        headers: mcpHeaders(),
        body: JSON.stringify(mcpBody),
        cache: 'no-store',
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
      errors.push(`${upstream}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return json(
    {
      error: 'rustyweb_unreachable',
      message: 'RustyWeb search backend unreachable.',
      attempts: errors,
    },
    502,
  );
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
    ? [LOCAL_MCP_URL, HOSTED_MCP_URL]
    : [HOSTED_MCP_URL];
}

function mcpHeaders(): HeadersInit {
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

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(n, max));
}
