import { describe, it, expect } from 'vitest';
import { fnvHash, computeLensLayout } from '../useLensLayout';
import type { EdgeTypeMeta } from '../edgeTypeMeta';

const meta = new Map<string, EdgeTypeMeta>([
  ['pairs', { slug: 'pairs', display_label: 'Pairs', epistemic_role: 'kin' }],
  ['mentions', { slug: 'mentions', display_label: 'Mentions', epistemic_role: 'context' }],
]);

describe('fnvHash', () => {
  it('is deterministic', () => {
    expect(fnvHash('abc')).toBe(fnvHash('abc'));
  });
  it('differs across inputs', () => {
    expect(fnvHash('abc')).not.toBe(fnvHash('xyz'));
  });
});

describe('computeLensLayout', () => {
  it('places focused node at (560, 340)', () => {
    const layout = computeLensLayout({
      focused: { id: 'f', kind: 'concept' },
      neighbors: [],
      edgeTypeMeta: meta,
    });
    expect(layout.focused.x).toBe(560);
    expect(layout.focused.y).toBe(340);
  });

  it('returns empty shells when no neighbors', () => {
    const layout = computeLensLayout({
      focused: { id: 'f', kind: 'concept' },
      neighbors: [],
      edgeTypeMeta: meta,
    });
    expect(layout.placed.length).toBe(0);
    expect(layout.emptyShells).toEqual(new Set(['inner', 'middle', 'outer']));
  });

  it('places kin concept on inner shell', () => {
    const layout = computeLensLayout({
      focused: { id: 'f', kind: 'concept' },
      neighbors: [
        { node: { id: 'n1', kind: 'concept' }, edgeType: 'pairs' },
      ],
      edgeTypeMeta: meta,
    });
    expect(layout.placed[0].shell).toBe('inner');
    // Inner shell base radius is 130 with deterministic FNV jitter of
    // up to +-14, so the radius should sit in [116, 144].
    expect(layout.placed[0].radius).toBeGreaterThanOrEqual(116);
    expect(layout.placed[0].radius).toBeLessThanOrEqual(144);
  });
});
