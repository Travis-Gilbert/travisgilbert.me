'use client';

/**
 * LensTimeline: bottom strip in the Tier 3 Lens close-read view that
 * plots the past 90 days of provenance touches for the focused
 * Object (ADR 0003 paragraph 47, ADR 0011).
 *
 * Backed by `GET /api/v1/notebook/objects/<id>/lens-timeline/` whose
 * response is `{ events: [{ days_ago, when, short, text, color }] }`.
 * The `color` field is precomputed on the server from
 * `EVENT_COLOR_BY_TYPE` so we can render the dot strip without a
 * client-side lookup table. Empty timeline -> render nothing per
 * CLAUDE.md "Empty states are honest, not cosmetic".
 */

interface TimelineEvent {
  days_ago: number;
  when: string;
  short: string;
  text: string;
  color: string;
}

interface Props {
  events: TimelineEvent[];
}

/**
 * Defensive fallback mapping from event-type short labels to color
 * tokens. The backend precomputes `event.color` per event-type via
 * `EVENT_COLOR_BY_TYPE` in `apps/notebook/views/_lens_helpers.py`,
 * so this fallback only fires when the server omits the field
 * (e.g. older clients hitting a future server). Keep keys stable
 * with the server-side `EVENT_COLOR_BY_TYPE` keys.
 */
const EVENT_COLOR_FALLBACK: Record<string, string> = {
  'edge added': '#5A7A4A',
  'claim added': '#C49A4A',
  updated: '#2D5F6B',
  'capture': '#B45A2D',
};

function dotColor(event: TimelineEvent): string {
  if (event.color && event.color.length > 0) return event.color;
  return EVENT_COLOR_FALLBACK[event.short] ?? 'var(--paper-ink)';
}

const FOOTER_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 16,
  right: 16,
  bottom: 16,
  height: 60,
  padding: '6px 12px',
  background: 'color-mix(in oklab, var(--paper) 88%, transparent)',
  border: '1px solid color-mix(in oklab, var(--paper-pencil) 24%, transparent)',
  borderRadius: 4,
};

export default function LensTimeline({ events }: Props) {
  if (events.length === 0) return null;
  // Map days_ago (0..90) onto an x in [60, 540] so older events sit
  // left, newest right. Cap at 90 to keep the axis stable when the
  // backend window expands later.
  const xs = events.map((e) => {
    const t = Math.min(90, Math.max(0, e.days_ago));
    return 540 - (t / 90) * 480;
  });
  return (
    <footer className="lens-timeline" style={FOOTER_STYLE}>
      <svg viewBox="0 0 600 60" width="100%" height="48">
        <line
          x1={60}
          y1={30}
          x2={540}
          y2={30}
          stroke="var(--paper-pencil)"
          strokeWidth={0.5}
          opacity={0.4}
        />
        {events.map((e, i) => (
          <g key={`${e.days_ago}-${i}`}>
            <circle cx={xs[i]} cy={30} r={3} fill={dotColor(e)} />
            <title>{`${e.short} (${e.when}): ${e.text}`}</title>
          </g>
        ))}
      </svg>
    </footer>
  );
}
