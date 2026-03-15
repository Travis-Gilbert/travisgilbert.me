'use client';

import type { CanonicalReference, AgreementLevel } from '@/lib/commonplace-models';

/**
 * CompareBrick: content for the Compare module (always visible).
 *
 * Shows canonical references that the model agrees with, partially
 * agrees with, or disagrees with. This is the "how does your model
 * relate to established work" section.
 *
 * Agreement uses a three-level visual: green bar (agrees), amber
 * partial bar, red bar (disagrees). Each reference shows its source
 * title and a brief summary of the relationship.
 */

interface CompareBrickProps {
  references: CanonicalReference[];
  onOpenObject?: (objectRef: number) => void;
}

const AGREEMENT_STYLE: Record<
  AgreementLevel,
  { label: string; color: string; barWidth: string }
> = {
  agrees: { label: 'Agrees', color: '#2E8A3E', barWidth: '100%' },
  partial: { label: 'Partial', color: '#D4944A', barWidth: '50%' },
  disagrees: { label: 'Disagrees', color: '#C4503C', barWidth: '100%' },
};

export default function CompareBrick({
  references,
  onOpenObject,
}: CompareBrickProps) {
  if (references.length === 0) {
    return (
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-text-faint, #68666E)',
          fontStyle: 'italic',
        }}
      >
        No canonical references linked. Add established works to
        compare your model against.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {references.map((ref) => {
        const agreement = AGREEMENT_STYLE[ref.agreement];
        return (
          <div key={ref.id}>
            {/* Title + agreement label */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <button
                onClick={() => onOpenObject?.(ref.objectRef)}
                style={{
                  fontFamily: 'var(--cp-font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cp-text, #18181B)',
                  flex: 1,
                  cursor: onOpenObject ? 'pointer' : 'default',
                  lineHeight: 1.4,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                }}
              >
                {ref.objectTitle}
              </button>
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: agreement.color,
                  flexShrink: 0,
                }}
              >
                {agreement.label}
              </span>
            </div>

            {/* Agreement bar */}
            <div
              style={{
                height: 2,
                background: 'var(--cp-border-faint, #ECEAE6)',
                borderRadius: 1,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: agreement.barWidth,
                  background: agreement.color,
                  borderRadius: 1,
                }}
              />
            </div>

            {/* Summary */}
            <div
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 12,
                color: 'var(--cp-text-muted, #48464E)',
                lineHeight: 1.5,
              }}
            >
              {ref.summary}
            </div>
          </div>
        );
      })}
    </div>
  );
}
