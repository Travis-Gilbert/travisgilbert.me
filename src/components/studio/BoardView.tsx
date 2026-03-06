'use client';

import { STAGES, studioMix } from '@/lib/studio';
import type { StudioContentItem } from '@/lib/studio';
import ContentCardCompact from './ContentCardCompact';

/**
 * Kanban board view: items grouped into columns by pipeline stage.
 *
 * Only renders columns for stages that have at least one item.
 * Includes a horizontal pipeline summary bar at the top showing
 * proportional colored segments for each populated stage.
 */
export default function BoardView({
  items,
  color,
}: {
  items: StudioContentItem[];
  color: string;
}) {
  const total = items.length;

  /* Group items by stage, preserving pipeline order */
  const columns = STAGES.map((stage) => ({
    stage,
    items: items.filter((i) => i.stage === stage.slug),
  })).filter((col) => col.items.length > 0);

  if (columns.length === 0) {
    return (
      <p
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '14px',
          color: 'var(--studio-text-3)',
          padding: '24px 0',
        }}
      >
        No items to display on the board.
      </p>
    );
  }

  return (
    <div>
      {/* Pipeline summary bar */}
      <div
        style={{
          display: 'flex',
          height: '4px',
          borderRadius: '2px',
          overflow: 'hidden',
          marginBottom: '16px',
          gap: '2px',
        }}
      >
        {columns.map(({ stage, items: colItems }) => (
          <div
            key={stage.slug}
            style={{
              flex: colItems.length / total,
              backgroundColor: stage.color,
              borderRadius: '2px',
              minWidth: '8px',
            }}
          />
        ))}
      </div>

      {/* Kanban columns */}
      <div
        className="studio-scrollbar"
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {columns.map(({ stage, items: colItems }) => (
          <div
            key={stage.slug}
            style={{
              minWidth: '220px',
              maxWidth: '300px',
              flex: '1 1 0',
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: `1px solid ${studioMix(stage.color, 20)}`,
              }}
            >
              <span
                className="studio-stage-badge"
                data-stage={stage.slug}
                style={{ fontSize: '10px' }}
              >
                {stage.label}
              </span>
              <span
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '11px',
                  color: 'var(--studio-text-3)',
                }}
              >
                {colItems.length}
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {colItems.map((item) => (
                <ContentCardCompact key={item.id} item={item} color={color} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
