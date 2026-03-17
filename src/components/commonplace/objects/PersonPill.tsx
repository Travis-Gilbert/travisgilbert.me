'use client';

import type { ObjectCardProps } from './ObjectRenderer';
export default function PersonPill({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const name = object.display_title ?? object.title;
  const initial = name.charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 8 : 10,
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: 'none',
        borderRadius: 100,
        padding: compact ? '6px 10px 6px 6px' : '8px 14px 8px 8px',
        cursor: 'pointer',
      }}
      className="cp-object-card cp-object-person"
    >
      <div style={{
        width: compact ? 24 : 30,
        height: compact ? 24 : 30,
        borderRadius: '50%',
        background: 'var(--cp-red)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: compact ? 10 : 12,
          fontWeight: 700,
          color: '#fff',
          fontFeatureSettings: 'var(--cp-kern-mono)',
          lineHeight: 1,
        }}>
          {initial}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: compact ? 13 : 14,
          fontWeight: 500,
          color: 'var(--cp-text)',
          lineHeight: 1.2,
          fontFeatureSettings: 'var(--cp-kern-title)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        {!compact && object.body && (
          <div style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 11,
            color: 'var(--cp-text-muted)',
            fontFeatureSettings: 'var(--cp-kern-body)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 1,
          }}>
            {object.body}
          </div>
        )}
      </div>
      {(object.edge_count ?? 0) > 0 && (
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: 'var(--cp-text-faint)',
          fontFeatureSettings: 'var(--cp-kern-mono)',
          flexShrink: 0,
        }}>
          {object.edge_count}
        </span>
      )}
    </button>
  );
}
