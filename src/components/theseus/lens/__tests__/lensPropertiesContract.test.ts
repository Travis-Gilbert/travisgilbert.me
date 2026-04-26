/**
 * Wire-shape parity test for the lens-properties endpoint.
 *
 * The backend canonical shape lives at
 * apps/notebook/views/_lens_helpers.py:build_properties_payload. The
 * frontend `PropertiesPayload` type in LensView.tsx is the consumer of
 * that shape. A drift between the two crashed every Lens activation
 * (`Object.entries(undefined)` on a phantom `properties` field) before
 * this test was added.
 *
 * The test constructs a literal that mirrors the backend payload byte
 * for byte; if anyone ever reverts the frontend type back to a
 * `properties: Record<...>` shape, this file fails to compile.
 */

import { describe, it, expect } from 'vitest';
import type { PropertiesPayload } from '../LensView';

describe('lens-properties wire shape parity', () => {
  it('accepts the canonical backend payload shape', () => {
    const payload: PropertiesPayload = {
      id: 42,
      title: 'Attention Head 7-3',
      summary: 'Pairs with head 6.1 around epoch 14.',
      kind: 'concept',
      source_system: 'instant_kg',
      evidence_count: 5,
      confidence: 0.84,
      kin_count: 3,
      anchoring_count: 2,
      context_count: 4,
      pinned_by: ['you', 'sara'],
      last_touched: '2026-04-26T12:30:00Z',
      claims: [
        { id: 1, text: 'Pairs with head 6.1.', confidence: 0.92 },
        { id: 2, text: 'Drops out by epoch 18.', confidence: null },
      ],
    };
    expect(payload.kin_count + payload.anchoring_count + payload.context_count).toBe(9);
    expect(payload.claims[0].confidence).toBe(0.92);
    expect(payload.claims[1].confidence).toBeNull();
  });

  it('honestly accepts empty pinned_by + null confidence', () => {
    // Backend ships empty array (not omitted) when no per-user pin
    // relation exists; ships null (not 0) when confidence is unset.
    // Test pins this contract so neither side accidentally normalizes.
    const payload: PropertiesPayload = {
      id: 1,
      title: 'Untouched',
      summary: '',
      kind: 'note',
      source_system: null,
      evidence_count: 0,
      confidence: null,
      kin_count: 0,
      anchoring_count: 0,
      context_count: 0,
      pinned_by: [],
      last_touched: null,
      claims: [],
    };
    expect(payload.confidence).toBeNull();
    expect(payload.pinned_by).toEqual([]);
    expect(payload.last_touched).toBeNull();
  });
});
