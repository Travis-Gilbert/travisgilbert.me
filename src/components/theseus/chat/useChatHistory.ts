'use client';

import { useCallback, useRef, useState } from 'react';
import { askTheseusAsyncStream } from '@/lib/theseus-api';
import type { AsyncStreamHandlers, StageEvent } from '@/lib/theseus-api';
import type { TheseusResponse, EvidenceNode, EvidenceEdge } from '@/lib/theseus-types';

export type ChatRole = 'user' | 'theseus';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  /** Theseus response data (populated for role=theseus) */
  response?: TheseusResponse;
  /** Streaming state */
  isStreaming?: boolean;
  /** Current pipeline stage label */
  stageLabel?: string;
  /** Error message if the response failed */
  error?: string;
  /** Timestamp */
  timestamp: number;
}

/** Extracted evidence for visual preview cards */
export interface EvidenceSummary {
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}

let messageIdCounter = 0;
function nextId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

function stageToLabel(event: StageEvent): string {
  switch (event.name) {
    case 'pipeline_start': return 'Starting\u2026';
    case 'e4b_classify_start': return 'Classifying question\u2026';
    case 'e4b_classify_complete': return 'Retrieving evidence\u2026';
    case 'retrieval_start': return 'Searching knowledge graph\u2026';
    case 'retrieval_complete': return `Found ${event.evidence_count} evidence nodes`;
    case 'objects_loaded': return `Loaded ${event.object_count} objects`;
    case 'expression_start': return 'Composing answer\u2026';
    case 'expression_complete': return '';
    default: return '';
  }
}

export function useChatHistory() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback((query: string) => {
    if (!query.trim() || isAsking) return;

    // Abort any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: ChatMessage = {
      id: nextId(),
      role: 'user',
      text: query.trim(),
      timestamp: Date.now(),
    };

    const theseusId = nextId();
    const theseusMsg: ChatMessage = {
      id: theseusId,
      role: 'theseus',
      text: '',
      isStreaming: true,
      stageLabel: 'Starting...',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, theseusMsg]);
    setIsAsking(true);

    const handlers: AsyncStreamHandlers = {
      onStage(event: StageEvent) {
        const label = stageToLabel(event);
        setMessages((prev) =>
          prev.map((m) => (m.id === theseusId ? { ...m, stageLabel: label } : m)),
        );
      },

      onToken(token: string) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === theseusId ? { ...m, text: m.text + token, stageLabel: '' } : m,
          ),
        );
      },

      onComplete(result: TheseusResponse) {
        // Use the full narrative from sections if available, falling back to streamed tokens
        const narrativeSection = result.sections.find((s) => s.type === 'narrative');
        const fullText = narrativeSection && 'content' in narrativeSection
          ? narrativeSection.content
          : result.answer ?? '';

        setMessages((prev) =>
          prev.map((m) =>
            m.id === theseusId
              ? {
                  ...m,
                  text: fullText || m.text,
                  response: result,
                  isStreaming: false,
                  stageLabel: undefined,
                }
              : m,
          ),
        );
        setIsAsking(false);
        abortRef.current = null;
      },

      onError(error) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === theseusId
              ? { ...m, isStreaming: false, stageLabel: undefined, error: error.message }
              : m,
          ),
        );
        setIsAsking(false);
        abortRef.current = null;
      },
    };

    askTheseusAsyncStream(query, { signal: controller.signal }, handlers).catch(() => {
      // Stream setup failed silently (error handler already called)
    });
  }, [isAsking]);

  const clearHistory = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsAsking(false);
  }, []);

  return { messages, isAsking, ask, clearHistory };
}
