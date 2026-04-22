'use client';

import { type ReactNode } from 'react';
import type { ChatMessage } from '@/components/theseus/chat/useChatHistory';

export type AtlasMarginMode = 'rail' | 'margin';

interface AtlasThreadsSurfaceProps {
  messages: ChatMessage[];
  /** Export handler; the Export Markdown strip renders only when at
   *  least one folio exists. */
  onExport?: () => void;
  /** The active folio index the rail should highlight (0-based). */
  activeFolio: number;
  onJumpToFolio?: (index: number) => void;
  children: ReactNode;
}

/**
 * Atlas Threads (aka Correspondence) paper surface chrome.
 *
 * Provides the Export Markdown strip top-left, the left-edge Folios
 * rail for quick navigation, and hosts the thread body via children.
 */
export default function AtlasThreadsSurface({
  messages,
  onExport,
  activeFolio,
  onJumpToFolio,
  children,
}: AtlasThreadsSurfaceProps) {
  const turns = messages.filter((m) => m.role === 'user');
  const total = turns.length;
  const currentIndex = total === 0 ? 0 : Math.min(activeFolio, total - 1);

  return (
    <div
      className="ask-paper"
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {onExport && total > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 18,
              left: 72,
              zIndex: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 12px',
              background: 'rgba(243, 239, 230, 0.85)',
              backdropFilter: 'blur(6px)',
              border: '1px solid var(--paper-rule)',
              borderRadius: 3,
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--paper-ink-2)',
            }}
          >
            <button
              type="button"
              onClick={onExport}
              style={{
                all: 'unset',
                cursor: 'pointer',
                color: 'var(--paper-ink-2)',
              }}
            >
              Export markdown
            </button>
          </div>
        )}

        {total > 1 && (
          <div
            aria-label="Folio rail"
            style={{
              position: 'absolute',
              left: 28,
              top: 96,
              bottom: 96,
              zIndex: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                font: '500 9px/1 var(--font-mono)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--paper-ink-3)',
                marginBottom: 6,
              }}
            >
              Folios
            </span>
            {turns.map((turn, i) => (
              <button
                key={turn.id}
                type="button"
                onClick={() => onJumpToFolio?.(i)}
                aria-label={`Jump to folio ${i + 1}`}
                style={{
                  pointerEvents: 'auto',
                  border: 'none',
                  background: i === currentIndex ? 'var(--paper-pencil)' : 'var(--paper-ink-3)',
                  width: i === currentIndex ? 22 : 14,
                  height: i === currentIndex ? 3 : 2,
                  opacity: i === currentIndex ? 1 : 0.35,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'width 140ms, height 140ms, opacity 140ms, background 140ms',
                }}
              />
            ))}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
