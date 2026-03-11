'use client';

import type { ObjectCardProps } from './ObjectRenderer';

export default function ConceptNode({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const label = object.display_title ?? object.title;

  return (
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: '1px solid var(--cp-border)',
        borderRadius: 100,
        padding: compact ? '5px 10px 5px 8px' : '7px 12px 7px 10px',
        cursor: 'pointer',
        transition: 'border-color 120ms ease',
      }}
      className="cp-object-card cp-object-concept"
    >
      <span style={{
        width: compact ? 6 : 8,
        height: compact ? 6 : 8,
        borderRadius: '50%',
        background: 'var(--cp-accent)',
        flexShrink: 0,
      }} />
      <span style={{
        fontFamily: 'var(--cp-font-mono)',
        fontSize: compact ? 11 : 12,
        fontWeight: 500,
        color: 'var(--cp-text)',
        fontFeatureSettings: 'var(--cp-kern-mono)',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      {(object.edge_count ?? 0) > 0 && (
        <span style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          color: '#fff',
          fontFeatureSettings: 'var(--cp-kern-mono)',
          background: 'var(--cp-accent)',
          borderRadius: 100,
          padding: '1px 6px',
          flexShrink: 0,
          lineHeight: 1.6,
        }}>
          {object.edge_count}
        </span>
      )}
    </button>
  );
}
