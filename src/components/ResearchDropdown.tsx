'use client';

/**
 * ResearchDropdown: collapsible author research note for a connection.
 *
 * Uses native <details>/<summary> for progressive enhancement.
 * Renders nothing when no researchNote is provided.
 */

interface ResearchDropdownProps {
  researchNote?: string;
  color: string;
}

export default function ResearchDropdown({ researchNote, color }: ResearchDropdownProps) {
  if (!researchNote) return null;

  return (
    <details
      className="mt-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <summary
        className="cursor-pointer select-none font-mono uppercase tracking-[0.08em] list-none"
        style={{ fontSize: 8, color, opacity: 0.55 }}
      >
        Research Note &#9662;
      </summary>
      <p
        className="mt-1 mb-0 leading-relaxed"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'var(--color-ink-secondary)',
          lineHeight: 1.5,
        }}
      >
        {researchNote}
      </p>
    </details>
  );
}
