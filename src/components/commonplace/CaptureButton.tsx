'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CAPTURE_PLACEHOLDERS, OBJECT_TYPES } from '@/lib/commonplace';
import type { CapturedObject } from '@/lib/commonplace';
import {
  createCapturedObject,
  isUrl,
} from '@/lib/commonplace-capture';
import { useCommonPlace } from '@/lib/commonplace-context';

/**
 * CaptureButton: spring-animated sidebar capture input.
 *
 * Collapsed state: 40px bar with cycling placeholder text
 * (adapted from CyclingTagline typewriter pattern).
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
  const { requestView } = useCommonPlace();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Cycling placeholder (typewriter pattern) ── */
  useEffect(() => {
    if (isOpen) return;

    const fullText = CAPTURE_PLACEHOLDERS[placeholderIndex];
    let charIndex = 0;
    let phase: 'typing' | 'pause' | 'erasing' = 'typing';
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      if (phase === 'typing') {
        charIndex++;
        setPlaceholderText(fullText.slice(0, charIndex));
        setIsTyping(true);
        if (charIndex >= fullText.length) {
          phase = 'pause';
          timer = setTimeout(tick, 2400);
          return;
        }
        timer = setTimeout(tick, 35 + Math.random() * 25);
      } else if (phase === 'pause') {
        phase = 'erasing';
        timer = setTimeout(tick, 30);
      } else {
        charIndex--;
        setPlaceholderText(fullText.slice(0, charIndex));
        setIsTyping(false);
        if (charIndex <= 0) {
          setPlaceholderIndex((i) => (i + 1) % CAPTURE_PLACEHOLDERS.length);
          return;
        }
        timer = setTimeout(tick, 18);
      }
    }

    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [placeholderIndex, isOpen]);

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
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          border: '1px solid var(--cp-sidebar-border)',
          borderRadius: 8,
          background: 'var(--cp-sidebar-surface)',
          color: 'var(--cp-sidebar-text-faint)',
          fontFamily: 'var(--cp-font-body)',
          fontSize: 12,
          cursor: 'text',
          textAlign: 'left',
          transition: 'border-color 200ms, background-color 200ms',
          minHeight: 40,
        }}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          style={{ opacity: 0.5, flexShrink: 0 }}
        >
          <path d="M8 2v12M2 8h12" />
        </svg>
        <span
          style={{
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {placeholderText}
          {isTyping && (
            <span className="cp-capture-cursor" aria-hidden="true">
              |
            </span>
          )}
        </span>
      </button>
    );
  }

  /* ── Expanded state ── */
  return (
    <div
      ref={containerRef}
      className="cp-capture-expanded"
      style={{
        border: '1px solid var(--cp-terracotta)',
        borderRadius: 8,
        background: 'var(--cp-sidebar-surface)',
        overflow: 'hidden',
        animation: 'cp-spring-open 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Capture anything..."
        rows={3}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: 'none',
          background: 'transparent',
          color: 'var(--cp-sidebar-text)',
          fontFamily: 'var(--cp-font-body)',
          fontSize: 13,
          resize: 'none',
          outline: 'none',
          lineHeight: 1.5,
        }}
      />

      {/* Type selector row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px 8px',
          flexWrap: 'wrap',
        }}
      >
        {OBJECT_TYPES.slice(0, 6).map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() =>
              setSelectedType(selectedType === t.slug ? null : t.slug)
            }
            title={t.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 4,
              border:
                detectedType === t.slug
                  ? `1px solid ${t.color}`
                  : '1px solid transparent',
              background:
                detectedType === t.slug
                  ? `${t.color}20`
                  : 'transparent',
              color: 'var(--cp-sidebar-text-muted)',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: t.color,
                flexShrink: 0,
              }}
            />
            {t.label}
          </button>
        ))}
      </div>

      {/* Submit row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '0 8px 8px',
          gap: 6,
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={{
            padding: '4px 12px',
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--cp-sidebar-text-faint)',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            cursor: 'pointer',
          }}
        >
          ESC
        </button>
        {text.trim() && (
          <button
            type="button"
            onClick={() => {
              requestView('compose', 'Compose', {
                prefillText: text.trim(),
                prefillType: selectedType ?? undefined,
              });
              setText('');
              setSelectedType(null);
              setIsOpen(false);
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: '1px solid var(--cp-sidebar-border)',
              background: 'transparent',
              color: 'var(--cp-sidebar-text-muted)',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              cursor: 'pointer',
              transition: 'border-color 200ms',
            }}
          >
            EXPAND
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim()}
          style={{
            padding: '4px 14px',
            borderRadius: 4,
            border: 'none',
            background: text.trim()
              ? 'var(--cp-terracotta)'
              : 'var(--cp-sidebar-surface-hover)',
            color: text.trim()
              ? '#FAF6F1'
              : 'var(--cp-sidebar-text-faint)',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.05em',
            cursor: text.trim() ? 'pointer' : 'default',
            transition: 'background-color 200ms',
          }}
        >
          CAPTURE
        </button>
      </div>
    </div>
  );
}
