'use client';

/**
 * LensPropertiesStrip: left-side parchment strip in the Tier 3 Lens
 * close-read view (ADR 0003 paragraph 47, ADR 0011).
 *
 * This file ships the presentational component (props in, JSX out)
 * so it can be unit-tested without a fetch shim. Task 7.2 layers in
 * claims and recent edits; Task 7.3 adds parchment-glass styling.
 * The matching live-data fetch wrapper that calls
 * `GET /api/v1/notebook/objects/<id>/lens-properties/` lives in a
 * sibling component once Stage 7 mounts the strip into LensView.
 *
 * Empty state is honest per CLAUDE.md "Empty states are honest, not
 * cosmetic": when the property bag is empty we say so plainly rather
 * than padding with placeholder rows.
 */

interface Props {
  objectId: string;
  title: string;
  properties: Record<string, string | number | boolean>;
}

export default function LensPropertiesStrip({ objectId, title, properties }: Props) {
  const entries = Object.entries(properties);
  if (entries.length === 0) {
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
      <dl>
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
