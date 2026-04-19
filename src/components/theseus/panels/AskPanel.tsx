'use client';

import { useCallback } from 'react';
import TheseusThread, { exportChatAsMarkdown } from '@/components/theseus/chat/TheseusThread';
import { useChatHistory } from '@/components/theseus/chat/useChatHistory';

/**
 * Parchment chat surface. Chat state lives inside this component so it
 * persists across panel switches; the shared DotGrid in TheseusShell is
 * the panel's material backdrop.
 */
export default function AskPanel() {
  const { messages, isAsking, ask } = useChatHistory();

  const handleExport = useCallback(() => {
    if (messages.length > 0) exportChatAsMarkdown(messages);
  }, [messages]);

  return (
    <div
      className="theseus-chat-home"
      data-machine-warm={isAsking ? 'true' : 'false'}
      style={{ position: 'relative', height: '100%' }}
    >
      {messages.length > 0 && (
        <button
          type="button"
          className="theseus-chat-export"
          onClick={handleExport}
          title="Export conversation as markdown"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      <TheseusThread
        messages={messages}
        isAsking={isAsking}
        onSubmit={ask}
      />
    </div>
  );
}
