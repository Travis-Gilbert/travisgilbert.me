import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HARNESS_ENV = [
  'THEOREM_HARNESS_MCP_URL',
  'THEOREM_MCP_URL',
  'THEOREM_HARNESS_URL',
  'THEOREM_API_URL',
  'NEXT_PUBLIC_HARNESS_URL',
  'NEXT_PUBLIC_THEOREM_API_URL',
  'THEOREM_HARNESS_TENANT',
  'THEOREM_HARNESS_ROOM_ID',
  'THEOREM_HARNESS_MEMORY_QUERY',
  'THEOREM_HARNESS_ACTOR',
  'THEOREM_HARNESS_API_TOKEN',
  'THEOREM_MCP_API_TOKEN',
  'THEOREM_HARNESS_BEARER',
  'THEOREM_MCP_BEARER',
  'THEOREM_API_TOKEN',
  'THEOREM_AGENT_API_TOKEN',
  'RUSTYRED_AGENT_BEARER',
  'HARNESS_API_KEY',
] as const;

describe('GET /api/theorem/harness/summary', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(HARNESS_ENV.map((name) => [name, process.env[name]]));

  beforeEach(() => {
    vi.resetModules();
    for (const name of HARNESS_ENV) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    for (const name of HARNESS_ENV) {
      restoreEnv(name, originalEnv[name]);
    }
    vi.restoreAllMocks();
  });

  it('reads the configured MCP endpoint and returns compact live harness data', async () => {
    process.env.THEOREM_HARNESS_MCP_URL = 'https://example.test';
    process.env.THEOREM_HARNESS_API_TOKEN = 'harness-token';
    const calls: Array<{ url: string; body: Record<string, unknown>; authorization?: string | null }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        authorization: headers.get('authorization'),
      });
      return new Response(JSON.stringify(liveMcpPayload()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const { GET } = await import('@/app/api/theorem/harness/summary/route');
    const response = await GET(
      new Request('http://localhost/api/theorem/harness/summary?roomId=commonplace&query=CommonPlace'),
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://example.test/mcp');
    expect(calls[0].authorization).toBe('Bearer harness-token');
    expect(calls[0].body).toMatchObject({
      method: 'tools/call',
      params: {
        name: 'graphql_query',
        arguments: {
          variables: {
            actor: 'commonplace-ui',
            memoryQuery: 'CommonPlace',
            roomId: 'commonplace',
          },
        },
      },
    });
    expect(body).toMatchObject({
      source: 'live',
      tenant: 'Travis-Gilbert',
      roomId: 'commonplace',
      counts: {
        memory: 1,
        messages: 1,
        records: 1,
      },
      memory: [
        {
          id: 'theorem-vs-competitors-comparison-2026-07',
          title: 'Theorem vs competitors',
          servedTier: 'abstract',
        },
      ],
    });
    expect(body.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'record',
          summary: 'Claude finished the review.',
          actor: 'claude-code',
        }),
        expect.objectContaining({
          kind: 'message',
          summary: 'Codex is wiring the live surface.',
          actor: 'codex',
        }),
      ]),
    );
  });

  it('returns an unavailable summary when every MCP endpoint fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    }) as typeof fetch;

    const { GET } = await import('@/app/api/theorem/harness/summary/route');
    const response = await GET(new Request('http://localhost/api/theorem/harness/summary'));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      source: 'unavailable',
      tenant: 'Travis-Gilbert',
      roomId: 'commonplace',
      counts: {
        memory: 0,
        messages: 0,
        records: 0,
      },
      memory: [],
      activity: [],
    });
    expect(Array.isArray(body.attempts)).toBe(true);
  });
});

function liveMcpPayload(): unknown {
  return {
    jsonrpc: '2.0',
    id: 'test',
    result: {
      structuredContent: {
        data: {
          coordinationRoom: {
            roomId: 'commonplace',
            counts: {
              presence: 1,
              intents: 0,
              messages: 1,
              records: 1,
              pending_mentions: 0,
            },
            records: [
              {
                record_id: 'record-1',
                title: 'Coordination contribution',
                summary: 'Claude finished the review.',
                actor_id: 'claude-code',
                created_at: 'unix_ms:1782877640390',
              },
            ],
            messages: [
              {
                message_id: 'message-1',
                message: 'Codex is wiring the live surface.',
                actor: 'codex',
                created_at: 'unix_ms:1782877641390',
              },
            ],
            intents: [],
            pendingMentions: [],
            presence: [],
          },
          memory: [
            {
              id: 'theorem-vs-competitors-comparison-2026-07',
              kind: 'research_report',
              title: 'Theorem vs competitors',
              gist: 'Theorem has the best architecture.',
              servedTier: 'abstract',
              status: 'active',
              fitness: 0.52,
              updatedAt: 'unix_ms:1782877640390',
            },
          ],
        },
      },
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
