'use client';

/**
 * LensPropertiesStrip: left-side parchment strip in the Tier 3 Lens
 * close-read view (ADR 0003 paragraph 47, ADR 0011).
 *
 * Presentational only (props in, JSX out). The matching live-fetch
 * wrapper that calls `GET /api/v1/notebook/objects/<id>/lens-properties/`
 * derives `recentEdits` from the dossier endpoint's recent_activity
 * once the strip is mounted into LensView; until then this component
 * accepts those derived rows as props for unit-testability.
 *
 * Empty state is honest per CLAUDE.md "Empty states are honest, not
 * cosmetic": when the property bag, claim list, or edit list is
 * empty, those sections collapse rather than padding with filler.
 */

interface ClaimRow {
  id: number;
  text: string;
  reviewed: boolean;
}

interface EditRow {
  node_id: number;
  kind: string;
  created_at: string;
}

interface Props {
  objectId: string;
  title: string;
  properties: Record<string, string | number | boolean>;
  claims: ClaimRow[];
  recentEdits: EditRow[];
}

export default function LensPropertiesStrip({
  objectId,
  title,
  properties,
  claims,
  recentEdits,
}: Props) {
  const entries = Object.entries(properties);
  const hasProperties = entries.length > 0;
  const hasClaims = claims.length > 0;
  const hasEdits = recentEdits.length > 0;

  if (!hasProperties && !hasClaims && !hasEdits) {
    return (
      <aside
        className="lens-properties-strip lens-properties-strip-empty"
        data-object-id={objectId}
      >
        <header>{title}</header>
        <p>No properties recorded.</p>
      </aside>
    );
  }

  return (
    <aside className="lens-properties-strip" data-object-id={objectId}>
      <header>{title}</header>
      {hasProperties ? (
        <dl>
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {hasClaims ? (
        <section className="lens-claims">
          <h3>Claims</h3>
          <ul>
            {claims.map((c) => (
              <li key={c.id} data-reviewed={c.reviewed ? 'yes' : 'no'}>
                {c.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {hasEdits ? (
        <section className="lens-edits">
          <h3>Recent edits</h3>
          <ul>
            {recentEdits.map((e) => (
              <li key={e.node_id}>
                {e.kind} at {e.created_at}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}
