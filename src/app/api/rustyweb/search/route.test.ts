import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/rustyweb/search/route';

describe('POST /api/rustyweb/search', () => {
  const originalFetch = globalThis.fetch;
  const originalSearchEnv = {
    RUSTYWEB_SEARCH_URL: process.env.RUSTYWEB_SEARCH_URL,
    RUSTYRED_SEARCH_URL: process.env.RUSTYRED_SEARCH_URL,
    THEOREM_RUSTYWEB_SEARCH_URL: process.env.THEOREM_RUSTYWEB_SEARCH_URL,
  };

  beforeEach(() => {
    delete process.env.RUSTYWEB_SEARCH_URL;
    delete process.env.RUSTYRED_SEARCH_URL;
    delete process.env.THEOREM_RUSTYWEB_SEARCH_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv('RUSTYWEB_SEARCH_URL', originalSearchEnv.RUSTYWEB_SEARCH_URL);
    restoreEnv('RUSTYRED_SEARCH_URL', originalSearchEnv.RUSTYRED_SEARCH_URL);
    restoreEnv('THEOREM_RUSTYWEB_SEARCH_URL', originalSearchEnv.THEOREM_RUSTYWEB_SEARCH_URL);
    vi.restoreAllMocks();
  });

  it('routes normal web search through the RustyWeb product endpoint', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
      });
      return new Response(
        JSON.stringify({
          tenant: 'Travis-Gilbert',
          query: 'testing',
          mode: 'sync',
          acquisition: {
            query: 'testing',
            candidates: [],
            providers: [],
          },
          seed_urls: [],
          stats: {
            providers: 0,
            provider_receipts: 0,
            candidates: 0,
            seed_urls: 0,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/rustyweb/search', {
        method: 'POST',
        body: JSON.stringify({
          query: 'testing',
          mode: 'web',
          tenant: 'Travis-Gilbert',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://app.theoremharness.com/v1/rustyweb/search',
    );
    expect(calls[0].body).toMatchObject({
      query: 'testing',
      tenant: 'Travis-Gilbert',
      provider_limit: 4,
      provider_timeout_ms: 4_000,
      limit: 10,
      seed_limit: 10,
    });
    expect(calls[0].body).not.toHaveProperty('jsonrpc');
    expect(calls[0].body).not.toHaveProperty('params');
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
