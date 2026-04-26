/**
 * Unit tests for the shared `/api/v2/theseus/edge-types/` cache used
 * by both the GraphLegend (Stage 5 Task 5.13) and the Lens classify
 * shell (Stage 6 Task 6.4). Pin the dedup contract: concurrent calls
 * share one fetch; failures cache an empty Map (no retry storm); a
 * 200 OK populates the slug-keyed map.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadEdgeTypeMeta,
  getCachedEdgeTypeMeta,
  _resetEdgeTypeMetaForTest,
  type EdgeTypeMeta,
} from '../edgeTypeMeta';

const sampleRows: EdgeTypeMeta[] = [
  { slug: 'pairs', display_label: 'Pairs with', epistemic_role: 'kin' },
  { slug: 'interacts', display_label: 'Interacts with', epistemic_role: 'context' },
  { slug: 'cites', display_label: 'Cites', epistemic_role: 'anchoring' },
];

beforeEach(() => {
  _resetEdgeTypeMetaForTest();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadEdgeTypeMeta', () => {
  it('populates the cache with slug-keyed entries on 200 OK', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(sampleRows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const map = await loadEdgeTypeMeta();
    expect(fetchSpy).toHaveBeenCalledWith('/api/v2/theseus/edge-types/');
    expect(map.size).toBe(3);
    expect(map.get('pairs')?.display_label).toBe('Pairs with');
    expect(map.get('cites')?.epistemic_role).toBe('anchoring');
  });

  it('dedupes concurrent calls (one fetch, two awaits)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(sampleRows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const [a, b] = await Promise.all([loadEdgeTypeMeta(), loadEdgeTypeMeta()]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('returns an empty Map on a 4xx response (no retry storm)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not found', { status: 404 }),
    );
    const map = await loadEdgeTypeMeta();
    expect(map.size).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Subsequent calls must not refetch (the empty-Map cache hits).
    await loadEdgeTypeMeta();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns an empty Map when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const map = await loadEdgeTypeMeta();
    expect(map.size).toBe(0);
  });

  it('skips malformed rows missing a slug', async () => {
    const mixed = [
      { slug: 'pairs', display_label: 'Pairs', epistemic_role: 'kin' },
      // Missing slug; should be skipped.
      { display_label: 'Bad', epistemic_role: 'kin' },
      null,
    ] as unknown as EdgeTypeMeta[];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mixed), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const map = await loadEdgeTypeMeta();
    expect(map.size).toBe(1);
    expect(map.has('pairs')).toBe(true);
  });
});

describe('getCachedEdgeTypeMeta', () => {
  it('returns null before any fetch resolves', () => {
    expect(getCachedEdgeTypeMeta()).toBeNull();
  });

  it('returns the populated map after a successful load', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(sampleRows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await loadEdgeTypeMeta();
    const cached = getCachedEdgeTypeMeta();
    expect(cached).not.toBeNull();
    expect(cached?.size).toBe(3);
  });
});
