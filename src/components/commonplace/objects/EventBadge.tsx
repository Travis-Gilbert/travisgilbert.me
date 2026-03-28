'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

const EVENT_BLUE = 'var(--cp-event-color, #4A7A9A)';

function parseDate(iso: string): { month: string; day: string; dayOfWeek: string } | null {
  try {
    const d = new Date(iso);
    return {
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: String(d.getDate()),
      dayOfWeek: d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase(),
    };
  } catch {
    return null;
  }
}

/* Mini calendar block: month header strip, day number, optional day-of-week */
function CalendarBlock({ date, size }: { date: { month: string; day: string; dayOfWeek: string }; size: 'chip' | 'card' | 'expanded' }) {
  const config = {
    chip: { width: 26, monthFont: 7, dayFont: 12, showDow: false },
    card: { width: 40, monthFont: 8, dayFont: 17, showDow: true },
    expanded: { width: 54, monthFont: 9, dayFont: 24, showDow: true },
  }[size];

  return (
    <div style={{
      width: config.width, borderRadius: 5, overflow: 'hidden', flexShrink: 0,
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Month strip */}
      <div style={{
        background: EVENT_BLUE, padding: '2px 0', textAlign: 'center',
        fontFamily: 'var(--cp-font-mono)', fontSize: config.monthFont,
        fontWeight: 700, color: '#fff', textTransform: 'uppercase',
        letterSpacing: '0.05em', lineHeight: 1.4,
      }}>{date.month}</div>
      {/* Day number */}
      <div style={{
        background: 'var(--cp-card)', textAlign: 'center',
        padding: size === 'chip' ? '1px 0' : '2px 0',
      }}>
        <div style={{
          fontFamily: size === 'expanded' ? 'var(--cp-font-title)' : 'var(--cp-font-mono)',
          fontSize: config.dayFont,
          fontWeight: 700,
          color: 'var(--cp-text)',
          lineHeight: 1.2,
        }}>{date.day}</div>
        {config.showDow && (
          <div style={{
            fontFamily: 'var(--cp-font-mono)', fontSize: size === 'expanded' ? 9 : 8,
            color: 'var(--cp-text-dim)', lineHeight: 1.3, marginTop: 1,
          }}>{date.dayOfWeek}</div>
        )}
      </div>
    </div>
  );
}

export default function EventBadge({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const summary = readString(object.body) ?? readString(object.og_description) ?? readString(object.explanation);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const eventDate = object.captured_at ? parseDate(object.captured_at) : null;
  const timeDisplay = readString(object.event_time);
  const provenance = readString(object.source_label);
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-event" data-type="event" data-compact={compact || undefined} {...handler}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
      >
        {!compact && eventDate && <CalendarBlock date={eventDate} size="card" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cp-obj-title">{title}</div>
          {timeDisplay && (
            <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 12, color: EVENT_BLUE, fontWeight: 600, marginTop: 2 }}>{timeDisplay}</div>
          )}
          {!compact && summary && <div className="cp-obj-body" style={{ WebkitLineClamp: 2 }}>{summary}</div>}
        </div>
        {compact && timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-event" data-type="event" {...handler}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {eventDate && <CalendarBlock date={eventDate} size="chip" />}
        <span className="cp-obj-title">{title}</span>
        {provenance && <span className="cp-obj-provenance">{provenance}</span>}
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-event" data-type="event" {...handler}>
        {eventDate && <CalendarBlock date={eventDate} size="chip" />}
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

  /* Default (card) variant: calendar block left, content right */
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', textAlign: 'left',
        background: 'var(--cp-card)', border: 'none', borderRadius: 6,
        padding: compact ? '8px 10px' : '10px 12px', cursor: 'pointer',
      }}
      className="cp-object-card cp-object-event"
    >
      {eventDate && !compact && <CalendarBlock date={eventDate} size="card" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--cp-font-title)', fontSize: compact ? 13 : 15, fontWeight: 500,
          color: 'var(--cp-text)', lineHeight: 1.3,
        }}>{title}</div>
        {timeDisplay && (
          <div style={{
            fontFamily: 'var(--cp-font-mono)', fontSize: 13, color: EVENT_BLUE,
            fontWeight: 600, marginTop: 3,
          }}>{timeDisplay}</div>
        )}
        {!compact && summary && (
          <div style={{
            fontFamily: 'var(--cp-font-body)', fontSize: 12, color: 'var(--cp-text-muted)',
            lineHeight: 1.5, marginTop: 4,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{summary}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          {provenance && (
            <span style={{
              fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)',
              background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3,
            }}>{provenance}</span>
          )}
          {edgeCount > 0 && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', marginLeft: 'auto' }}>{edgeCount} links</span>}
        </div>
      </div>
    </button>
  );
}
