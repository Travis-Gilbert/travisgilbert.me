import { describe, it, expect } from 'vitest';
import { classifyShell } from '../classifyShell';
import type { EdgeTypeMeta } from '../edgeTypeMeta';

const meta = new Map<string, EdgeTypeMeta>([
  ['pairs', { slug: 'pairs', display_label: 'Pairs', epistemic_role: 'kin' }],
  ['mentions', { slug: 'mentions', display_label: 'Mentions', epistemic_role: 'context' }],
  ['part_of', { slug: 'part_of', display_label: 'Part Of', epistemic_role: 'structural' }],
]);

describe('classifyShell', () => {
  it('classifies kin + concept as inner', () => {
    expect(classifyShell({ id: '1', kind: 'concept' }, 'pairs', { id: '0', kind: 'concept' }, meta)).toBe('inner');
  });

  it('classifies kin + hunch as inner', () => {
    expect(classifyShell({ id: '2', kind: 'hunch' }, 'pairs', { id: '0', kind: 'concept' }, meta)).toBe('inner');
  });

  it('classifies source kind as middle', () => {
    expect(classifyShell({ id: '3', kind: 'source' }, 'mentions', { id: '0', kind: 'concept' }, meta)).toBe('middle');
  });

  it('classifies person as middle', () => {
    expect(classifyShell({ id: '4', kind: 'person' }, 'mentions', { id: '0', kind: 'concept' }, meta)).toBe('middle');
  });

  it('classifies script as middle', () => {
    expect(classifyShell({ id: '5', kind: 'script' }, 'mentions', { id: '0', kind: 'concept' }, meta)).toBe('middle');
  });

  it('classifies anything else as outer', () => {
    expect(classifyShell({ id: '6', kind: 'note' }, 'mentions', { id: '0', kind: 'concept' }, meta)).toBe('outer');
  });
});
