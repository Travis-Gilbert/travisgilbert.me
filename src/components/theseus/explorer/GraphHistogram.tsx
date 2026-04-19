'use client';

import { CosmographHistogram } from '@cosmograph/react';
import type { FC } from 'react';

/**
 * PageRank histogram brush. Filters the graph to points whose pagerank
 * falls within the brushed range.
 */
const GraphHistogram: FC = () => {
  return (
    <div
      className="vie-graph-histogram"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <CosmographHistogram accessor="pagerank" />
    </div>
  );
};

export default GraphHistogram;
