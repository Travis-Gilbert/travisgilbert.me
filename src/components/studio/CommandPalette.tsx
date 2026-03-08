'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  type StudioCommand,
  STUDIO_COMMANDS,
  filterCommands,
} from '@/lib/studio-commands';

interface CommandPaletteProps {
  onClose: () => void;
  onExecute: (commandId: string) => void;
  isEditorActive: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  editor: 'Editor',
  view: 'View',
  navigate: 'Navigate',
  content: 'Content',
};

/**
 * Cmd+K command palette overlay with fuzzy search
 * and keyboard navigation.
 */
export default function CommandPalette({
  onClose,
  onExecute,
  isEditorActive,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = filterCommands(query, STUDIO_COMMANDS, isEditorActive);

  /* Focus input on mount */
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  /* Reset active index when results change */
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  /* Scroll active item into view */
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(
      '[data-active="true"]',
    ) as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const execute = useCallback(
    (cmd: StudioCommand) => {
      onExecute(cmd.id);
      onClose();
    },
    [onExecute, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (results[activeIndex]) {
            execute(results[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, activeIndex, execute, onClose],
  );

  /* Group results by category for rendering with dividers */
  const grouped: { category: string; commands: StudioCommand[] }[] = [];
  let lastCategory = '';
  for (const cmd of results) {
    if (cmd.category !== lastCategory) {
      grouped.push({ category: cmd.category, commands: [cmd] });
      lastCategory = cmd.category;
    } else {
      grouped[grouped.length - 1].commands.push(cmd);
    }
  }

  /* Build a flat index for keyboard navigation */
  let flatIndex = 0;

  const paletteContent = (
    <div className="studio-theme">
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
        }}
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close command palette"
      />

      {/* Palette dialog: top-anchored like VS Code / Raycast */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={handleKeyDown}
        style={{
          position: 'fixed',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: '480px',
          maxWidth: '92vw',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--studio-surface)',
          border: '1px solid var(--studio-border)',
          borderRadius: '10px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--studio-border)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command..."
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '15px',
              color: 'var(--studio-text-bright)',
              caretColor: 'var(--studio-tc)',
            }}
          />
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          style={{
            overflowY: 'auto',
            padding: '6px',
          }}
        >
          {results.length === 0 && (
            <div
              style={{
                padding: '20px 12px',
                textAlign: 'center',
                fontFamily: 'var(--studio-font-body)',
                fontSize: '13px',
                color: 'var(--studio-text-3)',
              }}
            >
              No commands found
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.category}>
              {/* Category divider (only when not searching) */}
              {!query.trim() && (
                <div
                  style={{
                    padding: '6px 12px 4px',
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--studio-text-3)',
                  }}
                >
                  {CATEGORY_LABELS[group.category] ?? group.category}
                </div>
              )}

              {group.commands.map((cmd) => {
                const thisIndex = flatIndex++;
                const isActive = thisIndex === activeIndex;

                return (
                  <button
                    key={cmd.id}
                    type="button"
                    data-active={isActive ? 'true' : undefined}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setActiveIndex(thisIndex)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: isActive
                        ? 'var(--studio-surface-hover)'
                        : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.08s ease',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--studio-font-body)',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--studio-text-bright)',
                          lineHeight: 1.3,
                        }}
                      >
                        {cmd.label}
                      </div>
                      {cmd.description && (
                        <div
                          style={{
                            fontFamily: 'var(--studio-font-body)',
                            fontSize: '12px',
                            color: 'var(--studio-text-3)',
                            marginTop: '1px',
                          }}
                        >
                          {cmd.description}
                        </div>
                      )}
                    </div>

                    {cmd.shortcut && (
                      <span
                        style={{
                          fontFamily: 'var(--studio-font-mono)',
                          fontSize: '10px',
                          color: 'var(--studio-text-3)',
                          backgroundColor:
                            'rgba(255, 255, 255, 0.05)',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          border:
                            '1px solid rgba(255, 255, 255, 0.08)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          marginLeft: '12px',
                        }}
                      >
                        {cmd.shortcut}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: '6px 16px',
            borderTop: '1px solid var(--studio-border)',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          {['arrows navigate', 'enter select', 'esc close'].map(
            (hint) => (
              <span
                key={hint}
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '9px',
                  color: 'var(--studio-text-3)',
                  letterSpacing: '0.04em',
                }}
              >
                {hint}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(paletteContent, document.body);
}
