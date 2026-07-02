import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '@/app/api/theorem/agent/route';

const AGENT_ENV = [
  'THEOREM_AGENT_ENDPOINT',
  'THEOREM_AGENT_API_URL',
  'THEOREM_AGENT_URL',
  'THEOREM_PRODUCT_API_URL',
  'THEOREM_API_URL',
  'THEOREM_HARNESS_URL',
  'THEOREMS_HARNESS_URL',
  'HARNESS_URL',
  'RUSTYRED_AGENT_URL',
  'NEXT_PUBLIC_THEOREM_AGENT_API_URL',
  'NEXT_PUBLIC_THEOREM_API_URL',
  'NEXT_PUBLIC_HARNESS_URL',
  'THEOREM_AGENT_API_TOKEN',
  'THEOREM_API_TOKEN',
  'THEOREM_AGENT_API_BEARER',
  'THEOREM_AGENT_BEARER',
  'RUSTYRED_AGENT_BEARER',
  'HARNESS_API_KEY',
  'THEOREM_AGENT_DIRECT_PROVIDER_FALLBACK',
  'THEOREM_ALLOW_DIRECT_PROVIDER_FALLBACK',
  'THEOREM_AGENT_HEADS',
  'THEOREM_AGENT_HEAD_DEEPSEEK_PROVIDER',
  'THEOREM_AGENT_HEAD_DEEPSEEK_MODEL',
  'THEOREM_AGENT_HEAD_DEEPSEEK_CREDENTIAL_REF',
  'DEEPSEEK_API_KEY',
  'DEEPSEEK_CHAT_URL',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_MODEL',
  'MISTRAL_API_KEY',
  'MISTRAL_CHAT_URL',
  'MISTRAL_BASE_URL',
  'MISTRAL_MODEL',
  'MINIMAX_API_KEY',
  'MINIMAX_CHAT_URL',
  'MINIMAX_BASE_URL',
  'MINIMAX_MODEL',
  'QWEN_API_KEY',
  'DASHSCOPE_API_KEY',
  'QWEN_CHAT_URL',
  'QWEN_BASE_URL',
  'QWEN_MODEL',
] as const;

