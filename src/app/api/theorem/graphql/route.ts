/**
 * Same-origin proxy to Theorem's commonplace-api GraphQL.
 *
 * The browser posts here (no CORS, no API key in the client bundle); this
 * handler forwards to the Theorem GraphQL endpoint with the server-side key.
 * On Vercel, set THEOREM_GRAPHQL_URL to the Railway commonplace-api URL and
 * THEOREM_API_KEY to its instance key (both server-only, never NEXT_PUBLIC).
 */

const configuredUpstream = process.env.THEOREM_GRAPHQL_URL?.trim();
const hasConfiguredUpstream = Boolean(configuredUpstream);
const UPSTREAM = (configuredUpstream || 'http://localhost:50090').replace(/\/+$/, '');
const API_KEY = process.env.THEOREM_API_KEY ?? 'dev-key';
const softFailLocalDefault =
  process.env.NODE_ENV === 'development' && !hasConfiguredUpstream;

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  try {
    const res = await fetch(`${UPSTREAM}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body,
      cache: 'no-store',
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    const status = softFailLocalDefault ? 200 : 502;
    return new Response(
      JSON.stringify({ errors: [{ message: 'Theorem GraphQL backend unreachable' }] }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
