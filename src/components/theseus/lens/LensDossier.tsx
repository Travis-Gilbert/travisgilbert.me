'use client';

/**
 * LensDossier: right-side parchment plate in the Tier 3 Lens
 * close-read view (ADR 0003 paragraph 47, ADR 0011).
 *
 * Backed by `GET /api/v1/notebook/objects/<id>/lens-dossier/`. The
 * response is the lens-properties payload plus a `recent_activity`
 * array (max 5 events) drawn from real Nodes/Edges/Claims in the
 * past 90 days. When `recent_activity` is empty (or there is no
 * meaningful summary content) we render nothing rather than padding
 * the dossier with placeholder rows. CLAUDE.md "Empty states are
 * honest, not cosmetic".
 *
 * This file is the presentational receiver. The fetch wrapper that
 * pulls the live payload mounts in LensView once Stage 7 wires the
 * panels into the canvas.
 */

interface DossierEvent {
  days_ago: number;
  when: string;
  short: string;
  text: string;
  color: string;
}

interface Props {
  title: string;
  summary: string;
  recentActivity: DossierEvent[];
}

const PARCHMENT_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  top: 96,
  width: 320,
  padding: 16,
  background: 'color-mix(in oklab, var(--paper) 92%, transparent)',
  border: '1px solid color-mix(in oklab, var(--paper-pencil) 30%, transparent)',
  borderRadius: 6,
  fontFamily: 'var(--font-body)',
  color: 'var(--paper-ink)',
  boxShadow: '0 4px 16px color-mix(in oklab, var(--paper-ink) 18%, transparent)',
};

const HEADING_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 16,
  margin: '0 0 8px 0',
};

const SECTION_HEADING_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  opacity: 0.7,
  margin: '12px 0 6px 0',
};

export default function LensDossier({ title, summary, recentActivity }: Props) {
  const hasSummary = summary.trim().length > 0;
  const hasActivity = recentActivity.length > 0;
  if (!hasSummary && !hasActivity) return null;
  return (
    <aside className="lens-dossier" style={PARCHMENT_STYLE}>
      <h2 style={HEADING_STYLE}>{title}</h2>
      {hasSummary ? (
        <p style={{ fontSize: 13, lineHeight: 1.45, margin: '0 0 12px 0' }}>{summary}</p>
      ) : null}
      {hasActivity ? (
        <section>
          <h3 style={SECTION_HEADING_STYLE}>Recent activity</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {recentActivity.slice(0, 5).map((e, idx) => (
              <li
                key={`${e.days_ago}-${idx}`}
                style={{
                  fontSize: 12,
                  marginBottom: 6,
                  paddingLeft: 10,
                  borderLeft: `2px solid ${e.color}`,
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.6 }}>{e.when}</span>{' '}
                <strong>{e.short}</strong>: {e.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
