import { describe, expect, it } from 'vitest';

import { buildRustyWebMcpRequest } from '@/lib/rustyweb-search';

interface McpToolRequest {
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

function mcpToolRequest(value: unknown): McpToolRequest {
  return value as McpToolRequest;
}

describe('buildRustyWebMcpRequest', () => {
  it('builds bounded normal web search acquisition requests', () => {
    const request = mcpToolRequest(
      buildRustyWebMcpRequest({
        query: 'testing',
        mode: 'web',
        tenant: 'Travis-Gilbert',
        limit: 12,
        providerLimit: 4,
        providerTimeoutMs: 4_000,
        requestTimeoutMs: 8_000,
      }),
    );

    expect(request.params.name).toBe('rustyweb_search_acquisition');
    expect(request.params.arguments).toMatchObject({
      query: 'testing',
      tenant: 'Travis-Gilbert',
      provider_limit: 4,
      provider_timeout_ms: 4_000,
      wait: true,
      limit: 12,
      seed_limit: 12,
    });
    expect(request.params.arguments.requestTimeoutMs).toBeUndefined();
  });

  it('keeps fractal expansion on the graph-to-web tool', () => {
    const request = mcpToolRequest(
      buildRustyWebMcpRequest({
        query: 'testing',
        mode: 'fractal',
        tenant: 'Travis-Gilbert',
        limit: 8,
        providerLimit: 8,
        providerTimeoutMs: 8_000,
        requestTimeoutMs: 12_000,
      }),
    );

    expect(request.params.name).toBe('fractal_expansion');
    expect(request.params.arguments).toMatchObject({
      query: 'testing',
      tenant: 'Travis-Gilbert',
      provider_limit: 8,
      provider_timeout_ms: 8_000,
      wait: true,
      search_limit: 8,
      web_seed_limit: 8,
    });
  });
});
