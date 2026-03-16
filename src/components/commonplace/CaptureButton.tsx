'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { OBJECT_TYPES } from '@/lib/commonplace';
import type { CapturedObject } from '@/lib/commonplace';
import {
  createCapturedObject,
  isUrl,
} from '@/lib/commonplace-capture';
import { scrapeUrl } from '@/lib/commonplace-scrape';
import type { ScrapeState } from '@/lib/commonplace-scrape';
import { useCommonPlace } from '@/lib/commonplace-context';

/**
 * CaptureButton: spring-animated sidebar capture input.
 *
 * Collapsed state: 40px bar with cycling placeholder text.
 * Click springs open with textarea + type selector.
 * Esc or outside click collapses back.
 *
 * URL enrichment: when the input contains a URL, a 600ms debounce
 * fires a scrape request via /api/scrape (Firecrawl proxy). The bar
 * shows a preview card (favicon, title, domain, description snippet)
 * before the user commits. On CAPTURE the scraped markdown is stored
 * as the Object body, so the resulting Object is immediately rich
 * with no backend polling cycle needed.
 *
 * Graceful degradation: if Firecrawl is unavailable or the scrape
 * times out, the bar falls back silently to a plain URL capture.
 * The CAPTURE button is disabled only while the scrape is in flight.
 */

interface CaptureButtonProps {
  onCapture: (object: CapturedObject) => void;
}

const SCRAPE_DEBOUNCE_MS = 600;

