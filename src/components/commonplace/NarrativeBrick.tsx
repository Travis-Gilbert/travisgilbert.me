'use client';

import type { Narrative } from '@/lib/commonplace-models';

interface NarrativeBrickProps {
  narratives: Narrative[];
  onOpenObject?: (objectRef: number) => void;
}

export default function NarrativeBrick({
  narratives,
  onOpenObject,
}: NarrativeBrickProps): React.JSX.Element {
  if (narratives.length === 0) {
    return (
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 11,
          color: 'var(--cp-text-faint, #68666E)',
          fontStyle: 'italic',
        }}
      >
        No narratives written.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {narratives.map((narrative) => (
        <div
          key={narrative.id}
          onClick={() => onOpenObject?.(narrative.objectRef)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 0',
            cursor: onOpenObject ? 'pointer' : 'default',
          }}
        >
          {/* Green pip */}
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: '#2E8A3E',
              flexShrink: 0,
            }}
          />

          {/* Title */}
          <span
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: 11.5,
              fontWeight: 500,
              color: 'var(--cp-text, #18181B)',
              flex: 1,
              lineHeight: 1.4,
            }}
          >
            {narrative.title}
          </span>

          {/* Type label */}
          {narrative.narrativeType && (
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 7,
                color: 'var(--cp-text-faint, #68666E)',
                flexShrink: 0,
              }}
            >
              {narrative.narrativeType}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
