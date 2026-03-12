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
            background: 'var(--cp-red-soft)',
            border: '1px solid var(--cp-red-line)',
            borderRadius: 7,
            padding: '13px 16px',
            cursor: 'pointer',
          }}
        >
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
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--cp-accent)',
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
              fontSize: 14,
              fontWeight: 600,
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
        <div style={{
          minHeight: 112,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(112, 80, 160, 0.05), rgba(255,255,255,0.2))',
          border: '1px solid rgba(112, 80, 160, 0.14)',
          borderRadius: 5,
          padding: '10px 14px',
          boxShadow: 'none',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              fontWeight: 700,
              color: 'var(--cp-purple)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>
              While you were away
            </div>
            <div style={{
              fontFamily: 'var(--cp-font-title)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--cp-text)',
              lineHeight: 1.25,
            }}>
              {recentActivity.length} new connections formed
            </div>
            <div style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: 12,
              color: 'var(--cp-text-muted)',
              marginTop: 2,
              lineHeight: 1.5,
            }}>
              {(recentActivity[0]?.display_title ?? recentActivity[0]?.title ?? 'Recent activity')}
              {recentActivity.length > 1 ? ` linked to ${recentActivity.length - 1} other objects` : ''}
            </div>
          </div>
          <div style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-faint)',
            lineHeight: 1.45,
          }}>
            Recent activity is being synthesized from the latest objects in the current feed.
          </div>
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
