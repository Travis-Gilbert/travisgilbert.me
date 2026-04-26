import { describe, it, expect } from 'vitest';
import type {
  InstantKgStreamHandlers,
  InstantKgDocumentEvent,
  InstantKgChunkEvent,
  InstantKgEntityEvent,
  InstantKgRelationEvent,
  InstantKgCrossDocEvent,
  InstantKgCompleteEvent,
} from '../instantKg';

describe('InstantKg event shape parity with backend contract', () => {
  // The backend orchestrator at
  // apps/notebook/services/extraction/instant_kg.py is the canonical
  // source for these shapes. Each test below asserts the literal field
  // names the backend emits via `callbacks.on_*` and Redis pubsub.
  // Drift between these declarations and that file caused the entire
  // canvas-population path to fail silently in the original ship.

  it('document event uses object_type_slug + source_system (not object_type/color)', () => {
    const evt: InstantKgDocumentEvent = {
      object_id: 1,
      title: 'Doc',
      url: 'https://example.com',
      object_type_slug: 'source',
      source_system: 'instant_kg',
      fetch_provenance: { tier: 'tavily', tavily_credits_used: 1, fallback_reason: null },
    };
    expect(evt.fetch_provenance.tier).toBe('tavily');
    expect(evt.object_type_slug).toBe('source');
    expect(evt.source_system).toBe('instant_kg');
  });

  it('chunk event uses object_id + body_preview + chunk_index + part_of edge', () => {
    const evt: InstantKgChunkEvent = {
      object_id: 2,
      parent_object_id: 1,
      chunk_index: 0,
      title: 'Chunk 0',
      body_preview: 'preview',
      start_offset: 0,
      end_offset: 100,
      object_type_slug: 'chunk',
      edge: { source: 2, target: 1, edge_type: 'part_of', engine: 'instant_kg', reason: 'r' },
    };
    expect(evt.edge.edge_type).toBe('part_of');
    expect(evt.body_preview).toBe('preview');
    expect(evt.object_id).toBe(2);
  });

  it('entity event preserves char offsets and raw label for relation extraction', () => {
    // The orchestrator's _capture_entity ships start, end, label, text
    // through to chunk_entities so Modal extract_relations can map
    // char offsets to GLiREL token indices. Stripping these fields
    // caused every relation extraction to silently return zero pairs.
    const evt: InstantKgEntityEvent = {
      object_id: 42,
      source_chunk_object_id: 2,
      title: 'Travis Gilbert',
      text: 'Travis Gilbert',
      label: 'person',
      start: 7,
      end: 21,
      object_type_slug: 'person',
      resolved: false,
      resolved_to_existing_object_id: null,
      gliner_confidence: 0.94,
    };
    expect(evt.start).toBe(7);
    expect(evt.end).toBe(21);
    expect(evt.label).toBe('person');
    expect(evt.text).toBe('Travis Gilbert');
  });

  it('relation event nests source/target under edge', () => {
    const evt: InstantKgRelationEvent = {
      edge: {
        source: 42,
        target: 43,
        edge_type: 'derived',
        engine: 'instant_kg',
        reason: 'GLiREL extracted: A derived B.',
      },
      source_chunk_object_id: 2,
      glirel_confidence: 0.81,
      is_open_extras_candidate: false,
    };
    expect(evt.edge.source).toBe(42);
    expect(evt.edge.target).toBe(43);
    expect(evt.glirel_confidence).toBe(0.81);
  });

  it('cross_doc_edge event nests source/target under edge and ships similarity', () => {
    const evt: InstantKgCrossDocEvent = {
      edge: {
        source: 42,
        target: 99,
        edge_type: 'semantic',
        engine: 'sbert_faiss',
        reason: 'SBERT cosine similarity 0.78 between A and B.',
      },
      similarity: 0.78,
    };
    expect(evt.edge.engine).toBe('sbert_faiss');
    expect(evt.similarity).toBeGreaterThan(0.7);
  });

  it('handlers include onTensionProposed', () => {
    const handlers: Partial<InstantKgStreamHandlers> = {
      onTensionProposed: () => undefined,
    };
    expect(typeof handlers.onTensionProposed).toBe('function');
  });

  it('complete event nests counts under summary (not totals)', () => {
    const evt: InstantKgCompleteEvent = {
      job_id: 'abc-123',
      summary: {
        document_object_id: 1,
        chunk_count: 2,
        entity_count: 3,
        relation_count: 1,
        cross_doc_edge_count: 0,
        duration_ms: 1234,
      },
      focus: { pivot_object_id: 5, neighbors: [] },
      camera: {
        kind: 'waypoints',
        waypoints: [{ object_id: 5, duration_ms: 800 }],
      },
      lens_target: { object_id: 5, view: 'lens' },
    };
    expect(evt.summary.chunk_count).toBe(2);
    expect(evt.summary.entity_count).toBe(3);
    expect(evt.camera.waypoints[0].object_id).toBe(5);
    expect(evt.lens_target.view).toBe('lens');
  });
});

import { _parseErrorPayload } from '../instantKg';

describe('SSE error JSON parser', () => {
  it('parses {error, stage, fallback_used} payload', () => {
    const parsed = _parseErrorPayload('{"error": "boom", "stage": "fetch", "fallback_used": "trafilatura"}');
    expect(parsed.message).toBe('boom');
    expect(parsed.stage).toBe('fetch');
    expect(parsed.fallback_used).toBe('trafilatura');
  });

  it('falls back gracefully when payload is not JSON', () => {
    const parsed = _parseErrorPayload('plain string');
    expect(parsed.message).toContain('plain string');
  });
});
