'use client';

import type { Tension, Assumption } from '@/lib/commonplace-models';

/**
 * TensionBrick: content for the Tensions module.
 *
 * Renders each tension with severity indicator (shape + color),
 * description text, and linked assumption labels (A1, A2...).
 * Tensions surface contradictions and unresolved questions
 * between assumptions in the model.
 */

interface TensionBrickProps {
  tensions: Tension[];
  assumptions: Assumption[];
}

const SEVERITY_STYLE: Record<
  string,
  { icon: string; color: string }
> = {
  high: { icon: '\u25A0', color: '#C4503C' },
  medium: { icon: '\u25C6', color: '#D4944A' },
  low: { icon: '\u25CB', color: 'var(--cp-text-faint, #68666E)' },
};

export default function TensionBrick({
  tensions,
  assumptions,
}: TensionBrickProps) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {tensions.map((tension) => {
        const sev = SEVERITY_STYLE[tension.severity];
        return (
          <div
            key={tension.id}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            {/* Severity shape */}
            <span
              style={{
                color: sev.color,
                fontSize: 10,
                flexShrink: 0,
                marginTop: 3,
              }}
              title={`${tension.severity} severity`}
            >
              {sev.icon}
            </span>

            <div style={{ flex: 1 }}>
              {/* Text */}
              <div
                style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 12,
                  color: 'var(--cp-text, #18181B)',
                  lineHeight: 1.5,
                  marginBottom: 4,
                }}
              >
                {tension.text}
              </div>

              {/* Linked assumptions */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {tension.linkedAssumptionIds.map((aId) => {
                  const idx = assumptions.findIndex((a) => a.id === aId);
                  const label = idx >= 0 ? `A${idx + 1}` : `A?`;
                  return (
                    <span
                      key={aId}
                      style={{
                        fontFamily: 'var(--cp-font-mono)',
                        fontSize: 9,
                        fontWeight: 500,
                        letterSpacing: '0.04em',
                        padding: '1px 6px',
                        borderRadius: 2,
                        background: 'var(--cp-surface, #F8F7F4)',
                        color: 'var(--cp-text-muted, #48464E)',
                        border: '1px solid var(--cp-border-faint, #ECEAE6)',
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
