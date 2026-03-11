'use client';

import type { ObjectCardProps } from './ObjectRenderer';

export default function EventBadge({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const date = object.captured_at ? parseDate(object.captured_at) : null;

  return (
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: '1px solid var(--cp-border)',
        borderLeft: '3px solid var(--cp-accent)',
        borderRadius: '0 6px 6px 0',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 120ms ease',
      }}
      className="cp-object-card cp-object-event"
    >
      {date && !compact && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
          borderRight: '1px solid var(--cp-border-faint)',
          minWidth: 44,
        }}>
          <span style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--cp-accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            lineHeight: 1,
            fontFeatureSettings: 'var(--cp-kern-mono)',
          }}>
            {date.month}
          </span>
          <span style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--cp-text)',
            lineHeight: 1.1,
            fontFeatureSettings: 'var(--cp-kern-mono)',
          }}>
            {date.day}
          </span>
        </div>
      )}
      <div style={{ padding: compact ? '8px 10px' : '10px 12px', flex: 1 }}>
        <div style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: compact ? 13 : 15,
          fontWeight: 500,
          color: 'var(--cp-text)',
          lineHeight: 1.3,
          fontFeatureSettings: 'var(--cp-kern-title)',
        }}>
          {title}
        </div>
        {!compact && object.body && (
          <div style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-muted)',
            lineHeight: 1.5,
            fontFeatureSettings: 'var(--cp-kern-body)',
            marginTop: 4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {object.body}
          </div>
        )}
      </div>
    </button>
  );
}

function parseDate(iso: string): { month: string; day: string } | null {
  try {
    const d = new Date(iso);
    return {
      month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: String(d.getDate()),
    };
  } catch {
    return null;
  }
}
