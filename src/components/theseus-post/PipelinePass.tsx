'use client';

// PipelinePass.tsx: Pipeline pass row for the TECHNICAL "Under the Hood" section.
// 2-column grid: 36px terracotta number | 1fr content.
// Supports staggered scroll reveal via opacity/transform transition.

interface PipelinePassProps {
  num: number;
  name: string;
  tech: string;
  description: string;
  isVisible?: boolean;
  delay?: number;
}

export default function PipelinePass({
  num,
  name,
  tech,
  description,
  isVisible = true,
  delay = 0,
}: PipelinePassProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr',
        gap: 16,
        padding: '20px 0',
        borderBottom: '1px solid rgba(53, 53, 60, 0.6)',
        opacity: isVisible ? 1 : 0.3,
        transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 600ms ease ${delay}ms, transform 600ms ease ${delay}ms`,
      }}
    >
      {/* Pass number */}
      <div
        style={{
          fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
          fontSize: 14,
          fontWeight: 600,
          color: '#C4503C',
          paddingTop: 2,
        }}
      >
        {String(num).padStart(2, '0')}
      </div>

      {/* Pass content */}
      <div>
        <div style={{ marginBottom: 4 }}>
          <span
            style={{
              fontFamily: 'var(--font-title, "Vollkorn", Georgia, serif)',
              fontSize: 16,
              fontWeight: 600,
              color: '#D8D6DC',
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
              fontSize: 11,
              color: '#6A7080',
              marginLeft: 12,
            }}
          >
            {tech}
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
