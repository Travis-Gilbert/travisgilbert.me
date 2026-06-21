/**
 * Same-origin proxy to the Theorem gateway GraphQL (the browser-facing front
 * door that federates the substrate over gRPC: search/gapWalk/provenance/
 * askAgent/code/scene). The browser posts here (no CORS); this forwards to the
 * gateway. The gateway is public + rate-limited per IP, so no key is attached.
 *
 * Configure THEOREM_GATEWAY_URL on Vercel to point at the deployed gateway.
 */

const UPSTREAM = (
  process.env.THEOREM_GATEWAY_URL ?? 'https://theorem-gateway-production.up.railway.app'
).replace(/\/+$/, '');

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.text();
  try {
    const res = await fetch(`${UPSTREAM}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      JSON.stringify({ errors: [{ message: 'Theorem gateway unreachable' }] }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
