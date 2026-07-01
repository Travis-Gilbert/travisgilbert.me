import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WEBHOOK_ENV = [
  'THEOREM_GITHUB_WEBHOOK_UPSTREAM_URL',
  'THEOREM_HARNESS_GITHUB_WEBHOOK_URL',
  'THEOREM_HARNESS_HTTP_URL',
  'THEOREM_HARNESS_URL',
  'THEOREM_PRODUCT_API_URL',
  'THEOREM_API_URL',
  'RUSTYRED_THG_URL',
  'NEXT_PUBLIC_HARNESS_URL',
] as const;

describe('POST /github/webhook', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(WEBHOOK_ENV.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    vi.resetModules();
    for (const name of WEBHOOK_ENV) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const name of WEBHOOK_ENV) {
      restoreEnv(name, originalEnv[name]);
    }
    vi.restoreAllMocks();
  });

  it('forwards GitHub webhook headers and body to the configured upstream', async () => {
    process.env.THEOREM_GITHUB_WEBHOOK_UPSTREAM_URL = 'https://harness.example/github/webhook';
    const calls: Array<{
      url: string;
      body: string;
      contentType?: string | null;
      delivery?: string | null;
      event?: string | null;
      signature?: string | null;
      authorization?: string | null;
    }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        body: decodeBody(init?.body),
        contentType: headers.get('content-type'),
        delivery: headers.get('x-github-delivery'),
        event: headers.get('x-github-event'),
        signature: headers.get('x-hub-signature-256'),
        authorization: headers.get('authorization'),
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const { POST } = await import('@/app/github/webhook/route');
    const response = await POST(
      new Request('https://travisgilbert.me/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Delivery': 'delivery-test',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': 'sha256=test',
          Authorization: 'Bearer should-not-forward',
        },
        body: '{"repository":{"full_name":"owner/repo"}}',
      }),
    );
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(202);
    expect(payload).toEqual({ ok: true });
    expect(calls).toEqual([
      {
        url: 'https://harness.example/github/webhook',
        body: '{"repository":{"full_name":"owner/repo"}}',
        contentType: 'application/json',
        delivery: 'delivery-test',
        event: 'push',
        signature: 'sha256=test',
        authorization: null,
      },
    ]);
  });

  it('normalizes a harness base URL to the GitHub webhook endpoint', async () => {
    process.env.THEOREM_HARNESS_URL = 'https://harness.example/mcp/';
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const { POST } = await import('@/app/github/webhook/route');
    const response = await POST(githubRequest());

    expect(response.status).toBe(200);
    expect(calls).toEqual(['https://harness.example/github/webhook']);
  });

  it('returns 503 when the upstream is not configured', async () => {
    globalThis.fetch = vi.fn() as typeof fetch;

    const { POST } = await import('@/app/github/webhook/route');
    const response = await POST(githubRequest());
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      ok: false,
      error: 'theorem_github_webhook_upstream_unconfigured',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

function githubRequest(): Request {
  return new Request('https://travisgilbert.me/github/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Delivery': 'delivery-test',
      'X-GitHub-Event': 'push',
      'X-Hub-Signature-256': 'sha256=test',
    },
    body: '{"zen":true}',
  });
}

function decodeBody(body: BodyInit | null | undefined): string {
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  return typeof body === 'string' ? body : '';
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
