'use client';

import { useMemo } from 'react';
import { getMockTimeline, groupTimelineByDate } from '@/lib/studio-mock-data';
import { getContentTypeIdentity } from '@/lib/studio';

/**
 * Studio timeline: vertical feed of all content activity.
 *
 * Entries grouped by date with spine visualization.
 * Color-coded dots by content type. Full implementation
 * with expandable entries and filters in Batch 4.
 */
export default function TimelineView() {
  const timeline = useMemo(() => getMockTimeline(), []);
  const groups = useMemo(() => groupTimelineByDate(timeline), [timeline]);

  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="studio-section-head">
        <span className="studio-section-label">Timeline</span>
        <span className="studio-section-line" />
      </div>

      <div style={{ marginTop: '20px', position: 'relative' }}>
        {/* Spine */}
        <div
          style={{
            position: 'absolute',
            left: '7px',
            top: '0',
            bottom: '0',
            width: '1px',
            backgroundColor: 'var(--studio-border)',
          }}
          aria-hidden="true"
        />

        {groups.map((group) => (
          <div key={group.dateKey} style={{ marginBottom: '24px' }}>
            {/* Date header */}
            <div
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                color: 'var(--studio-text-3)',
                marginBottom: '12px',
                paddingLeft: '24px',
              }}
            >
              {group.dateLabel}
            </div>

            {/* Entries */}
            {group.entries.map((entry) => {
              const typeInfo = getContentTypeIdentity(entry.contentType);
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    padding: '6px 0',
                    paddingLeft: '24px',
                    position: 'relative',
                  }}
                >
                  {/* Dot on spine */}
                  <span
                    style={{
                      position: 'absolute',
                      left: '3px',
                      top: '10px',
                      width: '9px',
                      height: '9px',
                      borderRadius: '50%',
                      backgroundColor:
                        typeInfo?.color ?? 'var(--studio-text-3)',
                      border: '2px solid var(--studio-bg)',
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--studio-font-body)',
                        fontSize: '13px',
                        color: 'var(--studio-text-2)',
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ color: 'var(--studio-text-bright)' }}>
                        {entry.contentTitle}
                      </span>
                      {' '}
                      <span style={{ color: 'var(--studio-text-3)' }}>
                        {entry.action}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '10px',
                      color: 'var(--studio-text-3)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {formatTime(entry.occurredAt)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
