'use client';

/**
 * SignalPips: tiny colored dots indicating epistemic signals on an object.
 *
 * Visible on hover (opacity transition via parent .cp-object-card class).
 * Each pip type has a fixed color and tooltip explaining what it means.
 * Dormant pips render as hollow rings instead of filled circles.
 */

import type { TagSummaryPip } from '@/lib/commonplace';

const PIP_CONFIG: Record<string, { color: string; opacity: number; ring?: boolean; tooltip: string }> = {
  evidence:  { color: '#0F6E56', opacity: 0.7, tooltip: '{count} supporting evidence links' },
  tension:   { color: '#BA7517', opacity: 0.7, tooltip: '{count} open tensions' },
  refuted:   { color: '#A32D2D', opacity: 0.7, tooltip: 'Belief revised: claims refuted' },
  candidate: { color: '#534AB7', opacity: 0.6, tooltip: '{count} unlinked candidates' },
  dormant:   { color: '#88868E', opacity: 0.5, ring: true, tooltip: 'No evidence activity in 90+ days' },
};

/** Fixed rendering order so pips are spatially stable. */
const PIP_ORDER = ['evidence', 'tension', 'refuted', 'candidate', 'dormant'];

interface SignalPipsProps {
  pips: TagSummaryPip[];
}

export default function SignalPips({ pips }: SignalPipsProps) {
  if (!pips || pips.length === 0) return null;

  const sorted = PIP_ORDER
    .map(type => pips.find(p => p.type === type))
    .filter((p): p is TagSummaryPip => p != null);

  if (sorted.length === 0) return null;

  return (
    <span className="cp-signal-pips">
      {sorted.map(pip => {
        const config = PIP_CONFIG[pip.type];
        if (!config) return null;
        const tooltip = config.tooltip.replace('{count}', String(pip.count));
        return (
          <span
            key={pip.type}
            title={tooltip}
            className={config.ring ? 'cp-signal-pip cp-signal-pip--dormant' : 'cp-signal-pip'}
            style={{
              backgroundColor: config.ring ? 'transparent' : config.color,
              opacity: config.opacity,
              border: config.ring ? `1px solid ${config.color}` : 'none',
            }}
          />
        );
      })}
    </span>
  );
}
