'use client';

/**
 * StatusBadge: pill showing the epistemic status of an Object's claims.
 *
 * Dashed border = machine-generated (unreviewed).
 * Solid border = human-confirmed (at least one claim reviewed).
 * Fill color only for refuted (background tint warns of belief revision).
 */

const STATUS_COLORS: Record<string, { border: string; text: string; fill: string }> = {
  proposed:   { border: '#88868E', text: '#88868E', fill: 'transparent' },
  supported:  { border: '#0F6E56', text: '#0F6E56', fill: 'transparent' },
  contested:  { border: '#A32D2D', text: '#A32D2D', fill: 'transparent' },
  refuted:    { border: '#A32D2D', text: '#791F1F', fill: '#FCEBEB' },
  superseded: { border: '#88868E', text: '#88868E', fill: 'transparent' },
};

interface StatusBadgeProps {
  status: string;
  confirmed: boolean;
}

export default function StatusBadge({ status, confirmed }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  if (!colors) return null;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 18,
        padding: '0 8px',
        borderRadius: 14,
        border: `1px ${confirmed ? 'solid' : 'dashed'} ${colors.border}`,
        backgroundColor: colors.fill,
        color: colors.text,
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 10,
        fontWeight: 500,
        lineHeight: 1,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
        letterSpacing: '0.04em',
        fontFeatureSettings: 'var(--cp-kern-mono)',
      }}
    >
      {status}
    </span>
  );
}
