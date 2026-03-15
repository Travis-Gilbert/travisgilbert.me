'use client';

import type { Narrative } from '@/lib/commonplace-models';

/**
 * NarrativeBrick: content for the Narratives module.
 *
 * Narratives are Objects (type: note or concept) that synthesize
 * the model's argument into a readable form. They link back to
 * the Object system via objectRef for opening in the drawer.
 *
 * Rendered as a compact list: title is the primary element,
 * clickable to open the full Object.
 */

interface NarrativeBrickProps {
  narratives: Narrative[];
  onOpenObject?: (objectRef: number) => void;
}

export default function NarrativeBrick({
  narratives,
  onOpenObject,
}: NarrativeBrickProps) {
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
        No narratives written. Synthesize your argument into a
        readable form.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {narratives.map((narrative) => (
        <button
          key={narrative.id}
          onClick={() => onOpenObject?.(narrative.objectRef)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderRadius: 3,
            border: '1px solid var(--cp-border-faint, #ECEAE6)',
            cursor: onOpenObject ? 'pointer' : 'default',
            background: '#FFFFFF',
            transition: 'background 0.1s ease',
            width: '100%',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'var(--cp-surface, #F8F7F4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#FFFFFF';
          }}
        >
          {/* Document icon (simple line art) */}
          <span
            style={{
              fontSize: 13,
              color: 'var(--cp-text-faint, #68666E)',
              flexShrink: 0,
            }}
          >
            &#x2261;
          </span>

          {/* Title */}
          <span
            style={{
              fontFamily: 'var(--cp-font-body)',
              fontSize: 12,
              color: 'var(--cp-text, #18181B)',
              flex: 1,
              lineHeight: 1.4,
            }}
          >
            {narrative.title}
          </span>

          {/* Arrow */}
          <span
            style={{
              fontSize: 10,
              color: 'var(--cp-text-faint, #68666E)',
              flexShrink: 0,
            }}
          >
            &#x2192;
          </span>
        </button>
      ))}
    </div>
  );
}
