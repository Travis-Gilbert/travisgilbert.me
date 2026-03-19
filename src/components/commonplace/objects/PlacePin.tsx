'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

export default function PlacePin({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const name = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const summary = readString(object.body) ?? readString(object.explanation);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-place" data-type="place" data-compact={compact || undefined} {...handler}>
        <span className="cp-obj-place-pin" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cp-obj-title">{name}</div>
          {!compact && summary && <div className="cp-obj-body">{summary}</div>}
        </div>
        {edgeCount > 0 && <span className="cp-obj-edges" style={{ flexShrink: 0 }}>{edgeCount} links</span>}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-place" data-type="place" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{name}</span>
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-place" data-type="place" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{name}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
    const supportingSignals = readStringArray(object.supporting_signal_labels);
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-place" data-type="place" {...handler}>
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

  /* Default variant (original rendering with PinIcon) */
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'flex', alignItems: compact ? 'center' : 'flex-start', gap: 9, width: '100%', textAlign: 'left',
        background: 'var(--cp-card)', border: 'none', borderRadius: 6,
        padding: compact ? '7px 10px' : '10px 12px', cursor: 'pointer',
      }}
      className="cp-object-card cp-object-place"
    >
      <span style={{ color: 'var(--cp-accent)', flexShrink: 0, marginTop: compact ? 0 : 1 }}>
        <PinIcon size={compact ? 13 : 15} color="var(--cp-accent)" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--cp-font-title)', fontSize: compact ? 13 : 15, fontWeight: 500, color: 'var(--cp-text)',
          lineHeight: 1.3, fontFeatureSettings: 'var(--cp-kern-title)', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: compact ? 'nowrap' : 'normal',
        }}>{name}</div>
        {!compact && object.body && (
          <div style={{
            fontFamily: 'var(--cp-font-body)', fontSize: 12, color: 'var(--cp-text-muted)', lineHeight: 1.5,
            fontFeatureSettings: 'var(--cp-kern-body)', marginTop: 3, display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{object.body}</div>
        )}
      </div>
      {edgeCount > 0 && (
        <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', fontFeatureSettings: 'var(--cp-kern-mono)', flexShrink: 0, marginLeft: 'auto' }}>{edgeCount} links</span>
      )}
    </button>
  );
}

function PinIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1C4.79 1 3 2.79 3 5c0 2.1 1.75 3.63 3.5 5.5C8.25 8.63 11 7.1 11 5c0-2.21-1.79-4-4-4z" fill={color} opacity="0.9" />
      <circle cx="7" cy="5" r="1.5" fill="#fff" />
    </svg>
  );
}
