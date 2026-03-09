'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * RetroNote: contextual retrospective prompt card.
 *
 * Appears in the timeline when a meaningful event is detected.
 * Four trigger types surface different prompts:
 *
 *   dormant      - node gained 2+ new connections since last visit
 *   hunch-sources - hunch now has 3+ source connections
 *   bridge       - node connects two previously unconnected clusters
 *   tension      - a tension or contradiction edge was detected
 *
 * Each trigger is dismissed via localStorage (keyed by dismissKey)
 * so the same prompt does not surface repeatedly for the same node.
 *
 * The 'tension' variant renders with an amber dashed border.
 *
 * Legacy behavior preserved: passing no trigger uses generic prompts
 * selected deterministically from adjacentNodeId.
 */

export type RetroTrigger = 'dormant' | 'hunch-sources' | 'bridge' | 'tension';

interface RetroNoteProps {
  /* Legacy props (generic placement between timeline cards) */
  prompt?: string;
  adjacentNodeId?: string;
  onSubmit?: (text: string, adjacentNodeId?: string) => void;

  /* Trigger-based props (contextual surfacing) */
  trigger?: RetroTrigger;
  relatedNodes?: string[];
  dismissKey?: string;
}

/* ─────────────────────────────────────────────────
   Prompt copy by trigger type
   ───────────────────────────────────────────────── */

const TRIGGER_PROMPTS: Record<RetroTrigger, string> = {
  dormant: 'Two new paths just appeared. What does the graph know that you don\'t?',
  'hunch-sources': 'Three sources have landed here. Is this still a hunch, or something more?',
  bridge: 'You\'ve built a bridge. What happens when the two sides finally meet?',
  tension: 'Something here is pushing back. What\'s the contradiction worth sitting with?',
};

const GENERIC_PROMPTS = [
  'What do you see now that you didn\'t before?',
  'What connects these to something you\'re working on?',
  'Is there a pattern forming here?',
  'What would you tell someone about this cluster?',
  'What question does this raise?',
  'Which of these surprised you?',
];

/* ─────────────────────────────────────────────────
   Hash for deterministic prompt selection
   ───────────────────────────────────────────────── */

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function RetroNote({
  prompt,
  adjacentNodeId,
  onSubmit,
  trigger,
  relatedNodes,
  dismissKey,
}: RetroNoteProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Check localStorage dismissal on mount */
  useEffect(() => {
    if (!dismissKey) return;
    const lsKey = `retro:dismissed:${dismissKey}`;
    if (localStorage.getItem(lsKey) === '1') {
      setIsDismissed(true);
    }
  }, [dismissKey]);

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [text]);

  /* Resolve prompt text */
  const displayPrompt: string = (() => {
    if (trigger) return TRIGGER_PROMPTS[trigger];
    if (prompt) return prompt;
    if (adjacentNodeId) {
      return GENERIC_PROMPTS[Math.abs(hashCode(adjacentNodeId)) % GENERIC_PROMPTS.length] ?? GENERIC_PROMPTS[0];
    }
    return GENERIC_PROMPTS[0];
  })();

  function handleDismiss() {
    if (dismissKey) {
      localStorage.setItem(`retro:dismissed:${dismissKey}`, '1');
    }
    setIsDismissed(true);
  }

  function handleSubmit() {
    if (!text.trim()) return;
    onSubmit?.(text.trim(), adjacentNodeId);
    if (dismissKey) {
      localStorage.setItem(`retro:dismissed:${dismissKey}`, '1');
    }
    setText('');
    setIsExpanded(false);
    setIsDismissed(true);
  }

  if (isDismissed) return null;

  /* Visual variant: tension uses amber dashed border */
  const isTension = trigger === 'tension';

  const cardBorder = isTension
    ? '1.5px dashed #D4944A'
    : '1px dashed var(--cp-border)';

  const accentColor = isTension ? '#D4944A' : 'var(--cp-terracotta)';

  return (
    <div
      className="cp-retro-note"
      style={{
        border: cardBorder,
        borderRadius: 6,
        padding: '10px 12px',
        backgroundColor: isTension ? 'rgba(212, 148, 74, 0.04)' : 'transparent',
        position: 'relative',
      }}
    >
      {/* Trigger label */}
      {trigger && (
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: isTension ? '#D4944A' : 'var(--cp-text-faint)',
            marginBottom: 5,
            opacity: 0.8,
          }}
        >
          {trigger === 'dormant' && 'DORMANT NODE'}
          {trigger === 'hunch-sources' && 'HUNCH GROWING'}
          {trigger === 'bridge' && 'BRIDGE FOUND'}
          {trigger === 'tension' && 'TENSION DETECTED'}
        </div>
      )}

      {/* Prompt text */}
      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontStyle: 'italic',
          fontSize: 13.5,
          color: 'var(--cp-text-muted)',
          lineHeight: 1.45,
          marginBottom: isExpanded ? 8 : 0,
        }}
      >
        {displayPrompt}
      </div>

      {/* Related node chips */}
      {relatedNodes && relatedNodes.length > 0 && !isExpanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {relatedNodes.slice(0, 3).map((n, i) => (
            <span
              key={i}
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: 'var(--cp-text-faint)',
                border: '1px solid var(--cp-border)',
                borderRadius: 3,
                padding: '1px 5px',
                letterSpacing: '0.05em',
              }}
            >
              {n}
            </span>
          ))}
        </div>
      )}

      {/* Expand/collapse */}
      {isExpanded ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === 'Escape') {
                setIsExpanded(false);
                setText('');
              }
            }}
            placeholder="A quick reflection..."
            style={{
              width: '100%',
              minHeight: 36,
              padding: '6px 8px',
              fontFamily: 'var(--cp-font-body)',
              fontSize: 12.5,
              color: 'var(--cp-text)',
              backgroundColor: 'var(--cp-surface)',
              border: '1px solid var(--cp-border)',
              borderRadius: 4,
              resize: 'none',
              outline: 'none',
              lineHeight: 1.5,
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setText('');
              }}
              style={{
                padding: '3px 10px',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 10,
                color: 'var(--cp-text-faint)',
                background: 'transparent',
                border: '1px solid var(--cp-border)',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim()}
              style={{
                padding: '3px 10px',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 10,
                color: text.trim() ? 'var(--cp-bg)' : 'var(--cp-text-faint)',
                background: text.trim() ? accentColor : 'var(--cp-border)',
                border: 'none',
                borderRadius: 4,
                cursor: text.trim() ? 'pointer' : 'default',
                transition: 'background-color 150ms, color 150ms',
              }}
            >
              SAVE
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            style={{
              flex: 1,
              padding: '5px 8px',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              letterSpacing: '0.05em',
              color: 'var(--cp-text-faint)',
              background: 'transparent',
              border: `1px dashed var(--cp-border)`,
              borderRadius: 4,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accentColor;
              e.currentTarget.style.color = 'var(--cp-text-muted)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--cp-border)';
              e.currentTarget.style.color = 'var(--cp-text-faint)';
            }}
          >
            Write a reflection...
          </button>
          {dismissKey && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss"
              style={{
                padding: '5px 8px',
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 10,
                color: 'var(--cp-text-faint)',
                background: 'transparent',
                border: '1px solid var(--cp-border)',
                borderRadius: 4,
                cursor: 'pointer',
                flexShrink: 0,
              }}
              title="Don't show this again"
            >
              &times;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
