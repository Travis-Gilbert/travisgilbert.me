import { afterEach, describe, expect, it, vi } from 'vitest';

import { gqlTheoremAgent } from '@/lib/commonplace-graphql';
import { runTheoremAgent } from '@/lib/theorem-agent';

vi.mock('@/lib/commonplace-graphql', () => ({
  gqlTheoremAgent: vi.fn(),
}));

describe('runTheoremAgent', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('uses the product route before GraphQL for CommonPlace agent runs', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          result: {
            binding_id: 'agent:theorem:test',
            run_id: 'run:test',
            invocation_receipts: [
              {
                head_id: 'deepseek',
                payload: { text: 'Fallback route answered.' },
                claims: [],
              },
            ],
            consensus_head_set: ['deepseek'],
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;

    const result = await runTheoremAgent({
      task: 'Can DeepSeek answer from the Omnibar?',
      bindingId: 'agent:theorem:test',
    });

    expect(result.answer).toBe('Fallback route answered.');
    expect(result.heads).toEqual(['deepseek']);
    expect(gqlTheoremAgent).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/theorem/agent',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
      }),
    );
  });

  it('falls back to GraphQL when the product route proxy is unavailable', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }) as typeof fetch;
    vi.mocked(gqlTheoremAgent).mockResolvedValue({
      answer: 'GraphQL compatibility path answered.',
      answerKind: 'MODEL',
      bindingId: 'agent:theorem:graphql',
      runId: 'run:graphql',
      heads: ['desktop'],
      claims: [],
      evidenceCount: 0,
    });

    const result = await runTheoremAgent({
      task: 'Can the desktop compatibility path answer?',
      bindingId: 'agent:theorem:graphql',
    });

    expect(result.answer).toBe('GraphQL compatibility path answered.');
    expect(result.heads).toEqual(['desktop']);
    expect(gqlTheoremAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'Can the desktop compatibility path answer?',
        bindingId: 'agent:theorem:graphql',
      }),
      expect.any(AbortSignal),
    );
  });
});
