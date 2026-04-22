import test from 'node:test';
import assert from 'node:assert/strict';

import { Choreographer, type ChoreographerState } from '@/lib/theseus-viz/Choreographer';
import type { FocalLabel, GraphAdapter } from '@/lib/theseus/cosmograph/adapter';
import type { NodeSalience } from '@/lib/theseus-viz/SceneDirective';
import type { StageEvent } from '@/lib/theseus-api';

interface AdapterCall {
  method: string;
  args: unknown[];
}

function makeRecordingAdapter(): { adapter: GraphAdapter; calls: AdapterCall[] } {
  const calls: AdapterCall[] = [];
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
  };
  const adapter: GraphAdapter = {
    focusNodes: record('focusNodes'),
    clearFocus: record('clearFocus'),
    zoomToNode: record('zoomToNode'),
    fitView: record('fitView'),
    setSalienceEncoding: record('setSalienceEncoding'),
    setEdgeStyles: record('setEdgeStyles'),
    applyHypothesisColorMix: record('applyHypothesisColorMix'),
    setNeighborhoodGradient: record('setNeighborhoodGradient'),
    clearEncoding: record('clearEncoding'),
    fitViewToNodes: record('fitViewToNodes'),
    getProjectedPosition: () => null,
    setFocalLabels: record('setFocalLabels') as (labels: FocalLabel[]) => void,
    clearFocalLabels: record('clearFocalLabels'),
    playConstructionSequence: record('playConstructionSequence'),
    cancelConstruction: record('cancelConstruction'),
    setVisibleIds: record('setVisibleIds'),
    revealEvidence: record('revealEvidence'),
    queueCameraWaypoints: (...args: unknown[]) => {
      calls.push({ method: 'queueCameraWaypoints', args });
      return () => {};
    },
    getZoom: () => 1,
    onZoomChange: (...args: unknown[]) => {
      calls.push({ method: 'onZoomChange', args });
      return () => {};
    },
  };
  return { adapter, calls };
}

function pipelineStart(): Extract<StageEvent, { name: 'pipeline_start' }> {
  return { name: 'pipeline_start', query: 'q' };
}

function classifyComplete(): Extract<StageEvent, { name: 'e4b_classify_complete' }> {
  return {
    name: 'e4b_classify_complete',
    answer_type: 'analytical',
    search_query: 'q',
    extracted_entity: 'q',
    needs_image: false,
    entity_object_ids: [],
  };
}

function retrievalComplete(): Extract<StageEvent, { name: 'retrieval_complete' }> {
  return {
    name: 'retrieval_complete',
    evidence_count: 5,
    confidence: 0.7,
    has_tensions: false,
    has_gaps: false,
    bm25_hits: [
      { object_id: 101, score: 12.4 },
      { object_id: 202, score: 8.1 },
      { object_id: 303, score: 5.0 },
    ],
    sbert_scores: [
      { object_id: 101, similarity: 0.92 },
      { object_id: 303, similarity: 0.81 },
    ],
    pagerank_scores: { '202': 0.03, '101': 0.08 },
    community_assignments: {},
    tensions: [],
  };
}

function objectsLoaded(): Extract<StageEvent, { name: 'objects_loaded' }> {
  return { name: 'objects_loaded', object_count: 5, focal_object_ids: [101, 303] };
}

test('choreographer: pipeline_start enters anticipate and issues reset patch', () => {
  const { adapter, calls } = makeRecordingAdapter();
  const states: ChoreographerState[] = [];
  const choreo = new Choreographer({
    getAdapter: () => adapter,
    onStateChange: (next) => states.push(next),
  });

  const handlers = choreo.observe();
  handlers.onStage(pipelineStart());

  assert.equal(choreo.currentState(), 'anticipate');
  assert.deepEqual(states, ['anticipate']);
  // reset patch triggers the 4 clearing adapter ops
  assert.ok(calls.some((c) => c.method === 'clearEncoding'));
  assert.ok(calls.some((c) => c.method === 'clearFocalLabels'));
  assert.ok(calls.some((c) => c.method === 'clearFocus'));
  assert.ok(calls.some((c) => c.method === 'cancelConstruction'));
});

