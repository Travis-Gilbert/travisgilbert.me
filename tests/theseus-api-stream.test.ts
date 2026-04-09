import test from 'node:test';
import assert from 'node:assert/strict';

import { askTheseusAsyncStream } from '@/lib/theseus-api';

class MockEventSource {
  static latest: MockEventSource | null = null;
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  closed = false;
  listeners = new Map<string, Array<(event: { data: string }) => void>>();

  constructor(public url: string) {
    MockEventSource.latest = this;
  }

  addEventListener(type: string, handler: (event: { data: string }) => void) {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({ data: JSON.stringify(payload) });
    }
  }
}

function makeAskPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    query: 'Show me Ada Lovelace',
    answer: 'Ada Lovelace pioneered analytical computing.',
    answer_agent: 'tpu_a31b',
    answer_type: 'portrait',
    answer_classification: {
      answer_type: 'portrait',
      search_query: 'Ada Lovelace portrait',
      extracted_entity: 'Ada Lovelace',
    },
    traversal: {
      objects_searched: 3,
      clusters_touched: 1,
      signals_used: ['bm25', 'sbert'],
      time_ms: 456,
      web_augmented: true,
    },
    confidence: {
      evidence: 88,
      tension: 0,
      coverage: 42,
      source_independence: 0.7,
    },
    sections: [
      {
        type: 'narrative',
        data: {
          text: 'Ada Lovelace pioneered analytical computing.',
          attribution: { model: 'theseus-a31b' },
          tier: 'deep',
        },
      },
    ],
    follow_ups: [],
    ...overrides,
  };
}

test('askTheseusAsyncStream forwards progressive events before complete', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const requestedUrls: string[] = [];

  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    MockEventSource.latest = null;
  });

  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));
    return new Response(
      JSON.stringify({
        job_id: 'job-1',
        stream_url: '/api/v2/theseus/ask/stream/job-1/',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  };
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

  const seen: string[] = [];
  const answers: Array<{ answer?: string; answer_type?: string; search_query?: string | null }> = [];
  const visuals: Array<{ sequence: number; available?: boolean; image?: string }> = [];

  await askTheseusAsyncStream(
    'Show me Ada Lovelace',
    { include_web: true },
    {
      onStage: (event) => seen.push(`stage:${event.name}`),
      onToken: (token) => seen.push(`token:${token}`),
      onVisualDelta: (payload) => {
        seen.push(`visual_delta:${payload.sequence}`);
        visuals.push({
          sequence: payload.sequence,
          image: payload.reference_image_url,
        });
      },
      onAnswerReady: (result) => {
        seen.push('answer_ready');
        answers.push({
          answer: result.answer,
          answer_type: result.answer_type,
          search_query: result.answer_classification?.search_query ?? null,
        });
      },
      onVisualComplete: (payload) => {
        seen.push(`visual_complete:${String(payload.available)}`);
        visuals.push({
          sequence: payload.sequence,
          available: payload.available,
        });
      },
      onComplete: (result) => {
        seen.push('complete');
        answers.push({
          answer: result.answer,
          answer_type: result.answer_type,
          search_query: result.answer_classification?.search_query ?? null,
        });
      },
      onError: (error) => {
        assert.fail(`Unexpected stream error: ${error.message}`);
      },
    },
  );

  const eventSource = MockEventSource.latest;
  assert.ok(eventSource);
  assert.deepEqual(requestedUrls, ['/api/v2/theseus/ask/async']);
  assert.equal(eventSource.url, '/api/v2/theseus/ask/stream/job-1');

  eventSource.emit('stage', { name: 'pipeline_start', query: 'Show me Ada Lovelace' });
  eventSource.emit('token', { text: 'Ada' });
  eventSource.emit('visual_delta', {
    sequence: 1,
    answer_type: 'portrait',
    reference_image_url: 'https://images.example/ada.png',
  });
  eventSource.emit('answer_ready', makeAskPayload());
  eventSource.emit('visual_complete', {
    sequence: 2,
    answer_type: 'portrait',
    available: false,
  });
  eventSource.emit('complete', makeAskPayload({
    reference_image_url: 'https://images.example/ada.png',
  }));

  assert.deepEqual(seen, [
    'stage:pipeline_start',
    'token:Ada',
    'visual_delta:1',
    'answer_ready',
    'visual_complete:false',
    'complete',
  ]);
  assert.deepEqual(answers, [
    {
      answer: 'Ada Lovelace pioneered analytical computing.',
      answer_type: 'portrait',
      search_query: 'Ada Lovelace portrait',
    },
    {
      answer: 'Ada Lovelace pioneered analytical computing.',
      answer_type: 'portrait',
      search_query: 'Ada Lovelace portrait',
    },
  ]);
  assert.deepEqual(visuals, [
    {
      sequence: 1,
      image: 'https://images.example/ada.png',
    },
    {
      sequence: 2,
      available: false,
    },
  ]);
  assert.equal(eventSource.closed, true);
});

test('askTheseusAsyncStream still succeeds when only complete arrives', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;

  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    MockEventSource.latest = null;
  });

  globalThis.fetch = async () => new Response(
    JSON.stringify({ job_id: 'job-2' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;

  let completeAnswer: string | undefined;
  let answerReadyCount = 0;

  await askTheseusAsyncStream(
    'Show me Ada Lovelace',
    { include_web: true },
    {
      onStage: () => {},
      onToken: () => {},
      onAnswerReady: () => {
        answerReadyCount += 1;
      },
      onComplete: (result) => {
        completeAnswer = result.answer;
      },
      onError: (error) => {
        assert.fail(`Unexpected stream error: ${error.message}`);
      },
    },
  );

  const eventSource = MockEventSource.latest;
  assert.ok(eventSource);

  eventSource.emit('complete', makeAskPayload());

  assert.equal(answerReadyCount, 0);
  assert.equal(completeAnswer, 'Ada Lovelace pioneered analytical computing.');
  assert.equal(eventSource.closed, true);
});
