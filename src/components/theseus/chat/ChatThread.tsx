'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from './useChatHistory';
import ChatMessage from './ChatMessage';

interface ChatThreadProps {
  messages: ChatMessageType[];
}

/**
 * ChatThread: scrolling vertical thread of messages.
 *
 * Auto-scrolls to bottom when new messages arrive or when a
 * streaming message receives new tokens. Uses a sentinel div
 * at the bottom with scrollIntoView for smooth behavior.
 */
export default function ChatThread({ messages }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages change (new message or streaming token)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div ref={containerRef} className="theseus-chat-thread" role="log" aria-live="polite">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
