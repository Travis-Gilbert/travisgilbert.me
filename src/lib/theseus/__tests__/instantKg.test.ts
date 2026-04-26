import { describe, it, expect } from 'vitest';
import type {
  InstantKgStreamHandlers,
  InstantKgDocumentEvent,
  InstantKgChunkEvent,
  InstantKgCompleteEvent,
} from '../instantKg';

describe('InstantKg event shape parity with backend contract', () => {
  it('document event has fetch_provenance', () => {
    const evt: InstantKgDocumentEvent = {
      object_id: 1,
      title: 'Doc',
      url: 'https://example.com',
      object_type: 'source',
      color: '#C49A4A',
      fetch_provenance: { tier: 'tavily', tavily_credits_used: 1, fallback_reason: null },
    };
    expect(evt.fetch_provenance.tier).toBe('tavily');
  });

  it('chunk event includes part_of edge', () => {
    const evt: InstantKgChunkEvent = {
      chunk_id: 2,
      parent_object_id: 1,
      chunk_index: 0,
      text_preview: 'preview',
      edge: { source: 2, target: 1, edge_type: 'part_of', engine: 'instant_kg', reason: 'r' },
    };
    expect(evt.edge.edge_type).toBe('part_of');
  });

  it('handlers include onTensionProposed', () => {
    const handlers: Partial<InstantKgStreamHandlers> = {
      onTensionProposed: () => undefined,
    };
    expect(typeof handlers.onTensionProposed).toBe('function');
  });

  it('complete event carries camera and lens_target', () => {
    const evt: InstantKgCompleteEvent = {
      document_object_id: 1,
      focus: { pivot_object_id: 5, neighbors: [] },
      totals: {
        chunks: 2,
        entities: 3,
        relations: 1,
        cross_doc_edges: 0,
      },
      camera: {
        kind: 'waypoints',
        waypoints: [{ object_id: 5, duration_ms: 800 }],
      },
      lens_target: { object_id: 5, view: 'lens' },
    };
    expect(evt.camera.waypoints[0].object_id).toBe(5);
    expect(evt.lens_target.view).toBe('lens');
  });
});
