'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

export default function EventBadge({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const summary = readString(object.body) ?? readString(object.og_description) ?? readString(object.explanation);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const eventDate = object.captured_at ? parseDate(object.captured_at) : null;
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-event" data-type="event" data-compact={compact || undefined} {...handler}>
        {!compact && eventDate && (
          <div className="cp-obj-event-date">
            <span className="cp-obj-event-month">{eventDate.month}</span>
            <span className="cp-obj-event-day">{eventDate.day}</span>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cp-obj-title">{title}</div>
          {!compact && summary && <div className="cp-obj-body" style={{ WebkitLineClamp: 2 }}>{summary}</div>}
        </div>
        {compact && timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-event" data-type="event" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-event" data-type="event" {...handler}>
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
      <button type="button" className="cp-obj cp-obj--dock cp-obj-event" data-type="event" {...handler}>
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

  /* Default variant */
  const date = object.captured_at ? parseDate(object.captured_at) : null;
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'flex', alignItems: 'stretch', width: '100%', textAlign: 'left',
        background: 'var(--cp-card)', border: 'none', borderLeft: '3px solid var(--cp-accent)',
        borderRadius: '0 6px 6px 0', overflow: 'hidden', cursor: 'pointer',
      }}
      className="cp-object-card cp-object-event"
    >
      {date && !compact && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRight: '1px solid var(--cp-border-faint)', minWidth: 44 }}>
          <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--cp-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', lineHeight: 1, fontFeatureSettings: 'var(--cp-kern-mono)' }}>{date.month}</span>
          <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--cp-text)', lineHeight: 1.1, fontFeatureSettings: 'var(--cp-kern-mono)' }}>{date.day}</span>
        </div>
      )}
      <div style={{ padding: compact ? '8px 10px' : '10px 12px', flex: 1 }}>
        <div style={{ fontFamily: 'var(--cp-font-title)', fontSize: compact ? 13 : 15, fontWeight: 500, color: 'var(--cp-text)', lineHeight: 1.3, fontFeatureSettings: 'var(--cp-kern-title)' }}>{title}</div>
        {!compact && object.body && (
          <div style={{ fontFamily: 'var(--cp-font-body)', fontSize: 12, color: 'var(--cp-text-muted)', lineHeight: 1.5, fontFeatureSettings: 'var(--cp-kern-body)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{object.body}</div>
        )}
      </div>
    </button>
  );
}

function parseDate(iso: string): { month: string; day: string } | null {
  try {
    const d = new Date(iso);
    return { month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(), day: String(d.getDate()) };
  } catch {
    return null;
  }
}
