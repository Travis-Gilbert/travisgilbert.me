'use client';

import type { CodeImpactResult } from '@/lib/theseus-types';

interface Props {
  impact: CodeImpactResult | null;
  focalSymbol: string | null;
}

/**
 * Legend overlay for ImpactCanvas. Bottom-left position. Shows depth
 * ring labels and total affected count. Communities are labeled by id
 * because labels live in backend cluster metadata, not on the symbol.
 */
export default function ImpactLegend({ impact, focalSymbol }: Props) {
  if (!impact || !focalSymbol) return null;

  return (
    <div className="ce-legend">
      <div className="ce-legend-head">
        <span className="ce-legend-focal">{focalSymbol}</span>
        <span className="ce-legend-count">{impact.total_affected} affected</span>
      </div>

      <div className="ce-legend-rings">
        {impact.depth_groups.map((group) => (
          <div key={group.depth} className="ce-legend-ring">
            <span className="ce-legend-ring-dot" data-depth={group.depth} />
            <span className="ce-legend-ring-label">
              Depth {group.depth}
            </span>
            <span className="ce-legend-ring-count">{group.symbols.length}</span>
          </div>
        ))}
      </div>

      <div className="ce-legend-hint">
        Node size by PPR. Click to refocus.
      </div>
    </div>
  );
}
