'use client';

import type { CapturedObject } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import styles from './CommonPlaceSidebar.module.css';

/**
 * RecentCaptures: sidebar list of the last ~10 captured objects.
 *
 * Each entry shows: type color dot, title (truncated), relative
 * timestamp. Objects with status 'local' show a subtle pulse
 * animation indicating they haven't synced yet.
 */

interface RecentCapturesProps {
  captures: CapturedObject[];
  maxItems?: number;
}

export default function RecentCaptures({
  captures,
  maxItems = 10,
}: RecentCapturesProps) {
  const visible = captures.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <div
        style={{
          padding: '8px 12px',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-sidebar-text-faint)',
        }}
      >
        No captures yet
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {visible.map((capture) => {
        const typeIdentity = getObjectTypeIdentity(capture.objectType);
        const isLocal = capture.status === 'local';

        return (
          <button
            key={capture.id}
            type="button"
            className={styles.sidebarItem}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              textAlign: 'left',
              padding: '5px 12px',
              gap: 8,
            }}
          >
            {/* Type dot with optional pulse */}
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: typeIdentity.color,
                flexShrink: 0,
                animation: isLocal
                  ? 'cp-sync-pulse 1.5s ease-in-out infinite'
                  : 'none',
              }}
            />

            {/* Title */}
            <span
              style={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 12,
              }}
            >
              {capture.title || 'Untitled'}
            </span>

            {/* Relative time */}
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: 'var(--cp-sidebar-text-faint)',
                flexShrink: 0,
                letterSpacing: '0.02em',
              }}
            >
              {formatRelativeTime(capture.capturedAt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Relative time formatting (compact)
   ───────────────────────────────────────────────── */

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
