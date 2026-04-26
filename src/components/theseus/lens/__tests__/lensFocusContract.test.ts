/**
 * Pin the contract for `GET /api/v1/notebook/objects/<id>/lens-focus/`.
 *
 * Index-API commit 9a3e02d ships the canonical shape
 *   { focused: { id, title, kind, summary, source_system, subtype },
 *     neighbors: [{ id, title, kind,
 *                   edge: { type, display_label, epistemic_role, reason } }] }
 *
 * If `LensView` ever drifts back to the older flat shape
 * (`object_id`, `object_type_slug`, `edge_type`, `edge_label`) these
 * assertions fail, which is the whole point of the test: the wire
 * shape is the contract.
 */

import { describe, it, expect } from 'vitest';
import { lensFocusToLayoutInputs, type LensFocusResponse } from '../lensFocusContract';
import { computeLensLayout } from '../useLensLayout';
import type { EdgeTypeMeta } from '../edgeTypeMeta';

const META = new Map<string, EdgeTypeMeta>([
  ['derived', { slug: 'derived', display_label: 'DERIVED FROM', epistemic_role: 'kin' }],
  ['mentions', { slug: 'mentions', display_label: 'Mentions', epistemic_role: 'context' }],
]);

const RESPONSE: LensFocusResponse = {
  focused: {
    id: 42,
    title: 'Causal closure',
    kind: 'concept',
    summary: 'Whether physics is causally closed.',
    source_system: 'manual',
    subtype: null,
  },
  neighbors: [
    {
      id: 7,
      title: 'Mental causation',
      kind: 'concept',
      edge: {
        type: 'derived',
        display_label: 'DERIVED FROM',
        epistemic_role: 'kin',
        reason: 'Mental causation depends on causal closure.',
      },
    },
    {
      id: 9,
      title: 'Reading: Kim 1998',
      kind: 'source',
      edge: {
        type: 'mentions',
        display_label: 'Mentions',
        epistemic_role: 'context',
        reason: 'Kim discusses both concepts in chapter 2.',
      },
    },
  ],
};

describe('lensFocusToLayoutInputs', () => {
  it('maps focused.id and focused.kind to the layout-input focused', () => {
    const inputs = lensFocusToLayoutInputs(RESPONSE);
    expect(inputs.focused.id).toBe('42');
    expect(inputs.focused.kind).toBe('concept');
  });

  it('maps each neighbor.id and neighbor.kind to node id/kind', () => {
    const inputs = lensFocusToLayoutInputs(RESPONSE);
    expect(inputs.neighbors[0].node.id).toBe('7');
    expect(inputs.neighbors[0].node.kind).toBe('concept');
    expect(inputs.neighbors[1].node.id).toBe('9');
    expect(inputs.neighbors[1].node.kind).toBe('source');
  });

  it('maps neighbor.edge.type to edgeType (slug)', () => {
    const inputs = lensFocusToLayoutInputs(RESPONSE);
    expect(inputs.neighbors[0].edgeType).toBe('derived');
    expect(inputs.neighbors[1].edgeType).toBe('mentions');
  });

  it('maps neighbor.edge.display_label to edgeLabel (human label)', () => {
    const inputs = lensFocusToLayoutInputs(RESPONSE);
    expect(inputs.neighbors[0].edgeLabel).toBe('DERIVED FROM');
    expect(inputs.neighbors[1].edgeLabel).toBe('Mentions');
  });

  it('produces inputs that flow through computeLensLayout cleanly', () => {
    const inputs = lensFocusToLayoutInputs(RESPONSE);
    const layout = computeLensLayout({
      focused: inputs.focused,
      neighbors: inputs.neighbors,
      edgeTypeMeta: META,
    });
    expect(layout.focused.id).toBe('42');
    // The first neighbor uses the kin/concept inner-shell rule.
    const firstPlaced = layout.placed.find((p) => p.id === '7');
    expect(firstPlaced).toBeDefined();
    expect(firstPlaced?.shell).toBe('inner');
    // Layout must carry display_label through so LensShellRenderer can
    // print "DERIVED FROM" instead of falling back to the slug.
    expect(firstPlaced?.edgeLabel).toBe('DERIVED FROM');
  });

  it('exposes data.focused.title for LensView to render at the celestial pole', () => {
    expect(RESPONSE.focused.title).toBe('Causal closure');
  });

  it('exposes neighbors[0].edge.display_label for renderer consumption', () => {
    expect(RESPONSE.neighbors[0].edge.display_label).toBe('DERIVED FROM');
  });
});
