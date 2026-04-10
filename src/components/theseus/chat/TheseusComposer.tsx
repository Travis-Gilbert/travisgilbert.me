'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STARTER_QUERIES = [
  'What connects Shannon to Hamming?',
  'What unresolved tensions are active?',
  'What am I missing about GNNs?',
  'What new clusters formed this week?',
];

interface TheseusComposerProps {
  onSubmit: (query: string) => void;
  isDisabled?: boolean;
  showSuggestions?: boolean;
}

/**
 * TheseusComposer: textarea-based composer with suggestion pills.
 *
 * Replaces the old ChatInput (which used <input type="text">).
 * Features: multi-line via textarea, Enter to submit, Shift+Enter
 * for newline, suggestion pills when empty, prefill via custom event.
 */
export default function TheseusComposer({ onSubmit, isDisabled, showSuggestions }: TheseusComposerProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSubmit(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isDisabled, onSubmit]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [value]);

  // Listen for follow-up suggestions
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

  // Listen for "Ask about this" pre-fill (does NOT auto-submit)
  useEffect(() => {
    function handlePrefill(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      if (detail?.query) {
        setValue(detail.query);
        textareaRef.current?.focus();
      }
    }
    window.addEventListener('theseus:prefill-ask', handlePrefill);
    return () => window.removeEventListener('theseus:prefill-ask', handlePrefill);
  }, []);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Listen for focus-ask-input event
  useEffect(() => {
    function handleFocus() {
      textareaRef.current?.focus();
    }
    window.addEventListener('theseus:focus-ask-input', handleFocus);
    return () => window.removeEventListener('theseus:focus-ask-input', handleFocus);
  }, []);

  return (
    <div className="theseus-composer">
      <div className="theseus-composer-inner">
        <textarea
          ref={textareaRef}
          className="theseus-composer-input"
          placeholder="Ask Theseus anything..."
          aria-label="Ask Theseus a question"
          autoComplete="off"
          spellCheck={false}
          rows={1}
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

        {isDisabled ? (
          <button
            type="button"
            className="theseus-composer-cancel"
            aria-label="Stop"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('theseus:cancel-ask'));
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="theseus-composer-send"
            aria-label="Send"
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 20V4M12 4L6 10M12 4L18 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* Suggestion pills (below the input, centered) */}
      {showSuggestions && !value && !isDisabled && (
        <div className="theseus-composer-suggestions">
          {STARTER_QUERIES.map((query) => (
            <button
              key={query}
              type="button"
              className="theseus-followup-pill"
              onClick={() => onSubmit(query)}
            >
              {query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
