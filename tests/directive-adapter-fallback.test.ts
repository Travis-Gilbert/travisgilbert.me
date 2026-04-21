import test from 'node:test';
import assert from 'node:assert/strict';

// The DirectiveAdapter's public contract is: if the foundation fails to
// load (e.g., no network / WASM blocked / Node.js test env with no
// WebGPU), score() returns a rule-based result keyed off the caller's
// feature[0] (the fused retrieval score) and never throws.
//
// In the Node test runner Transformers.js has no browser primitives, so
// ensureFoundation() returns null on every call. That's exactly the
// fallback path we want to exercise.

import { score, buildGraphFeatures } from '@/lib/theseus-viz/model/DirectiveAdapter';

test('DirectiveAdapter: rule-based fallback when foundation unavailable', async () => {
  const result = await score({
    query: 'What do I think about attention economies?',
    evidence: [
      { id: '101', text: 'Attention is a scarce resource.', features: [0.9, 0.8, 0.7, 0.1, 0, 1, 0, 0] },
      { id: '202', text: 'Focus shapes what we see.', features: [0.6, 0.5, 0.4, 0.05, 0, 0, 0, 0] },
      { id: '303', text: 'Unrelated topic entirely.', features: [0.2, 0.1, 0.05, 0.01, 0, 0, 0, 0] },
    ],
  });

  assert.equal(result.inferenceMethod, 'rule_based');
  assert.equal(result.revealScores.length, 3);
  // Fallback ranks by feature[0] (the fused retrieval score), so 101 > 202 > 303
  assert.ok(result.revealScores[0] > result.revealScores[1]);
  assert.ok(result.revealScores[1] > result.revealScores[2]);
  assert.equal(result.cameraHints.length, 3);
  assert.ok(result.pacing.durationMultiplier > 0);
  assert.ok(result.pacing.theatricality >= 0 && result.pacing.theatricality <= 1);
});

test('DirectiveAdapter: empty evidence returns empty arrays without throwing', async () => {
  const result = await score({ query: 'anything', evidence: [] });
  assert.equal(result.revealScores.length, 0);
  assert.equal(result.cameraHints.length, 0);
  assert.equal(result.inferenceMethod, 'rule_based');
});

test('buildGraphFeatures: 8 dims in expected order', () => {
  const feats = buildGraphFeatures({
    fusedScore: 0.5,
    bm25: 12,
    sbert: 0.7,
    pagerank: 0.03,
    tensionCount: 2,
    isFocal: true,
    isHypothetical: false,
    communityId: 42,
  });
  assert.equal(feats.length, 8);
  assert.equal(feats[0], 0.5);
  assert.equal(feats[1], 12);
  assert.equal(feats[2], 0.7);
  assert.equal(feats[3], 0.03);
  assert.equal(feats[4], 2);
  assert.equal(feats[5], 1);
  assert.equal(feats[6], 0);
  assert.ok(feats[7] >= 0 && feats[7] < 1);
});
