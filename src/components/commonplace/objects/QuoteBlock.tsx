'use client';

import type { ObjectCardProps } from './ObjectRenderer';
export default function QuoteBlock({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const text = object.display_title ?? object.title;
  const attribution = object.body;

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
        border: 'none',
        borderLeft: '3px solid var(--cp-accent)',
        borderRadius: '0 6px 6px 0',
        padding: compact ? '8px 10px' : '12px 16px',
        cursor: 'pointer',
      }}
      className="cp-object-card cp-object-quote"
    >
      <div style={{
        fontFamily: 'var(--cp-font-title)',
        fontSize: compact ? 13 : 15,
        fontWeight: 400,
        fontStyle: 'italic',
        color: 'var(--cp-text)',
        lineHeight: 1.45,
        fontFeatureSettings: 'var(--cp-kern-title)',
        marginBottom: attribution && !compact ? 8 : 0,
        display: '-webkit-box',
        WebkitLineClamp: compact ? 2 : 4,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {text}
      </div>
      {!compact && attribution && (
        <div style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-text-faint)',
          fontFeatureSettings: 'var(--cp-kern-mono)',
          lineHeight: 1.4,
        }}>
          {attribution}
        </div>
      )}
    </button>
  );
}
