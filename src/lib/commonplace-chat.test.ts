import { describe, expect, it } from 'vitest';
import {
  COMMONPLACE_CHAT_TENANT,
  buildCommonPlaceChatBindingId,
  createCommonPlaceChatMessage,
  latestRunMessage,
  messageToThreadMessage,
  runMetadataFromResult,
} from './commonplace-chat';
import type { TheoremAgentRunResult } from './theorem-agent';

describe('commonplace chat message contract', () => {
  it('builds a stable binding from the conversation id', () => {
    expect(buildCommonPlaceChatBindingId('abc123')).toBe('commonplace:chat:abc123');
  });

  it('converts CommonPlace messages to assistant-ui thread messages', () => {
    const message = createCommonPlaceChatMessage({
      role: 'assistant',
      content: 'Done.',
      conversationId: 'conversation-1',
      bindingId: 'commonplace:chat:conversation-1',
      tenant: COMMONPLACE_CHAT_TENANT,
    });

    const threadMessage = messageToThreadMessage(message);

    expect(threadMessage.role).toBe('assistant');
    expect(threadMessage.content).toEqual([{ type: 'text', text: 'Done.' }]);
    expect(threadMessage.status).toEqual({ type: 'complete', reason: 'stop' });
    expect(threadMessage.metadata?.custom).toMatchObject({
      conversationId: 'conversation-1',
      bindingId: 'commonplace:chat:conversation-1',
      tenant: COMMONPLACE_CHAT_TENANT,
    });
  });

  it('preserves real Theorem run metadata', () => {
    const result: TheoremAgentRunResult = {
      mode: 'ask',
      task: 'Inspect status.',
      answer: 'Ready.',
      answerKind: 'MODEL',
      bindingId: 'upstream-binding',
      runId: 'run-1',
      heads: ['qwen', 'mistral'],
      claims: [{ text: 'Claim', provenance: 'test' }],
      evidenceCount: 3,
    };

    const run = runMetadataFromResult(result, {
      bindingId: 'fallback-binding',
      tenant: COMMONPLACE_CHAT_TENANT,
    });

    expect(run).toMatchObject({
      runId: 'run-1',
      bindingId: 'upstream-binding',
      tenant: COMMONPLACE_CHAT_TENANT,
      heads: ['qwen', 'mistral'],
      claimsCount: 1,
      evidenceCount: 3,
      answerKind: 'MODEL',
    });
  });

  it('finds the latest assistant message with run metadata', () => {
    const base = {
      conversationId: 'conversation-1',
      bindingId: 'commonplace:chat:conversation-1',
      tenant: COMMONPLACE_CHAT_TENANT,
    };
    const first = createCommonPlaceChatMessage({
      ...base,
      role: 'assistant',
      content: 'Earlier',
      run: {
        runId: 'run-1',
        bindingId: base.bindingId,
        tenant: base.tenant,
        heads: [],
        claimsCount: 0,
        evidenceCount: 0,
      },
    });
    const second = createCommonPlaceChatMessage({
      ...base,
      role: 'assistant',
      content: 'Later',
      run: {
        runId: 'run-2',
        bindingId: base.bindingId,
        tenant: base.tenant,
        heads: [],
        claimsCount: 0,
        evidenceCount: 0,
      },
    });

    expect(latestRunMessage([first, second])?.run?.runId).toBe('run-2');
  });
});
