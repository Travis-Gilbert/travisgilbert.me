'use client';

import type { FalsificationCriterion } from '@/lib/commonplace-models';

interface FalsifyBrickProps {
  criteria: FalsificationCriterion[];
}

export default function FalsifyBrick({
  criteria,
}: FalsifyBrickProps): React.JSX.Element {
  if (criteria.length === 0) {
    return (
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-text-faint, #68666E)',
          fontStyle: 'italic',
        }}
      >
        No falsification criteria defined.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {criteria.map((criterion, i) => (
        <div
          key={criterion.id}
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'flex-start',
            padding: '3px 0',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
              fontWeight: 600,
              color: '#B8623D',
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            F{i + 1}
          </span>
          <span
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: 11.5,
              color: 'var(--cp-text, #18181B)',
              lineHeight: 1.4,
            }}
          >
            {criterion.text}
          </span>
        </div>
      ))}
    </div>
  );
}
