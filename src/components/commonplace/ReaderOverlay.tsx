'use client';

/**
 * ReaderOverlay: full-screen reading surface for CommonPlace objects.
 *
 * Fixed-position overlay (z-index 9999) that renders when the context's
 * readerObjectId is non-null. Fetches object data, parses markdown into
 * typed paragraphs, and provides keyboard navigation, highlighting,
 * and panel toggling.
 *
 * State owned here:
 *   leftOpen / rightOpen (panel visibility)
 *   fontSize / readingFont (font settings)
 *   focusIdx (keyboard focus)
 *   highlights (Map<paragraphId, ReaderHighlight[]>)
 *   progress (scroll percentage)
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useCommonPlace } from '@/lib/commonplace-context';
import { fetchObjectById, useApiData } from '@/lib/commonplace-api';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { ReaderFont, ReaderHighlight } from './reader-data';
import { DEFAULT_FONT, DEFAULT_FONT_SIZE } from './reader-data';
import { parseBodyToParagraphs, wordCount, formatReadTime } from './reader-utils';
import ReaderChrome from './ReaderChrome';
import ReaderFooter from './ReaderFooter';
import ReaderPanelToc from './ReaderPanelToc';
import ReaderPanelEngine from './ReaderPanelEngine';
import ReaderSelectionPopover from './ReaderSelectionPopover';
import type { HighlightAction } from './reader-data';

/* ─────────────────────────────────────────────────
   Scroll behavior: respect prefers-reduced-motion
   ───────────────────────────────────────────────── */

function getScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'smooth';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

/* ─────────────────────────────────────────────────
   Focus trap hook
   ───────────────────────────────────────────────── */

function useFocusTrap(containerRef: RefObject<HTMLDivElement | null>, active: boolean) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store the element that triggered the overlay
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Focus the overlay container
    const container = containerRef.current;
    if (container) {
      container.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to the trigger element
      triggerRef.current?.focus();
    };
  }, [active, containerRef]);
}

/* ─────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────── */

/** Extract a pipeline status from the object's status field. */
function derivePipelineStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes('promoted')) return 'promoted';
  if (normalized.includes('review')) return 'reviewed';
  if (normalized.includes('extract')) return 'extracted';
  if (normalized.includes('pars')) return 'parsed';
  return 'captured';
}

