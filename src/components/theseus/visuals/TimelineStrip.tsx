/**
 * TimelineStrip — horizontal timeline reading `visual.structured.events:
 * Array<{ id, label, when_iso, description?, linked_evidence? }>`.
 *
 * SVG viewBox sizing so it scales cleanly. Events are positioned by
 * their ISO timestamp across the available width. Hover fires region
 * events for canvas cross-highlighting.
 */

'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import type { StructuredVisual, StructuredVisualRegion } from '@/lib/theseus-types';

interface TimelineStripProps {
  visual: StructuredVisual;
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
  onRegionSelect?: (region: StructuredVisualRegion) => void;
}

interface TimelineEvent {
  id: string;
  label: string;
  timestamp: number;
  description?: string;
  linked_evidence?: string[];
}

function readEvents(visual: StructuredVisual): TimelineEvent[] {
  const raw = visual.structured?.events;
  if (!Array.isArray(raw)) return [];
  const events: TimelineEvent[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const rec = e as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : String(events.length);
    const label = typeof rec.label === 'string' ? rec.label : '';
    const whenIso = typeof rec.when_iso === 'string' ? rec.when_iso : null;
    if (!whenIso || label.length === 0) continue;
    const ts = Date.parse(whenIso);
    if (!Number.isFinite(ts)) continue;
    const description = typeof rec.description === 'string' ? rec.description : undefined;
    const linked = Array.isArray(rec.linked_evidence) ? rec.linked_evidence.map(String) : undefined;
    events.push({ id, label, timestamp: ts, description, linked_evidence: linked });
  }
  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 120;
const MARGIN_X = 40;
const AXIS_Y = 80;

const TimelineStrip: FC<TimelineStripProps> = ({ visual, onRegionHover }) => {
  const events = useMemo(() => readEvents(visual), [visual]);

  if (events.length === 0) return null;

  const minT = events[0].timestamp;
  const maxT = events[events.length - 1].timestamp;
  const span = Math.max(1, maxT - minT);
  const width = VIEWBOX_WIDTH - MARGIN_X * 2;

  const formatYear = (ts: number) => new Date(ts).getFullYear().toString();

  return (
    <div
      style={{
        background: 'var(--color-paper, #fdfbf6)',
        border: '1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)',
        borderRadius: 6,
        padding: 12,
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`Timeline with ${events.length} events`}
      >
        <line
          x1={MARGIN_X}
          x2={VIEWBOX_WIDTH - MARGIN_X}
          y1={AXIS_Y}
          y2={AXIS_Y}
          stroke="color-mix(in srgb, var(--color-ink) 40%, transparent)"
          strokeWidth={1.5}
        />
        {events.map((ev) => {
          const pct = (ev.timestamp - minT) / span;
          const x = MARGIN_X + pct * width;
          return (
            <g
              key={ev.id}
              onMouseEnter={() => {
                if (!onRegionHover || !ev.linked_evidence || ev.linked_evidence.length === 0) return;
                onRegionHover({
                  id: ev.id,
                  label: ev.label,
                  x,
                  y: AXIS_Y - 20,
                  width: 8,
                  height: 40,
                  linked_evidence: ev.linked_evidence,
                });
              }}
              onMouseLeave={() => onRegionHover?.(null)}
              style={{ cursor: ev.linked_evidence?.length ? 'pointer' : 'default' }}
            >
              <circle
                cx={x}
                cy={AXIS_Y}
                r={5}
                fill="var(--color-terracotta, #B45A2D)"
                stroke="var(--color-paper, #fdfbf6)"
                strokeWidth={2}
              />
              <text
                x={x}
                y={AXIS_Y - 14}
                textAnchor="middle"
                fontFamily="var(--font-body)"
                fontSize={10}
                fill="var(--color-ink)"
              >
                {ev.label}
              </text>
              <text
                x={x}
                y={AXIS_Y + 20}
                textAnchor="middle"
                fontFamily="var(--font-metadata)"
                fontSize={9}
                fill="var(--color-ink-muted)"
                letterSpacing="0.05em"
              >
                {formatYear(ev.timestamp)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default TimelineStrip;
