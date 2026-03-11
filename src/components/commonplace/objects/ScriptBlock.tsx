'use client';

import type { ObjectCardProps } from './ObjectRenderer';

const STATUS_COLORS: Record<string, string> = {
  active: '#4ADE80',
  running: '#4ADE80',
  idle: '#94A3B8',
  error: '#F87171',
  failed: '#F87171',
  complete: '#60A5FA',
  done: '#60A5FA',
};

export default function ScriptBlock({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const status = object.status ?? 'idle';
  const dotColor = STATUS_COLORS[status] ?? STATUS_COLORS.idle;

  return (
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-term, #1A1C22)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 6,
        padding: compact ? '8px 10px' : '11px 14px',
        cursor: 'pointer',
        transition: 'border-color 120ms ease',
      }}
      className="cp-object-card cp-object-script"
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        marginBottom: object.body && !compact ? 6 : 0,
      }}>
        <span style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          boxShadow: `0 0 6px ${dotColor}60`,
        }} />
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: compact ? 12 : 13,
          fontWeight: 500,
          color: 'var(--cp-term-text, #C0C8D8)',
          lineHeight: 1.3,
          fontFeatureSettings: 'var(--cp-kern-mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {title}
        </span>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 9,
          color: dotColor,
          fontFeatureSettings: 'var(--cp-kern-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          flexShrink: 0,
        }}>
          {status}
        </span>
      </div>
      {!compact && object.body && (
        <div style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'rgba(192, 200, 216, 0.5)',
          lineHeight: 1.55,
          fontFeatureSettings: 'var(--cp-kern-mono)',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {object.body}
        </div>
      )}
    </button>
  );
}