describe('POST /api/theorem/agent', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(AGENT_ENV.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    for (const name of AGENT_ENV) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const name of AGENT_ENV) {
      restoreEnv(name, originalEnv[name]);
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    ['base URL', 'https://example.test', 'https://example.test/v1/theorem/agent/run'],
    [
      'path-prefixed base URL',
      'https://example.test/theorem',
      'https://example.test/theorem/v1/theorem/agent/run',
    ],
    ['GraphQL URL', 'https://example.test/graphql', 'https://example.test/v1/theorem/agent/run'],
    [
      'nested GraphQL URL',
      'https://example.test/theorem/graphql',
      'https://example.test/theorem/v1/theorem/agent/run',
    ],
    ['MCP URL', 'https://example.test/mcp/', 'https://example.test/v1/theorem/agent/run'],
    [
      'same-origin proxy URL',
      'https://example.test/api/theorem/agent',
      'https://example.test/v1/theorem/agent/run',
    ],
    [
      'agent-run URL',
      'https://example.test/v1/theorem/agent/run',
      'https://example.test/v1/theorem/agent/run',
    ],
  ])('normalizes %s to the product agent endpoint', async (_label, configuredUrl, expectedUrl) => {
    const calls: Array<{ url: string; body: unknown; authorization?: string | null }> = [];
    process.env.THEOREM_AGENT_URL = configuredUrl;
    process.env.THEOREM_AGENT_API_TOKEN = 'test-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
        authorization: headers.get('authorization'),
      });
      return new Response(JSON.stringify(agentPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Wire the Omnibar to the product agent.',
          tenant: 'Travis-Gilbert',
          bindingId: 'agent:theorem',
        }),
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(expectedUrl);
    expect(calls[0].authorization).toBe('Bearer test-token');
    expect(calls[0].body).toMatchObject({
      tenant: 'Travis-Gilbert',
      tenant_slug: 'Travis-Gilbert',
      binding_id: 'agent:theorem',
      task: 'Wire the Omnibar to the product agent.',
    });
    expect(body.answer).toBe('CommonPlace agent response');
  });

  it('normalizes a server-side harness URL to the product agent endpoint', async () => {
    const calls: string[] = [];
    process.env.THEOREM_HARNESS_URL = 'https://harness.example/mcp';
    process.env.HARNESS_API_KEY = 'harness-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify(agentPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Use the harness endpoint.',
          tenant: 'Travis-Gilbert',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual(['https://harness.example/v1/theorem/agent/run']);
  });

  it.each([
    ['missing task', {}],
    ['non-string task', { task: 12 }],
  ])('returns a clear request error for %s', async (_label, body) => {
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'invalid_agent_request',
      message: 'Theorem agent requires a task.',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['non-string tenant', { task: 'Run the agent.', tenant: 12 }, 'Theorem agent tenant must be a string.'],
    [
      'non-string bindingId',
      { task: 'Run the agent.', bindingId: 12 },
      'Theorem agent bindingId must be a string.',
    ],
  ])('returns a clear request error for %s', async (_label, body, message) => {
    globalThis.fetch = vi.fn() as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

    const payload = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      error: 'invalid_agent_request',
      message,
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('can answer directly from DeepSeek when only DEEPSEEK_API_KEY is configured', async () => {
    const calls: Array<{ url: string; body: unknown; authorization?: string | null }> = [];
    process.env.THEOREM_AGENT_DIRECT_PROVIDER_FALLBACK = '1';
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
        authorization: headers.get('authorization'),
      });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'DeepSeek is live from CommonPlace.' } }],
          usage: { prompt_tokens: 12, completion_tokens: 8 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Say hello from DeepSeek.',
          tenant: 'Travis-Gilbert',
          bindingId: 'agent:theorem',
        }),
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect(calls[0].authorization).toBe('Bearer deepseek-test-token');
    expect(calls[0].body).toMatchObject({
      model: 'deepseek-v4-pro',
      stream: false,
    });
    expect(body).toMatchObject({
      answer: 'DeepSeek is live from CommonPlace.',
      answerKind: 'MODEL',
      bindingId: 'agent:theorem',
      heads: ['deepseek'],
    });
  });

  it('can answer directly from Qwen-compatible DashScope when QWEN_API_KEY is configured', async () => {
    const calls: Array<{ url: string; body: unknown; authorization?: string | null }> = [];
    process.env.THEOREM_AGENT_DIRECT_PROVIDER_FALLBACK = '1';
    process.env.THEOREM_AGENT_HEADS = 'qwen';
    process.env.QWEN_API_KEY = 'qwen-test-token';
    process.env.QWEN_CHAT_URL = 'https://dashscope.test/compatible-mode/v1/chat/completions';
    process.env.QWEN_MODEL = 'qwen-max';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
        authorization: headers.get('authorization'),
      });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Qwen is live from CommonPlace.' } }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Say hello from Qwen.',
          tenant: 'Travis-Gilbert',
          bindingId: 'agent:theorem:qwen',
        }),
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://dashscope.test/compatible-mode/v1/chat/completions');
    expect(calls[0].authorization).toBe('Bearer qwen-test-token');
    expect(calls[0].body).toMatchObject({
      model: 'qwen-max',
      stream: false,
    });
    expect(body).toMatchObject({
      answer: 'Qwen is live from CommonPlace.',
      heads: ['qwen'],
    });
  });

  it('keeps direct provider keys disabled by default and uses harness defaults instead', async () => {
    const calls: string[] = [];
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify(agentPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Use the harness default, not raw provider keys.',
          tenant: 'Travis-Gilbert',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(calls).toEqual([
      'https://app.theoremharness.com/v1/theorem/agent/run',
    ]);
  });

  it('does not fall back to direct provider keys when a harness upstream is configured', async () => {
    const calls: string[] = [];
    process.env.THEOREM_AGENT_URL = 'https://harness.example/mcp';
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ message: 'harness unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Use the harness, not direct keys.',
          tenant: 'Travis-Gilbert',
        }),
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(502);
    expect(calls).toEqual(['https://harness.example/v1/theorem/agent/run']);
    expect(body).toMatchObject({
      error: 'theorem_agent_upstream_failed',
      attempts: ['https://harness.example/v1/theorem/agent/run: harness unavailable'],
    });
  });

  it('bounds stalled direct provider calls by the request timeout', async () => {
    vi.useFakeTimers();
    process.env.THEOREM_AGENT_DIRECT_PROVIDER_FALLBACK = '1';
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-token';
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted.');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }) as typeof fetch;

    const responsePromise = POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Do not hang the UI.',
          tenant: 'Travis-Gilbert',
          requestTimeoutMs: 5000,
        }),
      }),
    );

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);

    const response = await responsePromise;
    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(502);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(body).toMatchObject({
      error: 'theorem_agent_provider_failed',
    });
    expect(body.message).toContain('Theorem direct provider head failed.');
    expect(body.attempts).toEqual(['deepseek: deepseek timed out after 5000ms']);
  });

  it('skips explicit heads without keys and uses the first configured provider key', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    process.env.THEOREM_AGENT_DIRECT_PROVIDER_FALLBACK = '1';
    process.env.THEOREM_AGENT_HEADS = 'mistral,deepseek';
    process.env.DEEPSEEK_API_KEY = 'deepseek-test-token';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
      });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'DeepSeek handled the explicit head list.' } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const response = await POST(
      new Request('http://localhost/api/theorem/agent', {
        method: 'POST',
        body: JSON.stringify({
          task: 'Use whichever configured head can run.',
          tenant: 'Travis-Gilbert',
        }),
      }),
    );

    const body = (await response.json()) as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect(body).toMatchObject({
      answer: 'DeepSeek handled the explicit head list.',
      heads: ['deepseek'],
    });
  });
});

function agentPayload(): unknown {
  return {
    tenant: 'Travis-Gilbert',
    result: {
      binding_id: 'agent:theorem',
      run_id: 'run:test',
      published_claims: [],
      consensus_head_set: ['deepseek'],
      alignment_verdict: { allowed: true },
      invocation_receipts: [
        {
          invocation_id: 'invocation:test',
          head_id: 'deepseek',
          output_summary: 'provider summary',
          payload: { text: 'CommonPlace agent response' },
          claims: [],
          created_at: '2026-06-26T00:00:00Z',
        },
      ],
    },
  };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
