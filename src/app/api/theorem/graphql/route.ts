/**
 * Same-origin proxy to Theorem's commonplace-api GraphQL.
 *
 * The browser posts here (no CORS, no API key in the client bundle); this
 * handler forwards to the Theorem GraphQL endpoint with the server-side key.
 * On Vercel, set THEOREM_GRAPHQL_URL to the Railway commonplace-api URL and
 * THEOREM_API_KEY to its instance key (both server-only, never NEXT_PUBLIC).
 */

const UPSTREAM = (process.env.THEOREM_GRAPHQL_URL ?? 'http://localhost:50090').replace(
  /\/+$/,
  '',
);
const API_KEY = process.env.THEOREM_API_KEY ?? 'dev-key';

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
    return new Response(
      JSON.stringify({ errors: [{ message: 'Theorem GraphQL backend unreachable' }] }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
