'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { OBJECT_TYPES } from '@/lib/commonplace';
import type { CapturedObject } from '@/lib/commonplace';
import {
  createCapturedObject,
  isUrl,
} from '@/lib/commonplace-capture';
import { useLayout } from '@/lib/providers/layout-provider';

/**
 * CaptureButton: spring-animated sidebar capture input.
 *
 * Collapsed state: 40px bar with placeholder text.
 * Click springs open to ~120px with textarea + type selector.
 * Esc or outside click collapses back.
 *
 * Spring overshoot: cubic-bezier(0.34, 1.56, 0.64, 1)
 * from StampDot.tsx pattern.
 */

interface CaptureButtonProps {
  onCapture: (object: CapturedObject) => void;
}

export default function CaptureButton({ onCapture }: CaptureButtonProps) {
  const { launchView } = useLayout();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Focus textarea on open ── */
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  /* ── Close on outside click ── */
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  /* ── Submit capture ── */
  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const object = createCapturedObject({
      text: trimmed,
      objectType: selectedType ?? undefined,
      captureMethod: 'typed',
    });

    onCapture(object);

    setText('');
    setSelectedType(null);
    setIsOpen(false);
  }, [text, selectedType, onCapture]);

  /* ── Keyboard: Enter to submit, Esc to close ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  /* ── Auto-detect type from text ── */
  const detectedType =
    selectedType ?? (text.trim() ? (isUrl(text.trim()) ? 'source' : null) : null);

  /* ── Collapsed state ── */
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="cp-capture-collapsed"
      >
        <span aria-hidden="true" className="cp-capture-plus">+</span>
        <span className="cp-capture-placeholder">Capture...</span>
      </button>
    );
  }

  /* ── Expanded state ── */
  return (
    <div ref={containerRef} className="cp-capture-expanded">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Capture anything..."
        rows={3}
        className="cp-capture-textarea"
      />

      {/* Type selector row */}
      <div className="cp-capture-type-row">
        {OBJECT_TYPES.slice(0, 6).map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() =>
              setSelectedType(selectedType === t.slug ? null : t.slug)
            }
            title={t.label}
            className="cp-capture-type-btn"
            data-active={detectedType === t.slug}
            style={{ '--chip-color': t.color } as React.CSSProperties}
          >
            <span
              className="cp-capture-type-dot"
              style={{ backgroundColor: t.color }}
            />
            {t.label}
          </button>
        ))}
      </div>

      {/* Submit row */}
      <div className="cp-capture-submit-row">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="cp-capture-btn cp-capture-btn--esc"
        >
          ESC
        </button>
        {text.trim() && (
          <button
            type="button"
            onClick={() => {
              launchView('compose', {
                prefillText: text.trim(),
                prefillType: selectedType ?? undefined,
              });
              setText('');
              setSelectedType(null);
              setIsOpen(false);
            }}
            className="cp-capture-btn cp-capture-btn--expand"
          >
            EXPAND
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="cp-capture-btn cp-capture-btn--submit"
        >
          CAPTURE
        </button>
      </div>
    </div>
  );
}
