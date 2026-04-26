'use client';

import { useMemo } from 'react';

/**
 * Approximate polyline length from an "M x y L x y L x y..." path string.
 * Pure function: no DOM measurement, no setState, no render loop.
 */
function approxPathLength(d: string): number {
  if (!d) return 0;
  const tokens = d.match(/-?\d+(\.\d+)?/g);
  if (!tokens || tokens.length < 4) return 0;
  let len = 0;
  for (let i = 2; i < tokens.length; i += 2) {
    const dx = +tokens[i] - +tokens[i - 2];
    const dy = +tokens[i + 1] - +tokens[i - 1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

interface DottedSegmentProps {
  d: string;
  color: string;
  /** Monotonic seconds since component mount; drives draw-in. */
  drawT: number;
  /** Seconds before this segment starts drawing. */
  delay: number;
  /** Total seconds for this segment to draw fully. */
  dur: number;
  /** Color of the page background: used for the masking stroke. */
  paperColor?: string;
}

/**
 * Dotted geodesic segment with a slow draw-in.
 *
 * Two stacked paths:
 *  1. The dotted reveal: full-length, dashed at 1.4 / 5.
 *  2. A paper-colored masking stroke that retreats from `len` to `0` over
 *     `dur` seconds (cubic ease-out). When the mask is fully retreated,
 *     the dotted path is fully visible.
 */
export default function DottedSegment({
  d,
  color,
  drawT,
  delay,
  dur,
  paperColor = 'var(--color-paper, #F5E6D2)',
}: DottedSegmentProps) {
  const len = useMemo(() => approxPathLength(d), [d]);
  const t = Math.max(0, Math.min(1, (drawT - delay) / dur));
  const eased = 1 - Math.pow(1 - t, 3);
  const visibleLen = len * eased;

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeDasharray="1.4 5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <path
        d={d}
        fill="none"
        stroke={paperColor}
        strokeWidth="3.4"
        strokeLinecap="butt"
        strokeDasharray={`${Math.max(0, len - visibleLen)} ${len}`}
        strokeDashoffset={-visibleLen}
        style={{ pointerEvents: 'none' }}
      />
    </g>
  );
}
