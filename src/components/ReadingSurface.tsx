'use client';

/**
 * ReadingSurface: a textured, ruled container that signals "reading zone."
 *
 * Three layers behind prose content:
 * 1. Backdrop blur (softens DotGrid underneath)
 * 2. Paper grain (feTurbulence, different frequency from body grain)
 * 3. Left margin rule (teal vertical line)
 *
 * Ruled lines are applied per-element via CSS (.reading-surface .prose p, h2, h3)
 * so they track actual text baselines.
 *
 * All theme-dependent values (shadow, grain opacity, margin rule opacity)
 * are handled via CSS using html[data-theme="dark"] selectors to avoid
 * hydration mismatches.
 */

interface ReadingSurfaceProps {
  children: React.ReactNode;
  className?: string;
}

export default function ReadingSurface({
  children,
  className = '',
}: ReadingSurfaceProps) {
  return (
    <div className={`reading-surface ${className}`}>
      {/* Paper grain overlay */}
      <div
        aria-hidden="true"
        className="reading-surface-grain"
      >
        <svg width="100%" height="100%" className="reading-surface-grain-svg">
          <filter id="reading-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="4"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#reading-grain)" />
        </svg>
      </div>

      {/* Left margin rule */}
      <div
        aria-hidden="true"
        className="reading-surface-margin-rule"
      />

      {/* Content sits above texture layers */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
