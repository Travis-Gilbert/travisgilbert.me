import { callTheoremAgentEndpoint, normalizeTheoremAgentInput, normalizeTheoremAgentProductResponse, type TheoremAgentRunInput } from '@/lib/theorem-agent';

export const dynamic = 'force-dynamic';

const LOCAL_NODE_URL = 'http://127.0.0.1:17888';
const LOCAL_AGENT_URL = `${LOCAL_NODE_URL}/v1/theorem/agent/run`;
const HOSTED_AGENT_URL = 'https://rustyredcore-theorem-production.up.railway.app/v1/theorem/agent/run';

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
      message: timedOut ? 'Theorem agent timed out.' : 'Theorem agent backend unreachable.',
      attempts: errors,
    },
    timedOut ? 504 : 502,
  );
}

function upstreamCandidates(): string[] {
  const explicit = text(process.env.THEOREM_AGENT_API_URL ?? process.env.THEOREM_AGENT_URL ?? process.env.THEOREM_PRODUCT_API_URL ?? process.env.RUSTYRED_AGENT_URL ?? process.env.NEXT_PUBLIC_THEOREM_AGENT_API_URL);
  if (explicit) return [trimSlash(explicit)];
  return process.env.NODE_ENV === 'development' ? [LOCAL_AGENT_URL, HOSTED_AGENT_URL] : [HOSTED_AGENT_URL];
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

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