export default function CaptureButton({ onCapture }: CaptureButtonProps) {
  const { requestView } = useCommonPlace();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [scrape, setScrape] = useState<ScrapeState>({
    status: 'idle',
    preview: null,
    error: null,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /* ── URL scrape debounce ── */
  useEffect(() => {
    const trimmed = text.trim();

    if (!isUrl(trimmed)) {
      if (scrapeTimerRef.current) clearTimeout(scrapeTimerRef.current);
      setScrape({ status: 'idle', preview: null, error: null });
      return;
    }

    if (scrapeTimerRef.current) clearTimeout(scrapeTimerRef.current);
    setScrape({ status: 'loading', preview: null, error: null });

    scrapeTimerRef.current = setTimeout(async () => {
      try {
        const preview = await scrapeUrl(trimmed);
        setScrape({ status: 'success', preview, error: null });
      } catch (err) {
        // Fall back silently: user can still capture the plain URL
        setScrape({
          status: 'error',
          preview: null,
          error: err instanceof Error ? err.message : 'Scrape failed',
        });
      }
    }, SCRAPE_DEBOUNCE_MS);

    return () => {
      if (scrapeTimerRef.current) clearTimeout(scrapeTimerRef.current);
    };
  }, [text]);

  /* ── Reset and close ── */
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setScrape({ status: 'idle', preview: null, error: null });
    setText('');
    setSelectedType(null);
  }, []);

  /* ── Submit capture ── */
  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const detectedUrl = isUrl(trimmed);
    const preview = scrape.preview;

    const object = createCapturedObject({
      text: trimmed,
      objectType: selectedType ?? (detectedUrl ? 'source' : undefined),
      captureMethod: 'typed',
      sourceUrl: detectedUrl ? trimmed : undefined,
      scrapedTitle: preview?.title || undefined,
      scrapedBody: preview?.markdown || undefined,
    });

    onCapture(object);
    handleClose();
  }, [text, selectedType, scrape.preview, onCapture, handleClose]);

  /* ── Keyboard: Enter to submit, Esc to close ── */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, handleClose],
  );

  const hasUrl = isUrl(text.trim());
  const detectedType =
    selectedType ?? (text.trim() ? (hasUrl ? 'source' : null) : null);
  const canCapture = !!text.trim() && scrape.status !== 'loading';

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
          padding: '10px 12px',
          border: '1px solid var(--cp-sidebar-border)',
          borderRadius: 4,
          background: 'rgba(255,255,255,0.03)',
          color: 'var(--cp-sidebar-text-faint)',
          fontFamily: 'var(--cp-font-body)',
          fontSize: 12,
          cursor: 'text',
          textAlign: 'left',
          transition: 'border-color 200ms, background-color 200ms',
          minHeight: 40,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            color: 'var(--cp-sidebar-text-faint)',
            fontSize: 14,
            lineHeight: 1,
            flexShrink: 0,
            opacity: 0.8,
          }}
        >
          +
        </span>
        <span
          style={{
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          Capture...
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
        border: '1px solid var(--cp-sidebar-border-strong)',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
        animation: 'cp-spring-open 350ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Input area: shrinks to 1 row when a URL is detected */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Capture anything..."
        rows={hasUrl ? 1 : 3}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: 'none',
          background: 'transparent',
          color: 'var(--cp-sidebar-text)',
          fontFamily: hasUrl ? 'var(--cp-font-mono)' : 'var(--cp-font-body)',
          fontSize: hasUrl ? 11 : 14,
          resize: 'none',
          outline: 'none',
          lineHeight: 1.6,
          opacity: hasUrl ? 0.5 : 1,
          transition: 'font-size 200ms, opacity 200ms',
        }}
      />

      {/* URL preview card */}
      {hasUrl && (scrape.status === 'loading' || scrape.status === 'success') && (
        <UrlPreviewCard scrape={scrape} url={text.trim()} />
      )}

      {/* Soft error: scrape failed, capture still works */}
      {hasUrl && scrape.status === 'error' && (
        <div
          style={{
            padding: '6px 12px',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-sidebar-text-faint)',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          Could not fetch page content. Will capture URL only.
        </div>
      )}

      {/* Object type selector: only shown for non-URL text */}
      {!hasUrl && (
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
                    ? `1px solid ${t.color}55`
                    : '1px solid rgba(255,255,255,0.04)',
                background:
                  detectedType === t.slug
                    ? `${t.color}18`
                    : 'rgba(255,255,255,0.02)',
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
      )}

      {/* Action row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '0 8px 8px',
          gap: 6,
          borderTop: hasUrl ? '1px solid rgba(255,255,255,0.04)' : 'none',
        }}
      >
        <button
          type="button"
          onClick={handleClose}
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

        {/* EXPAND button: only for non-URL text that can become a composition */}
        {text.trim() && !hasUrl && (
          <button
            type="button"
            onClick={() => {
              requestView('compose', 'Compose', {
                prefillText: text.trim(),
                prefillType: selectedType ?? undefined,
              });
              handleClose();
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
          disabled={!canCapture}
          style={{
            padding: '4px 14px',
            borderRadius: 4,
            border: '1px solid var(--cp-sidebar-border-strong)',
            background: canCapture
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.02)',
            color: canCapture
              ? 'var(--cp-sidebar-text)'
              : 'var(--cp-sidebar-text-faint)',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.05em',
            cursor: canCapture ? 'pointer' : 'default',
            transition: 'background-color 200ms',
          }}
        >
          {scrape.status === 'loading' ? '...' : 'CAPTURE'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   URL Preview Card
   Shown while loading and after a successful scrape.
   Displays favicon, domain, title, and description.
   ───────────────────────────────────────────────── */

function UrlPreviewCard({
  scrape,
  url,
}: {
  scrape: ScrapeState;
  url: string;
}) {
  const domain = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  })();

  const isLoading = scrape.status === 'loading';
  const preview = scrape.preview;

  return (
    <div
      style={{
        margin: '0 8px 8px',
        padding: '8px 10px',
        borderRadius: 4,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.03)',
        opacity: isLoading ? 0.6 : 1,
        transition: 'opacity 200ms',
      }}
    >
      {/* Header: favicon + domain + status indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: preview?.title ? 5 : 0,
        }}
      >
        {preview?.favicon && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview.favicon}
            alt=""
            width={12}
            height={12}
            style={{ borderRadius: 2, flexShrink: 0 }}
          />
        )}

        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'var(--cp-sidebar-text-faint)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {domain}
        </span>

        {isLoading && (
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'var(--cp-sidebar-text-faint)',
              letterSpacing: '0.04em',
            }}
          >
            fetching...
          </span>
        )}

        {!isLoading && preview && (
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'rgba(100, 200, 120, 0.7)',
              letterSpacing: '0.04em',
            }}
          >
            ready
          </span>
        )}
      </div>

      {/* Page title */}
      {preview?.title && (
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--cp-sidebar-text)',
            lineHeight: 1.4,
            marginBottom: preview.description ? 3 : 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {preview.title}
        </div>
      )}

      {/* Description snippet */}
      {preview?.description && (
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 11,
            color: 'var(--cp-sidebar-text-muted)',
            lineHeight: 1.5,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {preview.description}
        </div>
      )}

      {/* Content volume indicator */}
      {preview?.markdown && (
        <div
          style={{
            marginTop: 5,
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'var(--cp-sidebar-text-faint)',
            letterSpacing: '0.03em',
          }}
        >
          {Math.round(preview.markdown.length / 1000)}k chars captured
        </div>
      )}
    </div>
  );
}
