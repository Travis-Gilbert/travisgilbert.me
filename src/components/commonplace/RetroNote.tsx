'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * RetroNote: retrospective prompt card.
 *
 * Appears between timeline entries (after every 5th to 7th card,
 * determined by the parent). Card with paper grain texture, italic
 * prompt, and an inline textarea that auto-expands on focus.
 *
 * On submit, the parent receives the text (which would become a
 * "retrospective" type note linked to the adjacent NodeCard).
 */

interface RetroNoteProps {
  prompt?: string;
  adjacentNodeId?: string;
  onSubmit?: (text: string, adjacentNodeId?: string) => void;
}

const PROMPTS = [
  'What do you see now that you didn\'t before?',
  'What connects these to something you\'re working on?',
  'Is there a pattern forming here?',
  'What would you tell someone about this cluster?',
  'What question does this raise?',
  'Which of these surprised you?',
];

export default function RetroNote({
  prompt,
  adjacentNodeId,
  onSubmit,
}: RetroNoteProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Pick a deterministic prompt from the adjacentNodeId */
  const displayPrompt =
    prompt ??
    PROMPTS[
      adjacentNodeId
        ? Math.abs(hashCode(adjacentNodeId)) % PROMPTS.length
        : 0
    ];

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [text]);

  function handleSubmit() {
    if (!text.trim()) return;
    onSubmit?.(text.trim(), adjacentNodeId);
    setText('');
    setIsExpanded(false);
  }

  return (
    <div className="cp-retro-note">
      {/* Prompt text */}
      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 14,
          color: 'var(--cp-text-muted)',
          lineHeight: 1.4,
          marginBottom: isExpanded ? 8 : 0,
        }}
      >
        {displayPrompt}
      </div>

      {/* Textarea (visible on click or when text entered) */}
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
                color: text.trim()
                  ? 'var(--cp-bg)'
                  : 'var(--cp-text-faint)',
                background: text.trim()
                  ? 'var(--cp-terracotta)'
                  : 'var(--cp-border)',
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
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          style={{
            display: 'block',
            width: '100%',
            marginTop: 6,
            padding: '5px 8px',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            letterSpacing: '0.05em',
            color: 'var(--cp-text-faint)',
            background: 'transparent',
            border: '1px dashed var(--cp-border)',
            borderRadius: 4,
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 150ms, color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--cp-terracotta)';
            e.currentTarget.style.color = 'var(--cp-text-muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--cp-border)';
            e.currentTarget.style.color = 'var(--cp-text-faint)';
          }}
        >
          Write a quick reflection...
        </button>
      )}
    </div>
  );
}

/* Simple hash for deterministic prompt selection */
function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return hash;
}