/** Extract the site name from a URL. */
function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function ReaderOverlay() {
  const { readerObjectId, closeReader } = useCommonPlace();

  /* ── Reader-local state ── */
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [readingFont, setReadingFont] = useState<ReaderFont>(DEFAULT_FONT);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [highlights, setHighlights] = useState<Map<string, ReaderHighlight[]>>(new Map());
  const [progress, setProgress] = useState(0);

  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Fetch object data when readerObjectId changes ── */
  const {
    data: detail,
    loading,
    error,
  } = useApiData(
    () => fetchObjectById(readerObjectId!),
    [readerObjectId],
  );

  /* ── Parse paragraphs from body ── */
  const paragraphs = useMemo(
    () => (detail?.body ? parseBodyToParagraphs(detail.body) : []),
    [detail?.body],
  );

  const words = useMemo(
    () => wordCount(detail?.body || ''),
    [detail?.body],
  );

  const typeIdentity = useMemo(
    () => detail ? getObjectTypeIdentity(detail.object_type_data.slug) : null,
    [detail],
  );

  const pipelineStatus = useMemo(
    () => detail ? derivePipelineStatus(detail.status) : 'captured',
    [detail],
  );

  /* ── Highlight helpers ── */
  const highlightCount = useMemo(() => {
    let count = 0;
    highlights.forEach((list) => { count += list.length; });
    return count;
  }, [highlights]);

  const toggleHighlight = useCallback((paraId: string, text: string) => {
    setHighlights((prev) => {
      const next = new Map(prev);
      const existing = next.get(paraId) || [];
      if (existing.length > 0) {
        // Remove all highlights on this paragraph (toggle off)
        next.delete(paraId);
      } else {
        next.set(paraId, [
          { paragraphId: paraId, text, action: 'highlight', timestamp: Date.now() },
        ]);
      }
      return next;
    });
  }, []);

  /** Scroll to a paragraph by ID and focus it. */
  const scrollToParagraph = useCallback((paragraphId: string) => {
    const idx = paragraphs.findIndex((p) => p.id === paragraphId);
    if (idx < 0) return;
    setFocusIdx(idx);
    const el = scrollRef.current;
    if (!el) return;
    const paraEl = el.querySelector(`[data-pid="${paragraphId}"]`) as HTMLElement | null;
    if (paraEl) {
      paraEl.scrollIntoView({ block: 'center', behavior: getScrollBehavior() });
    }
  }, [paragraphs]);

  /** Handle selection popover actions. */
  const handleSelectionAction = useCallback(
    (paragraphId: string, text: string, action: HighlightAction) => {
      // All actions save a highlight; future batches can differentiate
      setHighlights((prev) => {
        const next = new Map(prev);
        const existing = next.get(paragraphId) || [];
        next.set(paragraphId, [
          ...existing,
          { paragraphId, text, action, timestamp: Date.now() },
        ]);
        return next;
      });
    },
    [],
  );

  /* ── Scroll progress (rAF throttled) ── */
  const rafRef = useRef(0);
  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el) return;
      const total = el.scrollHeight - el.clientHeight;
      if (total <= 0) {
        setProgress(100);
        return;
      }
      setProgress(Math.min(100, Math.max(0, (el.scrollTop / total) * 100)));
    });
  }, []);

  /* ── Focus navigation ── */
  const scrollToFocused = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const paraEl = el.querySelector(`[data-idx="${idx}"]`) as HTMLElement | null;
    if (paraEl) {
      paraEl.scrollIntoView({ block: 'center', behavior: getScrollBehavior() });
    }
  }, []);

  const focusNext = useCallback(() => {
    setFocusIdx((prev) => {
      const next = Math.min(prev + 1, paragraphs.length - 1);
      scrollToFocused(next);
      return next;
    });
  }, [paragraphs.length, scrollToFocused]);

  const focusPrev = useCallback(() => {
    setFocusIdx((prev) => {
      const next = Math.max(prev - 1, 0);
      scrollToFocused(next);
      return next;
    });
  }, [scrollToFocused]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    if (readerObjectId === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't capture when user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          closeReader();
          break;
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          focusNext();
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          focusPrev();
          break;
        case 'h':
          if (focusIdx >= 0 && focusIdx < paragraphs.length) {
            const para = paragraphs[focusIdx];
            toggleHighlight(para.id, para.text);
          }
          break;
        case 't':
          setLeftOpen((v) => !v);
          break;
        case 'e':
          setRightOpen((v) => !v);
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [readerObjectId, closeReader, focusNext, focusPrev, focusIdx, paragraphs, toggleHighlight]);

  /* ── Reset per-object state when navigating (preserve panel open state) ── */
  useEffect(() => {
    setFocusIdx(-1);
    setHighlights(new Map());
    setProgress(0);
  }, [readerObjectId]);

  /* ── Focus trap ── */
  useFocusTrap(overlayRef, readerObjectId !== null);

  /* ── Don't render when closed ── */
  if (readerObjectId === null) return null;

  return (
    <div ref={overlayRef} className="reader-overlay" role="dialog" aria-modal="true" aria-label="Reader" tabIndex={-1}>
      {/* Progress bar */}
      <div className="reader-progress">
        <div className="reader-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Top chrome */}
      <ReaderChrome
        title={detail?.display_title || detail?.title || ''}
        pipelineStatus={pipelineStatus}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
        onClose={closeReader}
        readingFont={readingFont}
        fontSize={fontSize}
        onFontChange={setReadingFont}
        onFontSizeChange={setFontSize}
      />

      {/* Body: left panel | reading column | right panel */}
      <div className="reader-body">
        {/* Left panel: Table of Contents + highlights */}
        <ReaderPanelToc
          open={leftOpen}
          paragraphs={paragraphs}
          focusIdx={focusIdx}
          highlights={highlights}
          onScrollToParagraph={scrollToParagraph}
        />

        {/* Reading column: clicking here closes panels */}
        <div
          className="reader-scroll"
          ref={scrollRef}
          onScroll={handleScroll}
          onClick={() => {
            if (leftOpen) setLeftOpen(false);
            if (rightOpen) setRightOpen(false);
          }}
        >
          {/* Selection popover (positioned inside scroll container) */}
          <ReaderSelectionPopover
            scrollContainerRef={scrollRef}
            onAction={handleSelectionAction}
          />
          <div className="reader-col">
            {loading && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--r-text-faint)' }}>
                Loading...
              </div>
            )}

            {error && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--r-red)' }}>
                Failed to load object
              </div>
            )}

            {detail && !loading && (
              <>
                {/* Article header */}
                <div style={{ marginBottom: 36 }}>
                  <div className="reader-article-meta">
                    <span className="reader-type-badge">
                      {typeIdentity?.label.toUpperCase() || 'OBJECT'}
                    </span>
                    {detail.url && (
                      <span className="reader-article-domain">{siteName(detail.url)}</span>
                    )}
                    {detail.captured_at && (
                      <span className="reader-article-domain">
                        {new Date(detail.captured_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  <h1 className="reader-article-title">
                    {detail.display_title || detail.title}
                  </h1>
                  <div className="reader-article-stats">
                    <span>{formatReadTime(words)}</span>
                    <span>{words.toLocaleString()} words</span>
                  </div>
                </div>

                <div className="reader-article-rule" />

                {/* Paragraphs */}
                {paragraphs.map((para, idx) => {
                  const isFocused = idx === focusIdx;
                  const hasHl = highlights.has(para.id);
                  const classes = [
                    'reader-para',
                    isFocused ? 'focused' : '',
                    hasHl ? 'has-hl' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div
                      key={para.id}
                      className={classes}
                      data-type={para.type}
                      data-pid={para.id}
                      data-idx={idx}
                      onClick={() => setFocusIdx(idx)}
                    >
                      <div className="reader-focus-bar" />
                      <div className="reader-hl-dot" />

                      {para.type === 'heading' && (
                        <h2 style={{ fontSize: fontSize * 1.3 }}>{para.text}</h2>
                      )}

                      {para.type === 'quote' && (
                        <blockquote>
                          <p style={{ fontFamily: readingFont.family, fontSize }}>
                            {para.text}
                          </p>
                        </blockquote>
                      )}

                      {para.type === 'code' && (
                        <pre>
                          <code style={{ fontSize: fontSize * 0.9 }}>{para.text}</code>
                        </pre>
                      )}

                      {para.type === 'lead' && (
                        <p
                          className="reader-lead-text"
                          style={{ fontFamily: readingFont.family, fontSize: fontSize * 1.05 }}
                        >
                          {para.text}
                        </p>
                      )}

                      {para.type === 'body' && (
                        <p
                          className="reader-body-text"
                          style={{ fontFamily: readingFont.family, fontSize }}
                        >
                          {para.text}
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* End matter */}
                {paragraphs.length > 0 && (
                  <div className="reader-end-matter">
                    <div className="reader-end-label">End of article</div>
                    {highlightCount > 0 && (
                      <div className="reader-end-hl-count">
                        {highlightCount} highlight{highlightCount !== 1 ? 's' : ''}
                      </div>
                    )}
                    <div className="reader-end-actions">
                      <button
                        className="reader-end-btn"
                        onClick={() => setRightOpen(true)}
                      >
                        View connections
                      </button>
                      <button
                        className="reader-end-btn"
                        onClick={() => setRightOpen(true)}
                      >
                        View claims
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right panel: Claims, Entities, Graph */}
        <ReaderPanelEngine
          open={rightOpen}
          detail={detail}
          onScrollToParagraph={scrollToParagraph}
        />
      </div>

      {/* Footer */}
      <ReaderFooter
        progress={progress}
        focusIdx={focusIdx}
        totalParagraphs={paragraphs.length}
        highlightCount={highlightCount}
      />
    </div>
  );
}
