'use client';

/**
 * LensPropertiesStrip: left-side parchment strip in the Tier 3 Lens
 * close-read view (ADR 0003 paragraph 47, ADR 0011).
 *
 * Presentational only. The wrapper that calls
 * `GET /api/v1/notebook/objects/<id>/lens-properties/` lives in
 * LensView.tsx; this component receives the canonical backend payload
 * fields directly. The earlier shape (a `properties: Record<...>` map
 * plus a `recent_edits` array) was a frontend-side fiction that
 * crashed at runtime; this version reads the actual fields the backend
 * emits at apps/notebook/views/_lens_helpers.py:build_properties_payload.
 *
 * Empty state is honest per CLAUDE.md "Empty states are honest, not
 * cosmetic": when no claims and no shell counts and no pins exist, the
 * strip renders the title + kind only and a brief "No properties
 * recorded yet." line; it does not pad with fake rows.
 */

interface ClaimRow {
  id: number;
  text: string;
  confidence: number | null;
}

interface Props {
  objectId: string;
  title: string;
  summary: string;
  evidenceCount: number;
  confidence: number | null;
  kinCount: number;
  anchoringCount: number;
  contextCount: number;
  pinnedBy: string[];
  lastTouched: string | null;
  claims: ClaimRow[];
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function LensPropertiesStrip({
  objectId,
  title,
  summary,
  evidenceCount,
  confidence,
  kinCount,
  anchoringCount,
  contextCount,
  pinnedBy,
  lastTouched,
  claims,
}: Props) {
  const hasClaims = claims.length > 0;
  const hasPins = pinnedBy.length > 0;
  const hasShellSignal = kinCount + anchoringCount + contextCount > 0;
  const hasSummary = Boolean(summary);

  // The kind, evidence_count and last_touched are always present on
  // the backend payload (even if as empty string / 0 / null), so the
  // header never renders empty. The "no properties recorded yet" copy
  // only fires when nothing beyond the header exists.
  const hasAnythingBelowHeader =
    hasSummary || hasShellSignal || hasPins || hasClaims;

  return (
    <aside className="lens-properties-strip" data-object-id={objectId}>
      <header>
        <div className="lens-properties-title">{title}</div>
        <div className="lens-properties-touched" aria-label="Last touched">
          last touched {formatRelativeTime(lastTouched)}
        </div>
      </header>

      {hasSummary ? (
        <p className="lens-properties-summary">{summary}</p>
      ) : null}

      {hasShellSignal ? (
        <dl className="lens-properties-shells">
          <div>
            <dt>kin</dt>
            <dd>{kinCount}</dd>
          </div>
          <div>
            <dt>anchoring</dt>
            <dd>{anchoringCount}</dd>
          </div>
          <div>
            <dt>context</dt>
            <dd>{contextCount}</dd>
          </div>
        </dl>
      ) : null}

      <dl className="lens-properties-evidence">
        <div>
          <dt>evidence</dt>
          <dd>{evidenceCount}</dd>
        </div>
        {confidence !== null ? (
          <div>
            <dt>confidence</dt>
            <dd>{confidence.toFixed(2)}</dd>
          </div>
        ) : null}
      </dl>

      {hasPins ? (
        <section className="lens-pins" aria-label="Pinned by">
          <h3>Pinned by</h3>
          <ul>
            {pinnedBy.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasClaims ? (
        <section className="lens-claims" aria-label="Claims">
          <h3>Claims</h3>
          <ul>
            {claims.map((c) => (
              <li
                key={c.id}
                data-confidence={c.confidence == null ? 'unset' : c.confidence.toFixed(2)}
              >
                <span className="lens-claim-text">{c.text}</span>
                {c.confidence !== null ? (
                  <span className="lens-claim-confidence">
                    {c.confidence.toFixed(2)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!hasAnythingBelowHeader ? (
        <p className="lens-properties-empty">No properties recorded yet.</p>
      ) : null}
    </aside>
  );
}
