'use client';

import type { Tension } from '@/lib/commonplace-models';

interface TensionBrickProps {
  tensions: Tension[];
}

const SEVERITY_COLOR: Record<string, string> = {
  high: '#C4503C',
  medium: '#D4944A',
  low: '#68666E',
};

function DiamondIcon({ color }: { color: string }): React.JSX.Element {
  return (
    <svg width={5} height={5} viewBox="0 0 5 5" style={{ flexShrink: 0 }}>
      <polygon points="2.5,0 5,2.5 2.5,5 0,2.5" fill={color} />
    </svg>
  );
}

export default function TensionBrick({
  tensions,
}: TensionBrickProps): React.JSX.Element {
  if (tensions.length === 0) {
    return (
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-text-faint, #68666E)',
          fontStyle: 'italic',
        }}
      >
        No tensions detected between assumptions.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {tensions.map((tension) => {
        const color = SEVERITY_COLOR[tension.severity] ?? '#68666E';
        return (
          <div
            key={tension.id}
            style={{
              border: '1px solid var(--cp-border-faint, #ECEAE6)',
              borderRadius: 4,
              padding: '4px 6px',
            }}
          >
            {/* Severity + linked assumptions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 2,
              }}
            >
              <DiamondIcon color={color} />
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color,
                }}
              >
                {tension.severity}
              </span>
              {tension.linkedAssumptionIds.map((aId) => (
                <span
                  key={aId}
                  style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 8,
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                    padding: '0px 4px',
                    borderRadius: 2,
                    background: 'var(--cp-surface, #F8F7F4)',
                    color: 'var(--cp-text-faint, #68666E)',
                  }}
                >
                  A{aId}
                </span>
              ))}
            </div>

            {/* Title */}
            <div
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--cp-text, #18181B)',
                lineHeight: 1.4,
              }}
            >
              {tension.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
