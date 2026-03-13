'use client';

import type { ObjectCardProps } from './ObjectRenderer';

export default function HunchSticky({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;

  return (
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: '1px dashed var(--cp-border)',
        borderRadius: 6,
        padding: compact ? '8px 10px' : '12px 14px',
        cursor: 'pointer',
        transform: 'rotate(-0.3deg)',
        transition: 'border-color 120ms ease, transform 120ms ease',
      }}
      className="cp-object-card cp-object-hunch"
    >
      <div style={{
        fontFamily: 'var(--cp-font-title)',
        fontSize: compact ? 13 : 15,
        fontWeight: 400,
        fontStyle: 'italic',
        color: 'var(--cp-text)',
        lineHeight: 1.4,
        fontFeatureSettings: 'var(--cp-kern-title)',
        marginBottom: object.body && !compact ? 6 : 0,
      }}>
        {title}
      </div>
      {!compact && object.body && (
        <div style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: 12,
          fontStyle: 'italic',
          color: 'var(--cp-text-muted)',
          lineHeight: 1.55,
          fontFeatureSettings: 'var(--cp-kern-body)',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          marginBottom: 8,
        }}>
          {object.body}
        </div>
      )}
      {(object.edge_count ?? 0) > 0 && (
        <div style={{ marginTop: 4 }}>
          <span style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
            fontFeatureSettings: 'var(--cp-kern-mono)',
          }}>
            {object.edge_count} links
          </span>
        </div>
      )}
    </button>
  );
}
