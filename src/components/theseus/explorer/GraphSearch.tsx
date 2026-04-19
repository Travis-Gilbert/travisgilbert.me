'use client';

import { CosmographSearch } from '@cosmograph/react';
import type { FC } from 'react';

/**
 * Graph search affordance. Cosmograph binds the search UI to the nearest
 * <Cosmograph> instance automatically via React context, so this is a
 * thin styled wrapper.
 */
const GraphSearch: FC = () => {
  return (
    <div
      className="vie-graph-search"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        padding: 4,
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <CosmographSearch accessor="label" />
    </div>
  );
};

export default GraphSearch;
