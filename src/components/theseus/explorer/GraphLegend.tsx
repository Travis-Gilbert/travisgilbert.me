'use client';

import type { FC } from 'react';
import type { CosmoPoint } from './useGraphData';

interface GraphLegendProps {
  points: CosmoPoint[];
}

/** Compact object-type color legend derived from the live points array,
 *  so swatches match the canvas palette exactly without a second fetch. */
const GraphLegend: FC<GraphLegendProps> = ({ points }) => {
  const byType = new Map<string, { color: string; count: number }>();
  const list = Array.isArray(points) ? points : [];
  for (const p of list) {
    const existing = byType.get(p.type);
    if (existing) existing.count += 1;
    else byType.set(p.type, { color: p.colorHex, count: 1 });
  }
  const entries = Array.from(byType.entries()).sort((a, b) => b[1].count - a[1].count);
  if (entries.length === 0) return null;

  return (
    <div
      className="vie-graph-legend"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        padding: '8px 10px',
        boxShadow: 'var(--shadow-warm-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-muted)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        maxWidth: 420,
      }}
    >
      {entries.slice(0, 10).map(([type, { color, count }]) => (
        <span
          key={type}
          title={`${type} (${count})`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: color,
              display: 'inline-block',
            }}
          />
          {type}
        </span>
      ))}
    </div>
  );
};

export default GraphLegend;
