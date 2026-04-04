'use client';

import type { CanonicalReference } from '@/lib/commonplace-models';
import { AGREEMENT_STYLE } from '@/lib/commonplace-models';

interface CompareBrickProps {
  references: CanonicalReference[];
  onOpenObject?: (objectRef: number, objectSlug?: string) => void;
}

export default function CompareBrick({
  references,
  onOpenObject,
}: CompareBrickProps): React.JSX.Element {
  if (references.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 6,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-text-faint, #68666E)',
            fontStyle: 'italic',
          }}
        >
          No canonical references linked.
        </div>
        <button
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#7050A0',
            background: 'rgba(112, 80, 160, 0.08)',
            border: '1px solid rgba(112, 80, 160, 0.2)',
            borderRadius: 3,
            padding: '3px 8px',
            cursor: 'pointer',
          }}
        >
          search references
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {references.map((ref) => {
        const agreement = AGREEMENT_STYLE[ref.agreement];
        return (
          <div
            key={ref.id}
            onClick={() => onOpenObject?.(ref.objectRef)}
            style={{
              borderRadius: 4,
              border: '1px solid var(--cp-border-faint, #ECEAE6)',
              padding: '4px 6px',
              cursor: onOpenObject ? 'pointer' : 'default',
            }}
          >
            {/* Title */}
            <div
              style={{
                fontFamily: 'var(--cp-font-body)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--cp-text, #18181B)',
                lineHeight: 1.4,
              }}
            >
              {ref.objectTitle}
            </div>

            {/* Source */}
            {ref.source && (
              <div
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 7,
                  color: 'var(--cp-text-faint, #68666E)',
                  marginTop: 1,
                }}
              >
                {ref.source}
              </div>
            )}

            {/* Agreement + note */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginTop: 3,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: agreement?.color ?? '#68666E',
                }}
              >
                {agreement?.label ?? ref.agreement}
              </span>
              {ref.summary && (
                <span
                  style={{
                    fontFamily: 'var(--cp-font-body)',
                    fontSize: 10,
                    color: 'var(--cp-text-muted, #48464E)',
                    lineHeight: 1.3,
                  }}
                >
                  {ref.summary}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
