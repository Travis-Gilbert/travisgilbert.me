'use client';

import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { RenderableObject } from './objects/ObjectRenderer';

interface ResumeCardsProps {
  lastEdited?: RenderableObject | null;
  recentActivity?: RenderableObject[];
  onOpenObject?: (objectRef: number) => void;
}

export default function ResumeCards({ lastEdited, recentActivity = [], onOpenObject }: ResumeCardsProps) {
  if (!lastEdited && recentActivity.length === 0) return null;

  const lastEditedIdentity = lastEdited
    ? getObjectTypeIdentity(lastEdited.object_type_slug)
    : null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: lastEdited && recentActivity.length > 0 ? '1fr 1fr' : '1fr',
      gap: 10,
      marginBottom: 24,
    }}>
      {lastEdited && (
        <button
          type="button"
          onClick={() => onOpenObject?.(lastEdited.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            textAlign: 'left',
            position: 'relative',
            overflow: 'hidden',
            background: 'rgba(180, 90, 45, 0.06)',
            border: '1px solid rgba(180, 90, 45, 0.22)',
            borderRadius: 7,
            padding: '13px 16px',
            cursor: 'pointer',
            boxShadow: '0 0 18px rgba(180, 90, 45, 0.10), inset 0 0 24px rgba(180, 90, 45, 0.04)',
          }}
        >
          {/* Accent stripe */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, #B45A2D, rgba(180, 90, 45, 0.25), transparent)',
          }} />
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 6,
            }}>
              <div style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                fontWeight: 700,
                color: '#B45A2D',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                Pick up where you left off
              </div>
              {lastEditedIdentity && (
                <div style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 8.5,
                  fontWeight: 700,
                  color: lastEditedIdentity.color,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  borderRadius: 3,
                  padding: '1px 6px',
                  background: `${lastEditedIdentity.color}0C`,
                  border: `1px solid ${lastEditedIdentity.color}18`,
                }}>
                  {lastEditedIdentity.label}
                </div>
              )}
            </div>
            <div style={{
              fontFamily: 'var(--cp-font-title)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--cp-text)',
              lineHeight: 1.22,
              fontFeatureSettings: 'var(--cp-kern-title)',
            }}>
              {lastEdited.display_title ?? lastEdited.title}
            </div>
            {lastEdited.body && (
              <div style={{
                marginTop: 2,
                maxWidth: 460,
                fontFamily: 'var(--cp-font-body)',
                fontSize: 12,
                color: 'var(--cp-text-muted)',
                lineHeight: 1.45,
                fontFeatureSettings: 'var(--cp-kern-body)',
              }}>
                {truncate(lastEdited.body, 108)}
              </div>
            )}
          </div>
          <div style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-faint)',
            fontFeatureSettings: 'var(--cp-kern-body)',
          }}>
            {lastEdited.body
              ? `${countWords(lastEdited.body)} words${lastEdited.captured_at ? `, last edited ${formatRelative(lastEdited.captured_at)}` : ''}`
              : `${lastEdited.object_type_slug}${lastEdited.captured_at ? `, last edited ${formatRelative(lastEdited.captured_at)}` : ''}`}
          </div>
        </button>
      )}
      {recentActivity.length > 0 && (
        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--cp-teal)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 8,
            textDecoration: 'underline',
            textUnderlineOffset: 4,
            textDecorationThickness: 1,
          }}>
            While you were away
          </div>
          <ul style={{
            margin: 0,
            padding: '0 0 0 14px',
            listStyle: 'none',
          }}>
            {recentActivity.map((item) => (
              <li
                key={item.id}
                style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 12,
                  color: 'var(--cp-teal)',
                  lineHeight: 1.5,
                  marginBottom: 8,
                  position: 'relative',
                  paddingLeft: 2,
                }}
              >
                <span style={{
                  position: 'absolute',
                  left: -12,
                  top: 0,
                  color: 'var(--cp-teal)',
                }}>
                  &bull;
                </span>
                {item.display_title ?? item.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

function countWords(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
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
