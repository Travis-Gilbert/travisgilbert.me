/**
 * SectionLabel: Monospace section identifier
 *
 * Two variants:
 *   site (default): Tailwind styled span with brand color class.
 *     Used on main site section pages (essays, field notes, projects).
 *   studio: Flex container with label text + 1px horizontal rule.
 *     Uses CSS custom properties from .studio-theme scope.
 *     Accepts raw hex color via hexColor prop.
 */

type SectionColor = 'terracotta' | 'teal' | 'gold';

interface SectionLabelProps {
  children: string;
  color?: SectionColor;
  /** 'site' for main site, 'studio' for Studio pages */
  variant?: 'site' | 'studio';
  /** Raw hex color for studio variant (e.g., '#B45A2D') */
  hexColor?: string;
}

const colorMap: Record<SectionColor, string> = {
  terracotta: 'text-terracotta',
  teal: 'text-teal',
  gold: 'text-gold',
};

export default function SectionLabel({
  children,
  color = 'terracotta',
  variant = 'site',
  hexColor,
}: SectionLabelProps) {
  if (variant === 'studio') {
    const labelColor = hexColor ?? 'rgba(237, 231, 220, 0.38)';
    const lineColor = hexColor
      ? `color-mix(in srgb, ${hexColor} 20%, transparent)`
      : 'rgba(180, 90, 45, 0.1)';

    return (
      <div
        className="studio-section-head"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.22em',
            color: labelColor,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {children}
        </span>
        <span
          style={{
            flex: 1,
            height: '1px',
            backgroundColor: lineColor,
          }}
        />
      </div>
    );
  }

  return (
    <span
      className={`block font-mono text-[11px] uppercase tracking-[0.1em] mb-2 select-none ${colorMap[color]}`}
    >
      {children}
    </span>
  );
}
