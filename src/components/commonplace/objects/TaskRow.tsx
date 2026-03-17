'use client';

import type { ObjectCardProps } from './ObjectRenderer';
export default function TaskRow({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const done = object.status === 'done' || object.status === 'complete' || object.status === 'completed';
  const title = object.display_title ?? object.title;

  return (
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: 'none',
        borderRadius: 6,
        padding: compact ? '7px 10px' : '10px 12px',
        cursor: 'pointer',
        opacity: done ? 0.6 : 1,
      }}
      className="cp-object-card cp-object-task"
    >
      <div style={{
        width: 15,
        height: 15,
        borderRadius: 3,
        border: `1.5px solid ${done ? 'var(--cp-accent)' : 'var(--cp-border-faint)'}`,
        background: done ? 'var(--cp-accent)' : 'transparent',
        flexShrink: 0,
        marginTop: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {done && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: compact ? 13 : 14,
          fontWeight: 400,
          color: 'var(--cp-text)',
          lineHeight: 1.35,
          fontFeatureSettings: 'var(--cp-kern-body)',
          textDecoration: done ? 'line-through' : 'none',
          textDecorationColor: 'var(--cp-text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: compact ? 'nowrap' : 'normal',
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
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {object.body}
          </div>
        )}
      </div>
    </button>
  );
}
