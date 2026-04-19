'use client';

import { CosmographTypeColorLegend } from '@cosmograph/react';
import type { FC } from 'react';

/**
 * Object-type color legend. Clicking a swatch in the underlying
 * CosmographTypeColorLegend filters the graph to just that type.
 */
const GraphLegend: FC = () => {
  return (
    <div
      className="vie-graph-legend"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        padding: '6px 8px',
        boxShadow: 'var(--shadow-warm-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-muted)',
      }}
    >
      <CosmographTypeColorLegend />
    </div>
  );
};

export default GraphLegend;
