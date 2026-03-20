'use client';

// LevelRow.tsx: Roadmap level row for the TECHNICAL section.
// 2-column grid: 50px level number | 1fr content.
// Status-colored indicator: shipped, in-progress, planned, research.

type LevelStatus = 'shipped' | 'in-progress' | 'planned' | 'research';

const STATUS_COLORS: Record<LevelStatus, string> = {
  shipped: '#4A7A5A',
  'in-progress': '#C49A4A',
  planned: '#6B4F7A',
  research: '#4A6A8A',
};

const STATUS_LABELS: Record<LevelStatus, string> = {
  shipped: 'SHIPPED',
  'in-progress': 'IN PROGRESS',
  planned: 'PLANNED',
  research: 'RESEARCH',
};

interface LevelRowProps {
  level: number;
  name: string;
  description: string;
  status: LevelStatus;
}

export default function LevelRow({
  level,
  name,
  description,
  status,
}: LevelRowProps) {
  const color = STATUS_COLORS[status];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '50px 1fr',
        gap: 16,
        padding: '16px 0',
        borderBottom: '1px solid rgba(53, 53, 60, 0.6)',
      }}
    >
      {/* Level number */}
      <div
        style={{
          fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
          fontSize: 13,
          fontWeight: 600,
          color,
          paddingTop: 2,
        }}
      >
        L{level}
      </div>

      {/* Level content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
              fontSize: 15,
              fontWeight: 600,
              color: '#D8D6DC',
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color,
              padding: '2px 6px',
              border: `1px solid ${color}`,
              borderRadius: 3,
            }}
          >
            {STATUS_LABELS[status]}
          </span>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-body, "IBM Plex Sans", sans-serif)',
            fontSize: 13,
            fontWeight: 300,
            lineHeight: 1.6,
            color: '#9A9488',
            margin: 0,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
