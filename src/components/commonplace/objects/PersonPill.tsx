'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

const PERSON_COLOR = 'var(--cp-person-color, #B45A2D)';

export default function PersonPill({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const name = object.display_title ?? object.title;
  const initial = name.charAt(0).toUpperCase();
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
      <button type="button" className="cp-obj cp-obj--module cp-obj-person" data-type="person" data-compact={compact || undefined} {...handler}>
        <span className="cp-obj-person-avatar"><span>{initial}</span></span>
        <span className="cp-obj-title">{name}</span>
        {(score || edgeCount > 0) && (
          <span className="cp-obj-edges" style={{ marginLeft: 'auto', flexShrink: 0 }}>{score ?? edgeCount}</span>
        )}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-person" data-type="person" {...handler}
        style={{ borderRadius: 16 }}
      >
        <Avatar size={20} fontSize={9} initial={initial} />
        <span className="cp-obj-title">{name}</span>
        {provenance && <span className="cp-obj-provenance">{provenance}</span>}
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-person" data-type="person" {...handler}>
        <Avatar size={20} fontSize={9} initial={initial} />
        <span className="cp-obj-title">{name}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
    const summary = readString(object.body) ?? readString(object.explanation);
    const supportingSignals = readStringArray(object.supporting_signal_labels);
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-person" data-type="person" {...handler}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span className="cp-obj-type-badge"><span className="cp-obj-dot" />{identity.label}</span>
          {score && <span className="cp-obj-edges" style={{ color: 'var(--cp-text-faint)', fontSize: 10 }}>{score}</span>}
        </div>
        <div className="cp-obj-title">{name}</div>
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

  /* Default (card) variant: round at every tier */
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: compact ? 8 : 10, width: '100%', textAlign: 'left',
        background: 'var(--cp-card)', border: 'none', borderRadius: 20,
        padding: compact ? '6px 10px 6px 6px' : '8px 14px 8px 8px', cursor: 'pointer',
      }}
      className="cp-object-card cp-object-person"
    >
      <Avatar size={compact ? 24 : 40} fontSize={compact ? 10 : 16} initial={initial} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--cp-font-title)', fontSize: compact ? 13 : 14, fontWeight: 500,
          color: 'var(--cp-text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{name}</div>
        {!compact && object.body && (
          <div style={{
            fontFamily: 'var(--cp-font-body)', fontSize: 11, color: 'var(--cp-text-muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1,
          }}>{object.body}</div>
        )}
      </div>
      {edgeCount > 0 && (
        <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', flexShrink: 0 }}>{edgeCount}</span>
      )}
    </button>
  );
}

function Avatar({ size, fontSize, initial }: { size: number; fontSize: number; initial: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: PERSON_COLOR,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{initial}</span>
    </div>
  );
}
