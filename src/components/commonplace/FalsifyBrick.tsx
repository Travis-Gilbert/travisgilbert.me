'use client';

import type { FalsificationCriterion } from '@/lib/commonplace-models';

/**
 * FalsifyBrick: content for the Falsification module.
 *
 * Lists the conditions under which the model's assumptions would
 * be invalidated. Each criterion has a status: untested (neutral),
 * holds (green, the criterion still stands), or failed (red, the
 * criterion was met, meaning the assumption is falsified).
 *
 * This is a Popperian instrument: a model that cannot specify
 * falsification criteria is not yet rigorous.
 */

interface FalsifyBrickProps {
  criteria: FalsificationCriterion[];
}

const STATUS_STYLE: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  untested: {
    label: 'Untested',
    icon: '\u25CB',
    color: 'var(--cp-text-faint, #68666E)',
  },
  holds: {
    label: 'Holds',
    icon: '\u2713',
    color: '#2E8A3E',
  },
  failed: {
    label: 'Failed',
    icon: '\u2717',
    color: '#C4503C',
  },
};

export default function FalsifyBrick({ criteria }: FalsifyBrickProps) {
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
        No falsification criteria defined. What evidence would
        invalidate this model?
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {criteria.map((criterion) => {
        const status = STATUS_STYLE[criterion.status];
        return (
          <div
            key={criterion.id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            {/* Status icon */}
            <span
              style={{
                color: status.color,
                fontSize: 12,
                flexShrink: 0,
                marginTop: 1,
                fontWeight: 600,
              }}
              title={status.label}
            >
              {status.icon}
            </span>

            {/* Criterion text */}
            <div
              style={{
                flex: 1,
                fontFamily: 'var(--cp-font-body)',
                fontSize: 12,
                color:
                  criterion.status === 'failed'
                    ? 'var(--cp-text-faint, #68666E)'
                    : 'var(--cp-text, #18181B)',
                lineHeight: 1.5,
                textDecoration:
                  criterion.status === 'failed'
                    ? 'line-through'
                    : 'none',
              }}
            >
              {criterion.text}
            </div>

            {/* Status label */}
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: status.color,
                flexShrink: 0,
              }}
            >
              {status.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
