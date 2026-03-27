'use client';

import type { RenderableObject } from '../objects/ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';

interface ObjectRowProps {
  object: RenderableObject;
  onOpenObject?: (objectRef: number) => void;
  /** Optional engine status text below title (e.g., "Waiting for connections") */
  statusText?: string;
  statusColor?: string;
}

export default function ObjectRow({
  object,
  onOpenObject,
  statusText,
  statusColor = 'rgba(180, 90, 45, 0.5)',
}: ObjectRowProps) {
  const edgeCount = object.edge_count ?? 0;
  const dateStr = object.captured_at ? formatShortDate(object.captured_at) : '';

  return (
    <button
      type="button"
      onClick={() => onOpenObject?.(object.id)}
      style={{
        all: 'unset',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        borderRadius: 5,
        cursor: 'pointer',
        transition: 'background 150ms ease',
        width: '100%',
        boxSizing: 'border-box',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(26, 24, 22, 0.03)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Type mark */}
      <TypeMark typeSlug={object.object_type_slug} title={object.title} />

      {/* Title + optional status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--cp-font-body)',
          fontSize: 13,
          fontWeight: 400,
          color: '#2A2520',
          lineHeight: 1.35,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {object.display_title ?? object.title}
        </div>
        {object.body && (
          <div style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 11,
            fontWeight: 300,
            color: '#6A6560',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 1,
          }}>
            {object.body.slice(0, 80)}
          </div>
        )}
        {statusText && (
          <div style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: statusColor,
            marginTop: 2,
          }}>
            {statusText}
          </div>
        )}
      </div>

      {/* Right metadata */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        flexShrink: 0,
        gap: 1,
      }}>
        {edgeCount > 0 && (
          <span style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'rgba(45, 95, 107, 0.5)',
          }}>
            {edgeCount} conn.
          </span>
        )}
        {dateStr && (
          <span style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'rgba(26, 24, 22, 0.25)',
          }}>
            {dateStr}
          </span>
        )}
      </div>
    </button>
  );
}

/* ── Type Marks ── */

function TypeMark({ typeSlug, title }: { typeSlug: string; title: string }) {
  const slug = typeSlug.toLowerCase();

  if (slug === 'source' || slug === 'url') {
    return (
      <div style={{ width: 3, height: 32, borderRadius: 1, background: '#2D5F6B', flexShrink: 0 }} />
    );
  }

  if (slug === 'concept') {
    return (
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: 'rgba(107, 79, 122, 0.1)',
        border: '1.5px solid rgba(107, 79, 122, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6B4F7A' }} />
      </div>
    );
  }

  if (slug === 'person') {
    const initial = title.charAt(0).toUpperCase();
    return (
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: 'rgba(180, 90, 45, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--cp-font-body)',
        fontSize: 10, fontWeight: 600,
        color: '#B45A2D',
        flexShrink: 0,
      }}>
        {initial}
      </div>
    );
  }

  if (slug === 'hunch') {
    return (
      <div style={{
        width: 24, height: 24,
        border: '1.5px dashed rgba(196, 154, 74, 0.5)',
        background: 'rgba(196, 154, 74, 0.06)',
        borderRadius: 3,
        transform: 'rotate(-2deg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--cp-font-title)',
        fontSize: 11, fontStyle: 'italic',
        color: 'rgba(196, 154, 74, 0.6)',
        flexShrink: 0,
      }}>
        ?
      </div>
    );
  }

  if (slug === 'note') {
    return (
      <div style={{
        width: 24, height: 24, borderRadius: 3,
        background: 'rgba(26, 24, 22, 0.04)',
        border: '1px solid rgba(26, 24, 22, 0.08)',
        flexShrink: 0,
      }} />
    );
  }

  if (slug === 'quote') {
    return (
      <div style={{
        width: 3, height: 28, borderRadius: 1,
        background: '#B45A2D',
        flexShrink: 0,
      }} />
    );
  }

  if (slug === 'event') {
    return (
      <div style={{
        width: 24, height: 24, borderRadius: 3,
        background: 'rgba(196, 154, 74, 0.08)',
        border: '1px solid rgba(196, 154, 74, 0.15)',
        flexShrink: 0,
      }} />
    );
  }

  if (slug === 'task') {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: '1.5px solid rgba(26, 24, 22, 0.2)',
        flexShrink: 0,
      }} />
    );
  }

  // Default: file/url folded-corner rect
  return (
    <div style={{
      width: 22, height: 28, borderRadius: 2,
      background: 'rgba(45, 95, 107, 0.06)',
      border: '1px solid rgba(45, 95, 107, 0.15)',
      flexShrink: 0,
    }} />
  );
}

function formatShortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
