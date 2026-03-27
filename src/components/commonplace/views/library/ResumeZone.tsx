'use client';

import { useMemo } from 'react';
import type { RenderableObject } from '../../objects/ObjectRenderer';

interface ResumeZoneProps {
  lastEdited?: RenderableObject | null;
  recentActivity?: RenderableObject[];
  onOpenObject?: (objectRef: number) => void;
}

/** Relative time label: "2h", "1d", "3d", etc. */
function shortTimeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return '<1h';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface PulseRow {
  time: string;
  icon: string;
  segments: { text: string; color: string }[];
}

export default function ResumeZone({
  lastEdited,
  recentActivity = [],
  onOpenObject,
}: ResumeZoneProps) {
  const allItems = useMemo(() => {
    const items: RenderableObject[] = [];
    if (lastEdited) items.push(lastEdited);
    items.push(...recentActivity);
    return items;
  }, [lastEdited, recentActivity]);

  const pulseRows = useMemo<PulseRow[]>(() => {
    const rows: PulseRow[] = [];
    for (const item of allItems.slice(0, 4)) {
      const time = shortTimeAgo(item.captured_at);
      const edgeCount = item.edge_count ?? 0;

      if (edgeCount > 0) {
        rows.push({
          time,
          icon: '\u21a6',
          segments: [
            { text: 'NLI pass', color: '#5DCAA5' },
            { text: ' found connection: ', color: 'rgba(244, 243, 240, 0.55)' },
            { text: item.display_title ?? item.title, color: 'rgba(244, 243, 240, 0.8)' },
            { text: ` (${edgeCount} conn.)`, color: '#C49A4A' },
          ],
        });
      } else {
        rows.push({
          time,
          icon: '\u25CB',
          segments: [
            { text: item.display_title ?? item.title, color: 'rgba(244, 243, 240, 0.8)' },
            { text: ' waiting for connections', color: 'rgba(244, 243, 240, 0.35)' },
          ],
        });
      }
    }
    return rows;
  }, [allItems]);

  if (allItems.length === 0) return null;

  const awayCount = recentActivity.filter((r) => (r.edge_count ?? 0) > 0).length;

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Engine Pulse terminal block */}
      <div
        style={{
          background: '#1A1C22',
          borderRadius: 5,
          padding: '14px 16px',
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          lineHeight: 1.7,
        }}
      >
        {pulseRows.map((row, i) => (
          <div
            key={i}
            style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}
          >
            <span style={{ color: 'rgba(244, 243, 240, 0.2)', width: 32, flexShrink: 0, textAlign: 'right' }}>
              {row.time}
            </span>
            <span style={{ color: 'rgba(244, 243, 240, 0.35)', width: 14, flexShrink: 0, textAlign: 'center' }}>
              {row.icon}
            </span>
            <span>
              {row.segments.map((seg, j) => (
                <span key={j} style={{ color: seg.color }}>{seg.text}</span>
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* "While you were away" strip */}
      {awayCount > 0 && (
        <div
          style={{
            background: 'rgba(45, 95, 107, 0.04)',
            borderLeft: '2px solid rgba(45, 95, 107, 0.2)',
            padding: '8px 14px',
            marginTop: 6,
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            color: '#2D5F6B',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 12 }}>{'\u29D7'}</span>
          {awayCount} new connection{awayCount !== 1 ? 's' : ''} while you were away
          {recentActivity[0]?.captured_at && (
            <span style={{ color: 'rgba(45, 95, 107, 0.5)', marginLeft: 'auto' }}>
              last active {shortTimeAgo(recentActivity[0].captured_at)} ago
            </span>
          )}
        </div>
      )}
    </div>
  );
}
