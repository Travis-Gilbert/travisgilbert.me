'use client';

import type { ObjectCardProps } from './ObjectRenderer';
function PinIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1C4.79 1 3 2.79 3 5c0 2.1 1.75 3.63 3.5 5.5C8.25 8.63 11 7.1 11 5c0-2.21-1.79-4-4-4z"
        fill={color}
        opacity="0.9"
      />
      <circle cx="7" cy="5" r="1.5" fill="#fff" />
    </svg>
  );
}

export default function PlacePin({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const name = object.display_title ?? object.title;
  return (
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'flex',
        alignItems: compact ? 'center' : 'flex-start',
        gap: 9,
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: 'none',
        borderRadius: 6,
        padding: compact ? '7px 10px' : '10px 12px',
        cursor: 'pointer',
      }}
      className="cp-object-card cp-object-place"
    >
      <span style={{
        color: 'var(--cp-accent)',
        flexShrink: 0,
        marginTop: compact ? 0 : 1,
      }}>
        <PinIcon size={compact ? 13 : 15} color="var(--cp-accent)" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: compact ? 13 : 15,
          fontWeight: 500,
          color: 'var(--cp-text)',
          lineHeight: 1.3,
          fontFeatureSettings: 'var(--cp-kern-title)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: compact ? 'nowrap' : 'normal',
        }}>
          {name}
        </div>
        {!compact && object.body && (
          <div style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-muted)',
            lineHeight: 1.5,
            fontFeatureSettings: 'var(--cp-kern-body)',
            marginTop: 3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
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
          marginLeft: 'auto',
        }}>
          {object.edge_count} links
        </span>
      )}
    </button>
  );
}
