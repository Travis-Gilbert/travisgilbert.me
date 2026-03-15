'use client';

import type { Method } from '@/lib/commonplace-models';

interface MethodBrickProps {
  methods: Method[];
}

const STATUS_COLOR: Record<string, string> = {
  reviewed: 'var(--cp-term-green, #6AAA6A)',
  active: 'var(--cp-term-green, #6AAA6A)',
  draft: 'var(--cp-term-amber, #CCAA44)',
  planned: 'var(--cp-term-muted, #68666E)',
  completed: 'var(--cp-term-green, #6AAA6A)',
};

export default function MethodBrick({
  methods,
}: MethodBrickProps): React.JSX.Element {
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
        No methods defined.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {methods.map((method) => {
        const statusColor = STATUS_COLOR[method.status] ?? '#68666E';
        return (
          <div
            key={method.id}
            style={{
              background: 'var(--cp-term, #1A1C22)',
              border: '1px solid var(--cp-term-border, #2A2C32)',
              borderRadius: 4,
              padding: '4px 6px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                color: 'var(--cp-term-text, #D4D4D8)',
                lineHeight: 1.4,
              }}
            >
              {method.title}
            </div>
            <div
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: statusColor,
                marginTop: 2,
              }}
            >
              {method.status}
              {method.runs != null ? ` \u00B7 ${method.runs} runs` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
