'use client';

import { CosmographTimeline } from '@cosmograph/react';
import type { FC } from 'react';

/**
 * Ingestion-date timeline brush. Binds to `ingested_at` on each point.
 * Cosmograph renders the brush and updates the point filter automatically.
 */
const GraphTimeline: FC = () => {
  return (
    <div
      className="vie-graph-timeline"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <CosmographTimeline accessor="ingested_at" />
    </div>
  );
};

export default GraphTimeline;
