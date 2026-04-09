import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAskPresentationState,
  mergeProgressiveVisualPayload,
  type AskState,
} from '@/components/theseus/askExperienceState';
import type { TheseusResponse } from '@/lib/theseus-types';

function makeResponse(): TheseusResponse {
  return {
    query: 'Show me Ada Lovelace',
    answer: 'Ada Lovelace pioneered analytical computing.',
    answer_agent: 'tpu_a31b',
    mode: 'full',
    confidence: {
      evidence: 0.88,
      tension: 0,
      coverage: 0.42,
      source_independence: 0.7,
      combined: 0.66,
    },
    sections: [
      {
        type: 'narrative',
        content: 'Ada Lovelace pioneered analytical computing.',
        tier: 2,
        attribution: { model: 'theseus-a31b' },
      },
    ],
    metadata: {
      duration_ms: 456,
      objects_searched: 3,
      engine_version: 'index-api-v2',
    },
    follow_ups: [],
  };
}

test('mergeProgressiveVisualPayload overlays image and visualization hints onto an answer', () => {
  const merged = mergeProgressiveVisualPayload(makeResponse(), {
    sequence: 1,
    answer_type: 'portrait',
    reference_image_url: 'https://images.example/ada.png',
    visualization: {
      type: 'visualization',
      scene_id: 'progressive-visualization',
      scene_data: {
        renderer: 'tfjs_stipple',
        answer_type: 'portrait',
      },
    },
  });

  assert.ok(merged);
  assert.equal(merged.answer_type, 'portrait');
  assert.equal(merged.reference_image_url, 'https://images.example/ada.png');
  assert.equal(
    merged.sections.find((section) => section.type === 'visualization')?.type,
    'visualization',
  );
});

test('getAskPresentationState moves the query into the header as soon as an answer is ready', () => {
  const presentation = getAskPresentationState({
    hasError: false,
    state: 'MODEL',
    response: makeResponse(),
    sceneDirective: null,
  });

  assert.deepEqual(presentation, {
    isExploring: false,
    hasScene: false,
    queryStage: 'header',
  });
});

test('getAskPresentationState keeps the answer live when visuals fail and no scene exists', () => {
  const presentation = getAskPresentationState({
    hasError: false,
    state: 'EXPLORING' satisfies AskState,
    response: makeResponse(),
    sceneDirective: null,
  });

  assert.deepEqual(presentation, {
    isExploring: true,
    hasScene: false,
    queryStage: 'header',
  });
});
