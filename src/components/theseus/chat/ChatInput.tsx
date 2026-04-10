'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ChatInputProps {
  onSubmit: (query: string) => void;
  isDisabled?: boolean;
}

const STARTER_QUERIES = [
  'What connects Shannon to Hamming?',
  'What unresolved tensions are active?',
  'What am I missing about GNNs?',
  'What new clusters formed this week?',
];

export default function ChatInput({ onSubmit, isDisabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSubmit(trimmed);
    setValue('');
  }, [value, isDisabled, onSubmit]);

  // Listen for follow-up suggestions clicked in ChatMessage
  useEffect(() => {
    function handleFollowUp(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      if (detail?.query) {
        onSubmit(detail.query);
      }
    }
    window.addEventListener('theseus:chat-followup', handleFollowUp);
    return () => window.removeEventListener('theseus:chat-followup', handleFollowUp);
  }, [onSubmit]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="theseus-chat-input-area">
      {/* Suggestion pills (only visible when input is empty and not disabled) */}
      {!value && !isDisabled && (
        <div className="theseus-chat-suggestions">
          {STARTER_QUERIES.map((query) => (
            <button
              key={query}
              type="button"
              className="theseus-chat-suggestion-pill"
              onClick={() => onSubmit(query)}
            >
              {query}
            </button>
          ))}
        </div>
      )}

      <div className="theseus-chat-input-dock">
        <input
          ref={inputRef}
          type="text"
          className="theseus-chat-input"
          placeholder="Ask Theseus anything\u2026"
          aria-label="Ask Theseus a question"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={isDisabled}
        />
        <button
          type="button"
          className="theseus-chat-send"
          aria-label="Send"
          onClick={handleSubmit}
          disabled={!value.trim() || isDisabled}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
            <path d="M12 20V4M12 4L6 10M12 4L18 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
