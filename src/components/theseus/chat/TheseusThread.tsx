'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from './useChatHistory';
import TheseusMessage from './TheseusMessage';
import TheseusComposer from './TheseusComposer';
import Link from 'next/link';

interface TheseusThreadProps {
  messages: ChatMessageType[];
  isAsking: boolean;
  onSubmit: (query: string) => void;
}

/**
 * TheseusThread: assistant-ui themed chat thread.
 *
 * Replaces ChatCanvas + ChatThread + ChatInput with a unified component
 * that handles: welcome screen, scrolling message thread, composer.
 *
 * Uses VIE design tokens via assistant-ui-theme.css.
 */
export default function TheseusThread({ messages, isAsking, onSubmit }: TheseusThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  // Auto-scroll when messages change, unless user has scrolled up
  useEffect(() => {
    if (!userScrolledRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Detect manual scroll-up to pause auto-scroll
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function handleScroll() {
      if (!viewport) return;
      const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 60;
      userScrolledRef.current = !atBottom;
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div className="theseus-thread">
      {isEmpty ? (
        /* Welcome screen */
        <div className="theseus-welcome">
          <h1 className="theseus-welcome-title">THESEUS</h1>
          <p className="theseus-welcome-subtitle">What are you thinking about?</p>
          <Link href="/theseus/explorer" className="theseus-welcome-link">
            OPEN EXPLORER
          </Link>
        </div>
      ) : (
        /* Message thread */
        <div ref={viewportRef} className="theseus-thread-viewport" role="log" aria-live="polite">
          <div className="theseus-thread-messages">
            {messages.map((msg) => (
              <TheseusMessage key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} aria-hidden="true" />
          </div>
        </div>
      )}

      {/* Composer (always visible at bottom) */}
      <TheseusComposer
        onSubmit={onSubmit}
        isDisabled={isAsking}
        showSuggestions={isEmpty}
      />
    </div>
  );
}
