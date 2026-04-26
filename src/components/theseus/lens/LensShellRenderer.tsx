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

export default function LensShellRenderer({
  layout,
  hoverId,
  onHoverId,
  showLabels,
  shellHover,
}: Props) {
  // Hover handler / labels / layout placeholders are wired in later tasks.
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
    </g>
  );
}
