'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

const QUOTE_ACCENT = 'var(--cp-quote-accent, #C4884A)';

export default function QuoteBlock({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const text = object.display_title ?? object.title;
  const attribution = readString(object.body);
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const provenance = readString(object.source_label);
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-quote" data-type="quote" data-compact={compact || undefined} {...handler}
        style={{ borderLeft: `3px solid ${QUOTE_ACCENT}`, borderRadius: '0 6px 6px 0' }}
      >
        <div className="cp-obj-title" style={{ fontFamily: 'var(--cp-font-title)', fontStyle: 'italic', fontSize: 14 }}>{`\u201C${text}\u201D`}</div>
        {attribution && <div style={{ fontFamily: 'var(--cp-font-title)', fontStyle: 'italic', fontSize: 12, color: QUOTE_ACCENT, marginTop: 4 }}>{attribution}</div>}
        <div className="cp-obj-meta" style={{ marginTop: compact ? 3 : 5 }}>
          {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
          {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount} links</span>}
        </div>
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-quote" data-type="quote" {...handler}
        style={{ borderLeft: `3px solid ${QUOTE_ACCENT}`, borderRadius: '0 6px 6px 0' }}
      >
        <span className="cp-obj-title" style={{ fontSize: 12 }}>{text}</span>
        {provenance && <span className="cp-obj-provenance">{provenance}</span>}
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-quote" data-type="quote" {...handler}>
        <span className="cp-obj-dot" style={{ background: QUOTE_ACCENT }} />
        <span className="cp-obj-title">{text}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
    const supportingSignals = readStringArray(object.supporting_signal_labels);
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-quote" data-type="quote" {...handler}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span className="cp-obj-type-badge"><span className="cp-obj-dot" />{identity.label}</span>
          {score && <span className="cp-obj-edges" style={{ color: 'var(--cp-text-faint)', fontSize: 10 }}>{score}</span>}
        </div>
        <div className="cp-obj-title">{`\u201C${text}\u201D`}</div>
        {signalLabel && <div className="cp-obj-signal">{signalLabel}</div>}
        {attribution && <div className="cp-obj-body">{attribution}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {supportingSignals.slice(0, 2).map((s) => (
            <span key={`${object.slug}-${s}`} className="cp-obj-supporting-signal">{s}</span>
          ))}
          {edgeCount > 0 && <span className="cp-obj-edges" style={{ marginLeft: 'auto', color: 'var(--cp-text-faint)', fontSize: 10 }}>{edgeCount} links</span>}
        </div>
      </button>
    );
  }

  /* Default (card) variant: heavy left border, italic Vollkorn body */
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'block', width: '100%', textAlign: 'left', background: 'var(--cp-card)', border: 'none',
        borderLeft: `3px solid ${QUOTE_ACCENT}`, borderRadius: '0 6px 6px 0',
        padding: compact ? '8px 10px' : '12px 16px', cursor: 'pointer',
      }}
      className="cp-object-card cp-object-quote"
    >
      <div style={{
        fontFamily: 'var(--cp-font-title)', fontSize: compact ? 13 : 14, fontWeight: 400, fontStyle: 'italic',
        color: 'var(--cp-text)', lineHeight: 1.45,
        marginBottom: attribution && !compact ? 8 : 0, display: '-webkit-box',
        WebkitLineClamp: compact ? 2 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{text}</div>
      {!compact && attribution && (
        <div style={{
          fontFamily: 'var(--cp-font-title)', fontSize: 12, fontStyle: 'italic',
          color: QUOTE_ACCENT, lineHeight: 1.4,
        }}>{attribution}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
        {provenance && (
          <span style={{
            fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)',
            background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3,
          }}>{provenance}</span>
        )}
        {edgeCount > 0 && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', marginLeft: 'auto' }}>{edgeCount} links</span>}
      </div>
    </button>
  );
}
