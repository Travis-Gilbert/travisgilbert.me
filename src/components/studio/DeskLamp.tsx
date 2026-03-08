'use client';

import { useMemo } from 'react';

const STAGE_WASH: Record<string, string> = {
  idea: 'rgba(154,142,130,0.025)',
  research: 'rgba(58,138,154,0.02)',
  drafting: 'rgba(212,170,74,0.03)',
  revising: 'rgba(138,106,154,0.02)',
  production: 'rgba(180,90,45,0.025)',
  published: 'rgba(106,154,90,0.02)',
};

/**
 * Ambient desk lamp glow overlay for the writing surface.
 *
 * Renders two radial gradients: a warm static lamp cone and a
 * stage-reactive color wash that subtly shifts when the content
 * advances through stages.
 */
export default function DeskLamp({ stage }: { stage: string }) {
  const wash = useMemo(() => STAGE_WASH[stage] ?? STAGE_WASH.idea, [stage]);

  return (
    <div
      className="studio-desk-lamp"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        background: `
          radial-gradient(ellipse 900px 600px at 54% 48%, rgba(245,238,220,0.06) 0%, transparent 65%),
          radial-gradient(ellipse 600px 400px at 54% 48%, ${wash} 0%, transparent 50%)
        `,
        transition: 'background 1.2s ease',
      }}
    />
  );
}
