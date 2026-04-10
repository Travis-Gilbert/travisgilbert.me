'use client';

import Link from 'next/link';
import ChatCanvas from '@/components/theseus/chat/ChatCanvas';
import ChatThread from '@/components/theseus/chat/ChatThread';
import ChatInput from '@/components/theseus/chat/ChatInput';
import { useChatHistory } from '@/components/theseus/chat/useChatHistory';

/**
 * Theseus Chat Home: threaded conversational interface.
 *
 * When there are no messages, shows a welcome state with the
 * Theseus title, starter queries, and an Explorer link. Once
 * the user asks a question, the welcome fades and the threaded
 * conversation fills the space.
 */
export default function TheseusHomepage() {
  const { messages, isAsking, ask } = useChatHistory();
  const hasMessages = messages.length > 0;

  return (
    <div className="theseus-chat-home">
      {/* Canvas texture: subtle shade variations for material feel */}
      <ChatCanvas />

      {/* Welcome state (visible when no messages) */}
      {!hasMessages && (
        <div className="theseus-chat-welcome">
          <h1 className="theseus-chat-title">Theseus</h1>
          <p className="theseus-chat-subtitle">What are you thinking about?</p>

          <Link href="/theseus/explorer" className="theseus-chat-explorer-link">
            Open Explorer
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      )}

      {/* Threaded conversation (visible when messages exist) */}
      {hasMessages && <ChatThread messages={messages} />}

      {/* Input area (always visible) */}
      <ChatInput onSubmit={ask} isDisabled={isAsking} />
    </div>
  );
}
