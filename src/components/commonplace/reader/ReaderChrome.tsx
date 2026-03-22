'use client';

/**
 * ReaderChrome: top bar of the reader overlay.
 *
 * Height: 44px. Frosted glass background.
 * Left to right: close, separator, Contents toggle, title,
 * Engine toggle, separator, font picker, pipeline dots.
 */

import { useState, useRef, useEffect } from 'react';
import type { ReaderFont } from './reader-data';
import {
  READER_FONTS,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  PIPELINE_STAGES,
} from './reader-data';

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface ReaderChromeProps {
  title: string;
  pipelineStatus: string;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onClose: () => void;
  readingFont: ReaderFont;
  fontSize: number;
  onFontChange: (font: ReaderFont) => void;
  onFontSizeChange: (size: number) => void;
}

/* ─────────────────────────────────────────────────
   Inline SVG icons (matching prototype exactly)
   ───────────────────────────────────────────────── */

function CloseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 4L4 12M4 4l8 8" />
    </svg>
  );
}

/** Left-aligned panel icon (filled block on left, dots on right) */
function ContentsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="4" width="8" height="16" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" />
      <circle cx="16" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="20" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="20" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="20" cy="16" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Right-aligned panel icon (dots on left, filled block on right) */
function EngineIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="16" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="20" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="20" cy="12" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="20" cy="16" r="0.8" fill="currentColor" stroke="none" />
      <rect x="12" y="4" width="8" height="16" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 3l3 3 3-3" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────
   Pipeline dots (small variant for chrome bar)
   ───────────────────────────────────────────────── */

function PipelineDots({ status }: { status: string }) {
  const activeIdx = PIPELINE_STAGES.indexOf(status as typeof PIPELINE_STAGES[number]);

  return (
    <div className="reader-pipeline sm">
      {PIPELINE_STAGES.map((stage, i) => (
        <span key={stage}>
          <span
            className={`dot${i <= activeIdx ? ' active' : ''}`}
            title={stage}
          />
          {i < PIPELINE_STAGES.length - 1 && (
            <span className={`line${i < activeIdx ? ' active' : ''}`} />
          )}
        </span>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Font picker dropdown
   ───────────────────────────────────────────────── */

function FontPicker({
  currentFont,
  fontSize,
  onFontChange,
  onFontSizeChange,
}: {
  currentFont: ReaderFont;
  fontSize: number;
  onFontChange: (font: ReaderFont) => void;
  onFontSizeChange: (size: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="reader-font-picker" ref={menuRef}>
      <button
        className="reader-chrome-btn"
        onClick={() => setOpen((v) => !v)}
        title="Font and size"
      >
        <span style={{ fontFamily: currentFont.family, fontSize: 14 }}>Aa</span>
        <ChevronDown />
      </button>

      {open && (
        <div className="reader-font-menu">
          <div className="reader-font-menu-label">Reading Font</div>
          {READER_FONTS.map((f) => (
            <button
              key={f.id}
              className={`reader-font-opt${f.id === currentFont.id ? ' selected' : ''}`}
              style={{ fontFamily: f.family }}
              onClick={() => {
                onFontChange(f);
                setOpen(false);
              }}
            >
              {f.label}
            </button>
          ))}
          <div className="reader-font-size-row">
            <div className="reader-font-menu-label" style={{ padding: 0, margin: 0, flexShrink: 0 }}>
              Size
            </div>
            <button
              className="reader-font-size-btn"
              onClick={() => onFontSizeChange(Math.max(MIN_FONT_SIZE, fontSize - 1))}
              disabled={fontSize <= MIN_FONT_SIZE}
            >
              -
            </button>
            <span className="reader-font-size-val">{fontSize}</span>
            <button
              className="reader-font-size-btn"
              onClick={() => onFontSizeChange(Math.min(MAX_FONT_SIZE, fontSize + 1))}
              disabled={fontSize >= MAX_FONT_SIZE}
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function ReaderChrome({
  title,
  pipelineStatus,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
  onClose,
  readingFont,
  fontSize,
  onFontChange,
  onFontSizeChange,
}: ReaderChromeProps) {
  return (
    <header className="reader-chrome">
      {/* Close */}
      <button
        className="reader-chrome-btn"
        onClick={onClose}
        title="Close (Esc)"
      >
        <CloseIcon />
      </button>

      <div className="reader-chrome-sep" />

      {/* Contents toggle */}
      <button
        className={`reader-chrome-btn${leftOpen ? ' active' : ''}`}
        onClick={onToggleLeft}
        title="Contents (T)"
      >
        <ContentsIcon />
        Contents
      </button>

      {/* Title */}
      <div className="reader-chrome-title">{title}</div>

      {/* Engine toggle */}
      <button
        className={`reader-chrome-btn${rightOpen ? ' active' : ''}`}
        onClick={onToggleRight}
        title="Engine (E)"
      >
        Engine
        <EngineIcon />
      </button>

      <div className="reader-chrome-sep" />

      {/* Right cluster: font picker + pipeline */}
      <div className="reader-chrome-right">
        <FontPicker
          currentFont={readingFont}
          fontSize={fontSize}
          onFontChange={onFontChange}
          onFontSizeChange={onFontSizeChange}
        />
        <PipelineDots status={pipelineStatus} />
      </div>
    </header>
  );
}
