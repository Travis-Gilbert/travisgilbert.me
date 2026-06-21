import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_GRAPHQL_URL = 'http://localhost:50090/graphql';

function commonplaceGraphqlUrl(): string {
  return (
    process.env.COMMONPLACE_GRAPHQL_URL
    ?? process.env.THEOREM_COMMONPLACE_GRAPHQL_URL
    ?? process.env.THEOREM_GATEWAY_COMMONPLACE_GRAPHQL_URL
    ?? DEFAULT_GRAPHQL_URL
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const apiKey = process.env.COMMONPLACE_API_KEY ?? process.env.THEOREM_COMMONPLACE_API_KEY ?? 'dev-key';

  const response = await fetch(commonplaceGraphqlUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body,
    cache: 'no-store',
  });

  const text = await response.text();
  return new NextResponse(text, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
