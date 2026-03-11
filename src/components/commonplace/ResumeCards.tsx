'use client';

import type { RenderableObject } from './objects/ObjectRenderer';

interface ResumeCardsProps {
  lastEdited?: RenderableObject | null;
  recentActivity?: RenderableObject[];
  onOpenObject?: (objectRef: number) => void;
}

export default function ResumeCards({ lastEdited, recentActivity = [], onOpenObject }: ResumeCardsProps) {
  if (!lastEdited && recentActivity.length === 0) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: lastEdited && recentActivity.length > 0 ? '1fr 1fr' : '1fr',
      gap: 10,
      marginBottom: 20,
    }}>
      {lastEdited && (
        <button
          type="button"
          onClick={() => onOpenObject?.(lastEdited.id)}
          style={{
            display: 'block',
            textAlign: 'left',
            background: 'var(--cp-surface)',
            border: '1px solid var(--cp-border)',
            borderLeft: '3px solid var(--cp-accent)',
            borderRadius: '0 6px 6px 0',
            padding: '10px 14px',
            cursor: 'pointer',
            transition: 'border-color 120ms ease',
          }}
        >
          <div style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--cp-accent)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 5,
          }}>
            Pick up where you left off
          </div>
          <div style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--cp-text)',
            lineHeight: 1.3,
            fontFeatureSettings: 'var(--cp-kern-title)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {lastEdited.display_title ?? lastEdited.title}
          </div>
          <div style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: 'var(--cp-text-faint)',
            marginTop: 4,
            fontFeatureSettings: 'var(--cp-kern-mono)',
          }}>
            {lastEdited.object_type_slug}
            {lastEdited.captured_at && ` · ${formatRelative(lastEdited.captured_at)}`}
          </div>
        </button>
      )}
      {recentActivity.length > 0 && (
        <div style={{
          background: 'var(--cp-surface)',
          border: '1px solid var(--cp-border)',
          borderRadius: 6,
          padding: '10px 14px',
        }}>
          <div style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--cp-chrome-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            While you were away
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recentActivity.slice(0, 3).map((obj) => (
              <button
                key={obj.id}
                type="button"
                onClick={() => onOpenObject?.(obj.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '2px 0',
                  cursor: 'pointer',
                }}
              >
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: 'var(--cp-chrome-dim)',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 12,
                  color: 'var(--cp-text)',
                  fontFeatureSettings: 'var(--cp-kern-body)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {obj.display_title ?? obj.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}
