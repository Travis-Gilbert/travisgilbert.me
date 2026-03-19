'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { formatDate } from './shared';

export default function ConceptNode({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const label = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-concept" data-type="concept" data-compact={compact || undefined} {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{label}</span>
        {(score || edgeCount > 0) && (
          <span className="cp-obj-edges" style={{ marginLeft: 'auto', flexShrink: 0 }}>{score ?? edgeCount}</span>
        )}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-concept" data-type="concept" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{label}</span>
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-concept" data-type="concept" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{label}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = typeof object.signal_label === 'string' && object.signal_label.trim() ? object.signal_label : null;
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-concept" data-type="concept" {...handler}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span className="cp-obj-type-badge"><span className="cp-obj-dot" />{identity.label}</span>
          {score && <span className="cp-obj-edges" style={{ color: 'var(--cp-text-faint)', fontSize: 10 }}>{score}</span>}
        </div>
        <div className="cp-obj-title">{label}</div>
        {signalLabel && <div className="cp-obj-signal">{signalLabel}</div>}
        {edgeCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span className="cp-obj-edges" style={{ marginLeft: 'auto', color: 'var(--cp-text-faint)', fontSize: 10 }}>{edgeCount} links</span>
          </div>
        )}
      </button>
    );
  }

  /* Default variant (original rendering) */
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: 'none',
        borderRadius: 100,
        padding: compact ? '5px 10px 5px 8px' : '7px 12px 7px 10px',
        cursor: 'pointer',
        transition: 'border-color 120ms ease',
      }}
      className="cp-object-card cp-object-concept"
    >
      <span style={{ width: compact ? 6 : 8, height: compact ? 6 : 8, borderRadius: '50%', background: 'var(--cp-accent)', flexShrink: 0 }} />
      <span style={{
        fontFamily: 'var(--cp-font-mono)', fontSize: compact ? 11 : 12, fontWeight: 500, color: 'var(--cp-text)',
        fontFeatureSettings: 'var(--cp-kern-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</span>
      {edgeCount > 0 && (
        <span style={{
          fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: '#fff', fontFeatureSettings: 'var(--cp-kern-mono)',
          background: 'var(--cp-accent)', borderRadius: 100, padding: '1px 6px', flexShrink: 0, lineHeight: 1.6,
        }}>{edgeCount}</span>
      )}
    </button>
  );
}
