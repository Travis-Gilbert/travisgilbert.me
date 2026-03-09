/**
 * TensionBadge: amber pill for cards that have tension/counter edges.
 *
 * Renders inline with the card's metadata row. The label is determined
 * by the most specific matching edge_type:
 *   - 'counter*'   -> CONFLICT
 *   - 'tension*'   -> TENSION
 *   - fallback     -> TENSION
 *
 * Reuses the amber constant from RetroNote (#D4944A) for visual consistency.
 */

const AMBER = '#D4944A';

interface TensionBadgeProps {
  /** The edge_type string from the most prominent tension edge */
  edgeType?: string;
}

export default function TensionBadge({ edgeType }: TensionBadgeProps) {
  const label =
    edgeType?.toLowerCase().includes('counter') ? 'CONFLICT' : 'TENSION';

  return (
    <span
      className="cp-tension-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 6px',
        border: `1px solid ${AMBER}`,
        borderRadius: 3,
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 9,
        letterSpacing: '0.08em',
        color: AMBER,
        lineHeight: 1.6,
        flexShrink: 0,
      }}
    >
      {/* Small diamond marker */}
      <svg
        width={5}
        height={5}
        viewBox="0 0 5 5"
        fill={AMBER}
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <polygon points="2.5,0 5,2.5 2.5,5 0,2.5" />
      </svg>
      {label}
    </span>
  );
}