test('choreographer: retrieval_complete fuses signals and lights up top-K', () => {
  const { adapter, calls } = makeRecordingAdapter();
  const choreo = new Choreographer({ getAdapter: () => adapter });
  const handlers = choreo.observe();

  handlers.onStage(pipelineStart());
  handlers.onStage(retrievalComplete());

  assert.equal(choreo.currentState(), 'retrieve');
  const salienceCall = calls.find((c) => c.method === 'setSalienceEncoding');
  assert.ok(salienceCall, 'setSalienceEncoding should fire');
  const salience = salienceCall!.args[0] as NodeSalience[];
  assert.ok(salience.length > 0, 'salience should have entries');
  assert.ok(salience.length <= 12, 'default topK is 12');
  // Node 101 has highest bm25+sbert+pagerank → should be first and focal
  assert.equal(salience[0].node_id, '101');
  assert.equal(salience[0].is_focal, true);
  // Neighborhood gradient pairs with salience
  const gradient = calls.find((c) => c.method === 'setNeighborhoodGradient');
  assert.ok(gradient, 'setNeighborhoodGradient should fire');
  // Batch 3: staggered revealEvidence call with same ordering as salience
  const reveal = calls.find((c) => c.method === 'revealEvidence');
  assert.ok(reveal, 'revealEvidence should fire on retrieval_complete');
  const revealIds = reveal!.args[0] as string[];
  assert.equal(revealIds[0], '101', 'reveal order matches fused-score order');
});

test('choreographer: objects_loaded moves camera to focal set', () => {
  const { adapter, calls } = makeRecordingAdapter();
  const choreo = new Choreographer({ getAdapter: () => adapter });
  const handlers = choreo.observe();

  handlers.onStage(pipelineStart());
  handlers.onStage(retrievalComplete());
  handlers.onStage(objectsLoaded());

  assert.equal(choreo.currentState(), 'focus');
  const focus = calls.find((c) => c.method === 'focusNodes');
  assert.ok(focus, 'focusNodes should fire on objects_loaded');
  assert.deepEqual(focus!.args[0], ['101', '303']);
  const fit = calls.find((c) => c.method === 'fitViewToNodes');
  assert.ok(fit, 'fitViewToNodes should fire on objects_loaded');
});

test('choreographer: first token transitions to speak', () => {
  const { adapter } = makeRecordingAdapter();
  const states: ChoreographerState[] = [];
  const choreo = new Choreographer({
    getAdapter: () => adapter,
    onStateChange: (next) => states.push(next),
  });
  const handlers = choreo.observe();

  handlers.onStage(pipelineStart());
  handlers.onStage(classifyComplete());
  handlers.onStage(retrievalComplete());
  handlers.onStage(objectsLoaded());
  handlers.onToken('hello');
  handlers.onToken(' world');

  assert.equal(choreo.currentState(), 'speak');
  // speak should appear exactly once (second token must not re-transition)
  assert.equal(states.filter((s) => s === 'speak').length, 1);
});

test('choreographer: prefers-reduced-motion suppresses mid-stream patches', () => {
  const { adapter, calls } = makeRecordingAdapter();
  const choreo = new Choreographer({
    getAdapter: () => adapter,
    prefersReducedMotion: true,
  });
  const handlers = choreo.observe();

  handlers.onStage(pipelineStart());
  handlers.onStage(retrievalComplete());
  handlers.onStage(objectsLoaded());

  // No adapter mutation should fire from these events under reduced motion
  assert.equal(calls.length, 0);
  // But state still transitions for downstream observers
  assert.equal(choreo.currentState(), 'focus');
});

test('choreographer: reset() returns to idle and clears answer_ready flag', () => {
  const { adapter } = makeRecordingAdapter();
  const choreo = new Choreographer({ getAdapter: () => adapter });
  const handlers = choreo.observe();

  handlers.onStage(pipelineStart());
  handlers.onStage(retrievalComplete());
  choreo.reset();

  assert.equal(choreo.currentState(), 'idle');
});

test('choreographer: onError transitions to idle', () => {
  const { adapter } = makeRecordingAdapter();
  const choreo = new Choreographer({ getAdapter: () => adapter });
  const handlers = choreo.observe();

  handlers.onStage(pipelineStart());
  handlers.onError({ message: 'boom', transient: false });

  assert.equal(choreo.currentState(), 'idle');
});
