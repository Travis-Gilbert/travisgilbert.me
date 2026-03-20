'use client';

// PatinaSvg.tsx: Aged parchment overlay rendered as a fixed SVG.
// Foxing spots, fold lines, edge darkening, color pools, paper grain.
// All positions generated deterministically from mazeRand.

import { useMemo } from 'react';
import { mulberry32 } from './roughMaze';

interface FoxingSpot {
  cx: number;
  cy: number;
  r: number;
  opacity: number;
}

interface ColorPool {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string;
  opacity: number;
}

export default function PatinaSvg() {
  const { foxing, pools } = useMemo(() => {
    const rand = mulberry32(1952 + 7); // offset seed for variety

    const spots: FoxingSpot[] = [];
    for (let i = 0; i < 50; i++) {
      spots.push({
        cx: rand() * 100,
        cy: rand() * 100,
        r: 0.3 + rand() * 1.7,
        opacity: 0.015 + rand() * 0.035,
      });
    }

    const colorPools: ColorPool[] = [
      {
        cx: 20 + rand() * 30,
        cy: 30 + rand() * 40,
        rx: 15 + rand() * 10,
        ry: 12 + rand() * 8,
        fill: '#d8c8a0',
        opacity: 0.05,
      },
      {
        cx: 60 + rand() * 30,
        cy: 50 + rand() * 30,
        rx: 18 + rand() * 8,
        ry: 14 + rand() * 6,
        fill: '#c8b890',
        opacity: 0.04,
      },
      {
        cx: 40 + rand() * 20,
        cy: 70 + rand() * 20,
        rx: 12 + rand() * 8,
        ry: 10 + rand() * 5,
        fill: '#d0c098',
        opacity: 0.035,
      },
    ];

    return { foxing: spots, pools: colorPools };
  }, []);

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
      }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Foxing blur */}
        <filter id="patina-blur">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
        {/* Paper grain noise */}
        <filter id="paper-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="4"
            seed={1952}
            result="noise"
          />
          <feColorMatrix
            type="saturate"
            values="0"
            in="noise"
            result="mono"
          />
          <feBlend in="SourceGraphic" in2="mono" mode="multiply" />
        </filter>
      </defs>

      {/* Color pools (uneven yellowing of aged paper) */}
      {pools.map((pool, i) => (
        <ellipse
          key={`pool-${i}`}
          cx={pool.cx}
          cy={pool.cy}
          rx={pool.rx}
          ry={pool.ry}
          fill={pool.fill}
          opacity={pool.opacity}
        />
      ))}

      {/* Foxing spots */}
      {foxing.map((spot, i) => (
        <circle
          key={`fox-${i}`}
          cx={spot.cx}
          cy={spot.cy}
          r={spot.r}
          fill="#8a7050"
          opacity={spot.opacity}
          filter="url(#patina-blur)"
        />
      ))}

      {/* Fold lines */}
      <line
        x1="0"
        y1="50"
        x2="100"
        y2="50"
        stroke="#8a7050"
        strokeWidth="0.08"
        opacity="0.05"
      />
      <line
        x1="48"
        y1="0"
        x2="48"
        y2="100"
        stroke="#8a7050"
        strokeWidth="0.06"
        opacity="0.04"
      />

      {/* Edge darkening (vignette) */}
      {/* Top edge */}
      <rect x="0" y="0" width="100" height="8" fill="url(#edge-top)" />
      {/* Bottom edge */}
      <rect x="0" y="88" width="100" height="12" fill="url(#edge-bottom)" />
      {/* Left edge */}
      <rect x="0" y="0" width="6" height="100" fill="url(#edge-left)" />
      {/* Right edge */}
      <rect x="94" y="0" width="6" height="100" fill="url(#edge-right)" />

      <defs>
        <linearGradient id="edge-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a5e52" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6a5e52" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="edge-bottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a5e52" stopOpacity="0" />
          <stop offset="100%" stopColor="#6a5e52" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="edge-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6a5e52" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#6a5e52" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="edge-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6a5e52" stopOpacity="0" />
          <stop offset="100%" stopColor="#6a5e52" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Paper grain overlay */}
      <rect
        x="0"
        y="0"
        width="100"
        height="100"
        fill="transparent"
        filter="url(#paper-grain)"
        opacity="0.03"
      />
    </svg>
  );
}
