import { callTheoremAgentEndpoint, normalizeTheoremAgentInput, normalizeTheoremAgentProductResponse, type TheoremAgentRunInput } from '@/lib/theorem-agent';

export const dynamic = 'force-dynamic';

const LOCAL_NODE_URL = 'http://127.0.0.1:17888';
const LOCAL_AGENT_URL = `${LOCAL_NODE_URL}/v1/theorem/agent/run`;
const HOSTED_AGENT_URL = 'https://rustyredcore-theorem-production.up.railway.app/v1/theorem/agent/run';
const AGENT_RUN_PATH = '/v1/theorem/agent/run';

export async function POST(req: Request) {
  let body: TheoremAgentRunInput;
  try {
    body = (await req.json()) as TheoremAgentRunInput;
  } catch {
    return json({ error: 'invalid_json', message: 'Expected JSON body.' }, 400);
  }

  let input;
  try {
    input = normalizeTheoremAgentInput(body);
  } catch (err) {
    return json(
      {
        error: 'invalid_agent_request',
        message: err instanceof Error ? err.message : String(err),
      },
      400,
    );
  }

  const errors: string[] = [];
  let timedOut = false;

  for (const upstream of upstreamCandidates()) {
    try {
      const raw = await callTheoremAgentEndpoint(upstream, input, upstreamHeaders());
      return json(normalizeTheoremAgentProductResponse(raw, input), 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('timed out')) timedOut = true;
      errors.push(`${upstream}: ${message}`);
    }
  }

  return json(
    {
      error: timedOut ? 'theorem_agent_timeout' : 'theorem_agent_unreachable',
      message: timedOut
        ? `Theorem agent timed out. ${attemptSummary(errors)}`
        : `Theorem agent backend unreachable. ${attemptSummary(errors)}`,
      attempts: errors,
    },
    timedOut ? 504 : 502,
  );
}

function upstreamCandidates(): string[] {
  const configured = [
    process.env.THEOREM_AGENT_API_URL,
    process.env.THEOREM_AGENT_URL,
    process.env.THEOREM_PRODUCT_API_URL,
    process.env.RUSTYRED_AGENT_URL,
    process.env.NEXT_PUBLIC_THEOREM_AGENT_API_URL,
  ]
    .map(normalizeAgentEndpoint)
    .filter(nonNullable);
  const defaults =
    process.env.NODE_ENV === 'development'
      ? [LOCAL_AGENT_URL, HOSTED_AGENT_URL]
      : [HOSTED_AGENT_URL];
  return unique([...configured, ...defaults]);
}

function upstreamHeaders(): HeadersInit {
  const token = text(process.env.THEOREM_AGENT_API_BEARER ?? process.env.THEOREM_AGENT_BEARER ?? process.env.RUSTYRED_AGENT_BEARER ?? process.env.HARNESS_API_KEY);
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
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

function normalizeAgentEndpoint(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const pathname = trimSlash(url.pathname);
    if (!pathname || pathname === '/graphql') {
      url.pathname = AGENT_RUN_PATH;
      url.search = '';
      url.hash = '';
      return url.toString();
    }
    return trimSlash(url.toString());
  } catch {
    return trimSlash(raw);
  }
}

function attemptSummary(errors: string[]): string {
  if (!errors.length) return 'No upstream attempts were made.';
  return `First attempt: ${errors[0]}`;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function nonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
