import type { ThreadMessageLike } from '@assistant-ui/react';
import type { TheoremAgentRunResult } from '@/lib/theorem-agent';

export const COMMONPLACE_CHAT_TENANT = 'Travis-Gilbert';
export const COMMONPLACE_CHAT_BINDING_PREFIX = 'commonplace:chat';

export type CommonPlaceChatRole = 'user' | 'assistant';
export type CommonPlaceChatStatus = 'complete' | 'running' | 'error';

export interface CommonPlaceChatRunMetadata {
  runId?: string;
  bindingId: string;
  tenant: string;
  heads: string[];
  claimsCount: number;
  evidenceCount: number;
  answerKind?: TheoremAgentRunResult['answerKind'];
  alignmentVerdict?: unknown;
  references?: string[];
}

export interface CommonPlaceChatMessage {
  id: string;
  role: CommonPlaceChatRole;
  content: string;
  createdAt: string;
  conversationId: string;
  bindingId: string;
  tenant: string;
  status: CommonPlaceChatStatus;
  run?: CommonPlaceChatRunMetadata;
}

export function newConversationId(): string {
  return uniqueChatId('cp-conversation');
}

export function buildCommonPlaceChatBindingId(conversationId: string): string {
  return `${COMMONPLACE_CHAT_BINDING_PREFIX}:${conversationId}`;
}

export function createCommonPlaceChatMessage(input: {
  role: CommonPlaceChatRole;
  content: string;
  conversationId: string;
  bindingId: string;
  tenant?: string;
  status?: CommonPlaceChatStatus;
  run?: CommonPlaceChatRunMetadata;
}): CommonPlaceChatMessage {
  return {
    id: uniqueChatId(`cp-${input.role}`),
    role: input.role,
    content: input.content,
    createdAt: new Date().toISOString(),
    conversationId: input.conversationId,
    bindingId: input.bindingId,
    tenant: input.tenant ?? COMMONPLACE_CHAT_TENANT,
    status: input.status ?? 'complete',
    run: input.run,
  };
}

export function messageToThreadMessage(message: CommonPlaceChatMessage): ThreadMessageLike {
  const baseMessage: ThreadMessageLike = {
    role: message.role,
    id: message.id,
    content: [{ type: 'text' as const, text: message.content }],
    createdAt: new Date(message.createdAt),
    metadata: {
      custom: {
        conversationId: message.conversationId,
        bindingId: message.bindingId,
        tenant: message.tenant,
        run: message.run ?? null,
      },
    },
  };

  if (message.role === 'assistant') {
    return {
      ...baseMessage,
      status: message.status === 'running'
        ? { type: 'running' }
      : message.status === 'error'
          ? { type: 'incomplete' as const, reason: 'error' as const }
          : { type: 'complete' as const, reason: 'stop' as const },
    };
  }

  return baseMessage;
}

export function runMetadataFromResult(
  result: TheoremAgentRunResult,
  fallback: { bindingId: string; tenant: string; references?: string[] },
): CommonPlaceChatRunMetadata {
  return {
    runId: result.runId,
    bindingId: result.bindingId || fallback.bindingId,
    tenant: fallback.tenant,
    heads: result.heads,
    claimsCount: result.claims.length,
    evidenceCount: result.evidenceCount,
    answerKind: result.answerKind,
    alignmentVerdict: result.alignmentVerdict,
    references: fallback.references,
  };
}

export function latestRunMessage(messages: CommonPlaceChatMessage[]): CommonPlaceChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant' && message.run) return message;
  }
  return null;
}

export function uniqueChatId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
