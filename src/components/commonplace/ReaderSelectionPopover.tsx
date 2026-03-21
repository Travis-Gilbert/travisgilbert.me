'use client';

/**
 * ReaderSelectionPopover: floating popover above selected text.
 *
 * Appears on mouseup when user selects 3+ characters inside a
 * paragraph. Four actions: Highlight, Note, Claim, Connect.
 * Dismisses on outside click or after an action.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HighlightAction } from './reader-data';

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface ReaderSelectionPopoverProps {
  /** The scrollable container to listen for mouseup events */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Called when user picks an action on selected text */
  onAction: (paragraphId: string, text: string, action: HighlightAction) => void;
}

/* ─────────────────────────────────────────────────
   Action icons (14x14, matching prototype)
   ───────────────────────────────────────────────── */

function PencilIcon() {
  return (
    <svg className="reader-pop-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--r-gold)" strokeWidth="1.5">
      <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="reader-pop-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--r-teal)" strokeWidth="1.5">
      <rect x="3" y="2" width="10" height="12" rx="1" />
      <path d="M6 5h4M6 8h4M6 11h2" />
    </svg>
  );
}

function ClaimIcon() {
  return (
    <svg className="reader-pop-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--r-green)" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.5 8l2 2 3-4" />
    </svg>
  );
}

function ConnectIcon() {
  return (
    <svg className="reader-pop-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--r-purple)" strokeWidth="1.5">
      <circle cx="5" cy="5" r="2" />
      <circle cx="11" cy="11" r="2" />
      <path d="M6.5 6.5l3 3" />
    </svg>
  );
}

const ACTIONS: { action: HighlightAction; label: string; Icon: () => React.JSX.Element }[] = [
  { action: 'highlight', label: 'Highlight', Icon: PencilIcon },
  { action: 'note', label: 'Note', Icon: NoteIcon },
  { action: 'claim', label: 'Claim', Icon: ClaimIcon },
  { action: 'connect', label: 'Connect', Icon: ConnectIcon },
];

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function ReaderSelectionPopover({
  scrollContainerRef,
  onAction,
}: ReaderSelectionPopoverProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState<{ paragraphId: string; text: string } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const hidePopover = useCallback(() => {
    setVisible(false);
    setSelection(null);
  }, []);

  /* ── Show popover on text selection ── */
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleMouseUp = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        return;
      }

      const text = sel.toString().trim();
      if (text.length < 3) return;

      // Find the paragraph element
      const anchorNode = sel.anchorNode;
      const paraEl = (anchorNode instanceof HTMLElement ? anchorNode : anchorNode?.parentElement)
        ?.closest('[data-pid]') as HTMLElement | null;

      if (!paraEl || !container.contains(paraEl)) return;

      const paragraphId = paraEl.dataset.pid;
      if (!paragraphId) return;

      // Position above the selection
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setPosition({
        x: rect.left + rect.width / 2 - containerRect.left + container.scrollLeft,
        y: rect.top - containerRect.top + container.scrollTop - 8,
      });
      setSelection({ paragraphId, text });
      setVisible(true);
    };

    el.addEventListener('mouseup', handleMouseUp);
    return () => el.removeEventListener('mouseup', handleMouseUp);
  }, [scrollContainerRef]);

  /* ── Dismiss on outside click ── */
  useEffect(() => {
    if (!visible) return;

    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        hidePopover();
      }
    }

    // Delay to avoid immediately closing from the mouseup that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [visible, hidePopover]);

  if (!visible || !selection) return null;

  return (
    <div
      ref={popRef}
      className="reader-sel-pop"
      style={{ left: position.x, top: position.y }}
    >
      {ACTIONS.map(({ action, label, Icon }) => (
        <button
          key={action}
          className="reader-pop-btn"
          onClick={() => {
            onAction(selection.paragraphId, selection.text, action);
            hidePopover();
            window.getSelection()?.removeAllRanges();
          }}
        >
          <Icon />
          <span className="reader-pop-label">{label}</span>
        </button>
      ))}
    </div>
  );
}
