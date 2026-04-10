'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface AskIdleHeroProps {
  onSubmit: (query: string) => void;
}

export default function AskIdleHero({ onSubmit }: AskIdleHeroProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setQuery('');
  }, [query, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  // Keyboard shortcuts: /, Cmd+K, Cmd+E
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);

      if (e.key === '/' && !isTyping) {
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }

      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('theseus:open-command-palette'));
        return;
      }

      if (e.metaKey && e.key === 'e') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('theseus:switch-panel', { detail: { panel: 'explorer' } }),
        );
      }
    }

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Listen for prefill-ask events
  useEffect(() => {
    function handlePrefill(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      if (detail?.query) {
        setQuery(detail.query);
        textareaRef.current?.focus();
      }
    }
    window.addEventListener('theseus:prefill-ask', handlePrefill);
    return () => window.removeEventListener('theseus:prefill-ask', handlePrefill);
  }, []);

  const hasQuery = query.trim().length > 0;

  return (
    <div className="ask-idle-hero">
      <h1 className="ask-idle-headline">What problem are we solving?</h1>

      <div className={`ask-idle-input-container${focused ? ' ask-idle-input-focused' : ''}`}>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          aria-label="Ask Theseus a question"
          placeholder={"Ask anything, or describe what you\u2019re exploring\u2026"}
          rows={2}
          className="ask-idle-textarea"
        />
        <div className="ask-idle-input-footer">
          <div className="ask-idle-mode-toggles">
            <span className="ask-idle-mode-pill">depth</span>
            <span className="ask-idle-mode-pill">visualize</span>
          </div>
          <button
            type="button"
            className={`ask-idle-submit${hasQuery ? ' ask-idle-submit-active' : ''}`}
            onClick={handleSubmit}
            disabled={!hasQuery}
          >
            Ask
          </button>
        </div>
      </div>

      <div className="ask-idle-kbd-hints">
        <span><kbd className="ask-idle-kbd">/</kbd> focus</span>
        <span><kbd className="ask-idle-kbd">{'\u2318\u00A0'}K</kbd> commands</span>
        <span><kbd className="ask-idle-kbd">{'\u2318\u00A0'}E</kbd> explorer</span>
      </div>
    </div>
  );
}
