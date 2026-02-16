/**
 * SectionLabel — Monospace section identifier
 *
 * Adds the "INVESTIGATION FILE" / "FIELD OBSERVATION" / "PROJECT ARCHIVE"
 * monospace label above section headings, in a section-specific color
 * from the brand palette (terracotta, teal, gold).
 */

type SectionColor = 'terracotta' | 'teal' | 'gold';

interface SectionLabelProps {
  children: string;
  color?: SectionColor;
}

const colorMap: Record<SectionColor, string> = {
  terracotta: 'text-terracotta',
  teal: 'text-teal',
  gold: 'text-gold',
};

export default function SectionLabel({
  children,
  color = 'terracotta',
}: SectionLabelProps) {
  return (
    <span
      className={`block font-mono text-[11px] uppercase tracking-[0.1em] mb-2 select-none ${colorMap[color]}`}
    >
      {children}
    </span>
  );
}
