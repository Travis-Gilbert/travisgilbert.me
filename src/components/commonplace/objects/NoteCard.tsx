'use client';

import type { ObjectCardProps } from './ObjectRenderer';
export default function NoteCard({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const ts = object.captured_at ? formatDate(object.captured_at) : null;

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
        borderRadius: 6,
        padding: compact ? '8px 10px' : '12px 14px',
        cursor: 'pointer',
        transition: 'box-shadow 120ms ease',
      }}
      className="cp-object-card cp-object-note"
    >
      <div style={{
        fontFamily: 'var(--cp-font-title)',
        fontSize: compact ? 14 : 16,
        fontWeight: 500,
        color: 'var(--cp-text)',
        lineHeight: 1.3,
        fontFeatureSettings: 'var(--cp-kern-title)',
        marginBottom: object.body ? 6 : 0,
      }}>
        {object.display_title ?? object.title}
      </div>
      {!compact && object.body && (
        <div style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: 13,
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
      }}>
        {ts && (
          <span style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
            fontFeatureSettings: 'var(--cp-kern-mono)',
          }}>
            {ts}
          </span>
        )}
        {(object.edge_count ?? 0) > 0 && (
          <span style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
            marginLeft: 'auto',
          }}>
            {object.edge_count} links
          </span>
        )}
      </div>
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
