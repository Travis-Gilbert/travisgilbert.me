'use client';

import type { Method } from '@/lib/commonplace-models';

/**
 * MethodBrick: content for the Methods module.
 *
 * Methods are the investigative procedures attached to a model:
 * how you would test or validate the assumptions. Each method
 * has a title, description, and status (active/completed/planned).
 */

interface MethodBrickProps {
  methods: Method[];
}

const STATUS_STYLE: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  active: {
    label: 'Active',
    color: '#1A7A8A',
    bg: 'rgba(26, 122, 138, 0.08)',
  },
  completed: {
    label: 'Done',
    color: '#2E8A3E',
    bg: 'rgba(46, 138, 62, 0.08)',
  },
  planned: {
    label: 'Planned',
    color: 'var(--cp-text-faint, #68666E)',
    bg: 'var(--cp-surface, #F8F7F4)',
  },
};

export default function MethodBrick({ methods }: MethodBrickProps) {
  if (methods.length === 0) {
    return (
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-text-faint, #68666E)',
          fontStyle: 'italic',
        }}
      >
        No methods defined. Add investigative procedures to test
        assumptions.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {methods.map((method) => {
        const status = STATUS_STYLE[method.status];
        return (
          <div key={method.id}>
            {/* Title row + status */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--cp-text, #18181B)',
                  flex: 1,
                  lineHeight: 1.4,
                }}
              >
                {method.title}
              </span>
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: status.color,
                  background: status.bg,
                  padding: '2px 6px',
                  borderRadius: 2,
                  flexShrink: 0,
                }}
              >
                {status.label}
              </span>
            </div>

            {/* Description */}
            <div
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 12,
                color: 'var(--cp-text-muted, #48464E)',
                lineHeight: 1.5,
              }}
            >
              {method.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}
