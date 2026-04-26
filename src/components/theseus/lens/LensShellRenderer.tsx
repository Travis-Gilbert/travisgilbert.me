'use client';

import type { LensLayout } from './useLensLayout';
import { LENS_CENTER, LENS_RADII } from './useLensLayout';

interface Props {
  layout: LensLayout;
  hoverId: string | null;
  onHoverId: (id: string | null) => void;
  showLabels: boolean;
  shellHover: 'inner' | 'middle' | 'outer' | null;
}

const ASPECT_Y = 0.92;
const TICK_COUNT = 24;
const TICK_BASE_R = 70;
const TICK_MAJOR_R = 78;
const TICK_MINOR_R = 74;

export default function LensShellRenderer({
  layout,
  hoverId,
  onHoverId,
  showLabels,
  shellHover,
}: Props) {
  void layout;
  void hoverId;
  void onHoverId;
  void showLabels;

  return (
    <g className="lens-shells">
      {/* Concentric orbital rings with engraved meridian aesthetic. */}
      {(['outer', 'middle', 'inner'] as const).map((shell) => (
        <ellipse
          key={shell}
          cx={LENS_CENTER.x}
          cy={LENS_CENTER.y}
          rx={LENS_RADII[shell]}
          ry={LENS_RADII[shell] * ASPECT_Y}
          fill="none"
          stroke="var(--paper-pencil)"
          strokeOpacity={shellHover === shell ? 0.5 : 0.18}
          strokeWidth={0.5}
        />
      ))}

      {/* 24-tick reference scale at r=70 with major every 6th. */}
      {Array.from({ length: TICK_COUNT }).map((_, i) => {
        const a = (i / TICK_COUNT) * Math.PI * 2 - Math.PI / 2;
        const isMajor = i % 6 === 0;
        const rOuter = isMajor ? TICK_MAJOR_R : TICK_MINOR_R;
        return (
          <line
            key={i}
            x1={LENS_CENTER.x + Math.cos(a) * TICK_BASE_R}
            y1={LENS_CENTER.y + Math.sin(a) * TICK_BASE_R * ASPECT_Y}
            x2={LENS_CENTER.x + Math.cos(a) * rOuter}
            y2={LENS_CENTER.y + Math.sin(a) * rOuter * ASPECT_Y}
            stroke="var(--paper-pencil)"
            strokeOpacity={isMajor ? 0.55 : 0.30}
            strokeWidth={isMajor ? 0.7 : 0.4}
          />
        );
      })}
    </g>
  );
}
