'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

/**
 * NoteCard: hand-drawn rough.js border, cream wash background, no rotation.
 * rough.js loaded dynamically to avoid SSR issues (~30KB gzipped).
 */

function useRoughBorder(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  seed: number,
) {
  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < 1 || h < 1) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.min(w * dpr, 8192);
    canvas.height = Math.min(h * dpr, 8192);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const rough = (await import('roughjs')).default;
    const rc = rough.canvas(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    rc.rectangle(2, 2, w - 4, h - 4, {
      roughness: 1.8,
      bowing: 2,
      stroke: 'rgba(212,204,196,0.35)',
      strokeWidth: 1.5,
      seed,
    });
  }, [canvasRef, wrapperRef, seed]);

  useEffect(() => {
    draw();
    const observer = new ResizeObserver(() => draw());
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [draw, wrapperRef]);
}

export default function NoteCard({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const summary = readString(object.body) ?? readString(object.og_description) ?? readString(object.explanation);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const tags = readStringArray(object.tags);
  const provenance = readString(object.source_label);

  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  // Seed from object ID for stable sketch across re-renders
  const seed = object.id;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useRoughBorder(canvasRef, wrapperRef, seed);

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-note" data-type="note" data-compact={compact || undefined} {...handler}>
        <div className="cp-obj-title">{title}</div>
        {!compact && summary && <div className="cp-obj-body">{summary}</div>}
        {(timestamp || edgeCount > 0) && (
          <div className="cp-obj-meta" style={{ marginTop: compact ? 3 : 4 }}>
            {timestamp && <span className="cp-obj-timestamp" style={{ color: 'var(--cp-text-faint)' }}>{timestamp}</span>}
            {edgeCount > 0 && <span className="cp-obj-edges" style={{ marginLeft: 'auto', color: 'var(--cp-text-faint)' }}>{edgeCount} links</span>}
          </div>
        )}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-note" data-type="note" {...handler}>
        <span className="cp-obj-dot" style={{ background: '#D4CCC4' }} />
        <span className="cp-obj-title">{title}</span>
        {provenance && <span className="cp-obj-provenance">{provenance}</span>}
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-note" data-type="note" {...handler}>
        <span className="cp-obj-dot" style={{ background: '#D4CCC4' }} />
        <span className="cp-obj-title">{title}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
    const supportingSignals = readStringArray(object.supporting_signal_labels);
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-note" data-type="note" {...handler}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span className="cp-obj-type-badge"><span className="cp-obj-dot" />{identity.label}</span>
          {score && <span className="cp-obj-edges" style={{ color: 'var(--cp-text-faint)', fontSize: 10 }}>{score}</span>}
        </div>
        <div className="cp-obj-title">{title}</div>
        {signalLabel && <div className="cp-obj-signal">{signalLabel}</div>}
        {summary && <div className="cp-obj-body">{summary}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {supportingSignals.slice(0, 2).map((s) => (
            <span key={`${object.slug}-${s}`} className="cp-obj-supporting-signal">{s}</span>
          ))}
          {edgeCount > 0 && <span className="cp-obj-edges" style={{ marginLeft: 'auto', color: 'var(--cp-text-faint)', fontSize: 10 }}>{edgeCount} links</span>}
        </div>
      </button>
    );
  }

  /* Default variant: rough.js hand-drawn border, cream wash */
  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      {/* rough.js canvas overlay */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: -1,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <button
        type="button"
        {...handler}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'var(--cp-note-wash, rgba(212,204,196,0.06))',
          border: 'none',
          borderRadius: 6,
          padding: compact ? '8px 10px' : '12px 14px',
          cursor: 'pointer',
          position: 'relative',
          zIndex: 0,
        }}
        className="cp-object-card cp-object-note"
      >
        <div style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: compact ? 14 : 16,
          fontWeight: 500,
          color: 'var(--cp-text)',
          lineHeight: 1.3,
          fontFeatureSettings: 'var(--cp-kern-title)',
          marginBottom: summary ? 6 : 0,
        }}>{title}</div>
        {!compact && summary && (
          <div style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 13,
            color: 'var(--cp-text-muted)',
            lineHeight: 1.55,
            fontFeatureSettings: 'var(--cp-kern-body)',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: 8,
          }}>{summary}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {tags.length > 0 && tags.slice(0, 3).map((t) => (
            <span key={t} style={{
              fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)',
              background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3,
            }}>{t}</span>
          ))}
          {provenance && (
            <span style={{
              fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)',
              background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3,
            }}>{provenance}</span>
          )}
          {timestamp && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)' }}>{timestamp}</span>}
          {edgeCount > 0 && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', marginLeft: 'auto' }}>{edgeCount} links</span>}
        </div>
      </button>
    </div>
  );
}
