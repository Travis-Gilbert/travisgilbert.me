'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

export default function HunchSticky({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const summary = readString(object.body) ?? readString(object.explanation);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const provenance = readString(object.source_label);
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  /* Dashed border style shared across tiers */
  const dashedBorder = '1px dashed var(--cp-hunch-border, rgba(180,90,106,0.4))';
  const hunchWash = 'var(--cp-hunch-wash, color-mix(in srgb, #B45A6A 4%, var(--cp-card)))';

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-hunch" data-type="hunch" data-compact={compact || undefined} {...handler}
        style={{ border: dashedBorder, background: hunchWash }}
      >
        <div className="cp-obj-title">{title}</div>
        {!compact && summary && <div className="cp-obj-body">{summary}</div>}
        <div className="cp-obj-meta" style={{ marginTop: compact ? 3 : 5 }}>
          {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
          {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount} links</span>}
        </div>
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-hunch" data-type="hunch" {...handler}
        style={{ border: dashedBorder, background: hunchWash }}
      >
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {provenance && <span className="cp-obj-provenance">{provenance}</span>}
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-hunch" data-type="hunch" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
    const supportingSignals = readStringArray(object.supporting_signal_labels);
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-hunch" data-type="hunch" {...handler}>
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

  /* Default variant: dashed border, hunch wash, no rotation */
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: hunchWash,
        border: dashedBorder,
        borderRadius: 6,
        padding: compact ? '8px 10px' : '12px 14px',
        cursor: 'pointer',
      }}
      className="cp-object-card cp-object-hunch"
    >
      <div style={{
        fontFamily: 'var(--cp-font-title)', fontSize: compact ? 13 : 15, fontWeight: 400, fontStyle: 'italic',
        color: 'var(--cp-text)', lineHeight: 1.4,
        marginBottom: summary && !compact ? 6 : 0,
      }}>{title}</div>
      {!compact && summary && (
        <div style={{
          fontFamily: 'var(--cp-font-body)', fontSize: 12, fontStyle: 'italic', color: 'var(--cp-text-muted)',
          lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          marginBottom: 8,
        }}>{summary}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        {provenance && (
          <span style={{
            fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)',
            background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3,
          }}>{provenance}</span>
        )}
        {edgeCount > 0 && (
          <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', marginLeft: 'auto' }}>{edgeCount} links</span>
        )}
      </div>
    </button>
  );
}
