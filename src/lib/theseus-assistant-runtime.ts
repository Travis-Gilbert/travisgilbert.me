/**
 * Theseus assistant-ui runtime adapter.
 *
 * Maps the Theseus SSE stream (askTheseusAsyncStream) to
 * assistant-ui's ExternalThread message protocol.
 *
 * Key mapping:
 *   onToken -> append to assistant message content
 *   onStage -> update status indicator text
 *   onComplete -> finalize message with response sections
 *   onError -> set error state on message
 */

import { useCallback, useRef, useState } from 'react';
import { askTheseusAsyncStream } from './theseus-api';
import type { StageEvent } from './theseus-api';
import type { TheseusResponse } from './theseus-types';

/**
 * Lightweight message type for the Theseus runtime.
 * Compatible with assistant-ui's RuntimeMessage when full
 * integration is wired (add metadata field).
 */
interface RuntimeMessage {
  id: string;
  role: 'user' | 'assistant';
  content: Array<{ type: 'text'; text: string }>;
  createdAt: Date;
  status?: { type: 'incomplete'; reason: 'error' };
}

export interface TheseusMessageMetadata {
  stageLabel?: string;
  response?: TheseusResponse | null;
}

function makeId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stageToLabel(event: StageEvent): string {
  switch (event.name) {
    case 'pipeline_start': return 'STARTING';
    case 'e4b_classify_start': return 'CLASSIFYING';
    case 'e4b_classify_complete': return 'CLASSIFIED';
    case 'retrieval_start': return 'RETRIEVING EVIDENCE';
    case 'retrieval_complete': return 'EVIDENCE READY';
    case 'objects_loaded': return 'OBJECTS LOADED';
    case 'expression_start': return 'ASSEMBLING ANSWER';
    case 'expression_complete': return 'ANSWER READY';
    default: return 'THINKING';
  }
}

export interface TheseusRuntimeState {
  messages: RuntimeMessage[];
  isRunning: boolean;
  stageLabel: string;
  metadataMap: Map<string, TheseusMessageMetadata>;
}

/**
 * Hook that manages the Theseus chat runtime state for assistant-ui.
 *
 * Returns messages in assistant-ui's RuntimeMessage format,
 * plus handlers for submission and cancellation.
 */
export function useTheseusRuntime() {
  const [messages, setMessages] = useState<RuntimeMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stageLabel, setStageLabel] = useState('');
  const metadataMapRef = useRef(new Map<string, TheseusMessageMetadata>());
  const cleanupRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleNew = useCallback(async (message: { content: Array<{ type: string; text?: string }> }) => {
    const textParts = message.content.filter((p) => p.type === 'text' && p.text);
    const query = textParts.map((p) => p.text).join(' ').trim();
    if (!query) return;

    // Create user message
    const userMsg: RuntimeMessage = {
      id: makeId(),
      role: 'user',
      content: [{ type: 'text', text: query }],
      createdAt: new Date(),
    };

    // Create assistant message (will be updated as tokens arrive)
    const assistantId = makeId();
    const assistantMsg: RuntimeMessage = {
      id: assistantId,
      role: 'assistant',
      content: [{ type: 'text', text: '' }],
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsRunning(true);
    setStageLabel('STARTING');

    const abort = new AbortController();
    abortRef.current = abort;
    let tokenBuffer = '';

    const cleanup = await askTheseusAsyncStream(
      query,
      { include_web: true, signal: abort.signal },
      {
        onStage: (event: StageEvent) => {
          const label = stageToLabel(event);
          setStageLabel(label);
          metadataMapRef.current.set(assistantId, {
            ...metadataMapRef.current.get(assistantId),
            stageLabel: label,
          });
        },

        onToken: (token: string) => {
          tokenBuffer += token;
          const currentText = tokenBuffer;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: [{ type: 'text' as const, text: currentText }] }
                : m,
            ),
          );
        },

        onComplete: (result: TheseusResponse) => {
          // Extract narrative text from sections
          const narratives = result.sections.filter((s) => s.type === 'narrative');
          const finalText = narratives.length > 0
            ? narratives.map((s) => 'content' in s ? s.content : '').join('\n\n')
            : tokenBuffer || result.answer || '';

          metadataMapRef.current.set(assistantId, {
            stageLabel: '',
            response: result,
          });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: [{ type: 'text' as const, text: finalText }] }
                : m,
            ),
          );
          setIsRunning(false);
          setStageLabel('');
        },

        onError: (error: { message: string; transient: boolean }) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: [{ type: 'text' as const, text: tokenBuffer || 'An error occurred.' }],
                    status: { type: 'incomplete' as const, reason: 'error' as const },
                  }
                : m,
            ),
          );
          metadataMapRef.current.set(assistantId, {
            stageLabel: error.message,
            response: null,
          });
          setIsRunning(false);
          setStageLabel('');
        },
      },
    );

    cleanupRef.current = cleanup;
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    cleanupRef.current?.();
    setIsRunning(false);
    setStageLabel('');
  }, []);

  const getMetadata = useCallback((messageId: string): TheseusMessageMetadata | undefined => {
    return metadataMapRef.current.get(messageId);
  }, []);

  return {
    messages,
    isRunning,
    stageLabel,
    handleNew,
    handleCancel,
    getMetadata,
    setMessages,
  };
}
