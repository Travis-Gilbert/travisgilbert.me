'use client';

/**
 * Patent maze SVG rendered at 8% opacity as a background texture
 * in patent sections. Uses simplified wall paths tinted with teal.
 * The maze is Claude Shannon's Theseus (maze-navigating mouse).
 */
export default function PatentMazeBackground() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1400 2000"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        opacity: 0.08,
        pointerEvents: 'none',
        objectFit: 'cover',
      }}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Simplified maze walls */}
      <g stroke="var(--color-teal)" strokeWidth="2" fill="none" opacity="0.6">
        {/* Outer boundary */}
        <rect x="100" y="100" width="1200" height="1800" rx="2" />
        {/* Horizontal walls */}
        <line x1="100" y1="400" x2="700" y2="400" />
        <line x1="900" y1="400" x2="1300" y2="400" />
        <line x1="300" y1="700" x2="1100" y2="700" />
        <line x1="100" y1="1000" x2="600" y2="1000" />
        <line x1="800" y1="1000" x2="1300" y2="1000" />
        <line x1="200" y1="1300" x2="900" y2="1300" />
        <line x1="1100" y1="1300" x2="1300" y2="1300" />
        <line x1="100" y1="1600" x2="500" y2="1600" />
        <line x1="700" y1="1600" x2="1300" y2="1600" />
        {/* Vertical walls */}
        <line x1="400" y1="100" x2="400" y2="400" />
        <line x1="700" y1="400" x2="700" y2="700" />
        <line x1="1000" y1="100" x2="1000" y2="400" />
        <line x1="300" y1="700" x2="300" y2="1000" />
        <line x1="600" y1="700" x2="600" y2="1000" />
        <line x1="900" y1="700" x2="900" y2="1000" />
        <line x1="1100" y1="1000" x2="1100" y2="1300" />
        <line x1="500" y1="1000" x2="500" y2="1300" />
        <line x1="200" y1="1300" x2="200" y2="1600" />
        <line x1="700" y1="1300" x2="700" y2="1600" />
        <line x1="1000" y1="1300" x2="1000" y2="1600" />
        <line x1="400" y1="1600" x2="400" y2="1900" />
        <line x1="800" y1="1600" x2="800" y2="1900" />
        {/* Inner detail walls */}
        <line x1="550" y1="200" x2="550" y2="400" />
        <line x1="850" y1="500" x2="850" y2="700" />
        <line x1="400" y1="800" x2="400" y2="1000" />
        <line x1="750" y1="1100" x2="750" y2="1300" />
        <line x1="350" y1="1400" x2="350" y2="1600" />
        <line x1="1050" y1="1500" x2="1050" y2="1700" />
        <line x1="600" y1="1700" x2="600" y2="1900" />
      </g>
      {/* Labels */}
      <g
        fill="var(--color-patent-text-tertiary)"
        fontFamily="var(--font-code)"
        fontSize="11"
        opacity="0.5"
      >
        <text x="200" y="250">ENTRY</text>
        <text x="650" y="550">PIPELINE</text>
        <text x="400" y="850">NEURONS</text>
        <text x="850" y="1150">WEIGHTS</text>
        <text x="550" y="1450">INFERENCE</text>
        <text x="300" y="1750">EXIT</text>
      </g>
    </svg>
  );
}
