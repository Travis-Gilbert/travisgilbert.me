/**
 * Theseus assistant-ui runtime adapter (v0.12+).
 *
 * Uses useExternalStoreRuntime to bridge the existing useChatHistory
 * message store to assistant-ui's runtime protocol. This is a real
 * integration: assistant-ui components read from this runtime.
 *
 * Key mapping:
 *   ChatMessage (useChatHistory) -> ThreadMessageLike (assistant-ui)
 *   onToken -> streaming assistant message
 *   onStage -> status metadata
 *   onComplete -> finalized message with response sections
 */

import { useMemo } from 'react';
import {
  useExternalStoreRuntime,
  type ExternalStoreAdapter,
  type ThreadMessageLike,
} from '@assistant-ui/react';
import type { ChatMessage } from '@/components/theseus/chat/useChatHistory';
import type { TheseusResponse } from './theseus-types';

export interface TheseusMessageMetadata {
  stageLabel?: string;
  response?: TheseusResponse | null;
  isStreaming?: boolean;
  error?: string;
}

/**
 * Convert a ChatMessage (from useChatHistory) to assistant-ui's
 * ThreadMessageLike format. This converter is called by
 * useExternalStoreRuntime to transform our messages.
 */
function convertMessage(msg: ChatMessage): ThreadMessageLike {
  const isAssistant = msg.role === 'theseus';

  if (isAssistant) {
    return {
      role: 'assistant',
      id: msg.id,
      content: [{ type: 'text' as const, text: msg.text }],
      createdAt: new Date(msg.timestamp),
      status: msg.error
        ? { type: 'incomplete' as const, reason: 'error' as const }
        : msg.isStreaming
          ? { type: 'running' as const }
          : { type: 'complete' as const, reason: 'stop' as const },
      metadata: {
        custom: {
          stageLabel: msg.stageLabel ?? '',
          response: msg.response ?? null,
          isStreaming: msg.isStreaming ?? false,
          error: msg.error ?? '',
        },
      },
    };
  }

  return {
    role: 'user',
    id: msg.id,
    content: [{ type: 'text' as const, text: msg.text }],
    createdAt: new Date(msg.timestamp),
  };
}

interface UseTheseusRuntimeArgs {
  messages: ChatMessage[];
  isAsking: boolean;
  onSubmit: (query: string) => void;
}

/**
 * Hook that creates an assistant-ui runtime backed by useChatHistory.
 *
 * Usage:
 *   const runtime = useTheseusAssistantRuntime({ messages, isAsking, onSubmit });
 *   <AssistantRuntimeProvider runtime={runtime}>
 *     <ThreadPrimitive.Root>...</ThreadPrimitive.Root>
 *   </AssistantRuntimeProvider>
 */
export function useTheseusAssistantRuntime({
  messages,
  isAsking,
  onSubmit,
}: UseTheseusRuntimeArgs) {
  const adapter: ExternalStoreAdapter<ChatMessage> = useMemo(
    () => ({
      messages,
      isRunning: isAsking,
      convertMessage,
      onNew: async (appendMessage) => {
        const textParts = appendMessage.content.filter(
          (p): p is { type: 'text'; text: string } => p.type === 'text',
        );
        const query = textParts.map((p) => p.text).join(' ').trim();
        if (query) onSubmit(query);
      },
      onCancel: async () => {
        window.dispatchEvent(new CustomEvent('theseus:cancel-ask'));
      },
    }),
    [messages, isAsking, onSubmit],
  );

  return useExternalStoreRuntime(adapter);
}
