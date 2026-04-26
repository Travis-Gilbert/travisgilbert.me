'use client';

import type { LensLayout } from './useLensLayout';
import { LENS_CENTER, LENS_RADII } from './useLensLayout';

interface Props {
  layout: LensLayout;
  hoverId: string | null;
  onHoverId: (id: string | null) => void;
  showLabels: boolean;
  shellHover: 'inner' | 'middle' | 'outer' | null;
  focusedTitle: string;
  focusedDisplayId: string;
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
  focusedTitle,
  focusedDisplayId,
}: Props) {
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
            key={`tick-${i}`}
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

      {/* Faint radial spokes from focused pole to each neighbor. */}
      {layout.placed.map((nb) => (
        <line
          key={`spoke-${nb.id}`}
          x1={LENS_CENTER.x}
          y1={LENS_CENTER.y}
          x2={nb.x}
          y2={nb.y}
          stroke="var(--paper-pencil)"
          strokeWidth={0.4}
          opacity={shellHover ? 0.05 : 0.18}
        />
      ))}

      {/* Curved Bezier edges from focused pole to each neighbor. */}
      {layout.placed.map((nb) => {
        const isHover = nb.id === hoverId;
        const a = LENS_CENTER;
        const b = { x: nb.x, y: nb.y };
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const px = -dy / len;
        const py = dx / len;
        const bend = 18;
        const cx = mx + px * bend;
        const cy = my + py * bend;
        const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
        const dimmed = !isHover && shellHover && shellHover !== nb.shell;
        const dash =
          nb.edgeType === 'pairs'
            ? '3 3'
            : nb.edgeType === 'interacts'
              ? '1 2'
              : nb.edgeType === 'cites'
                ? '5 2'
                : 'none';
        return (
          <path
            key={`edge-${nb.id}`}
            d={d}
            fill="none"
            stroke={isHover ? 'var(--paper-pencil)' : 'var(--paper-ink)'}
            strokeOpacity={isHover ? 0.85 : dimmed ? 0.10 : 0.32}
            strokeWidth={isHover ? 1.0 : 0.55}
            strokeDasharray={dash}
          />
        );
      })}

      {/* Neighbor halos + nuclei with shell-conditional opacity tiers. */}
      {layout.placed.map((nb) => {
        const isHover = nb.id === hoverId;
        const isOuter = nb.shell === 'outer';
        const showKindLabel = showLabels && (!isOuter || isHover);
        const showEdgeLabel = showLabels && (!isOuter || isHover);
        const edgeLabelText =
          nb.edgeLabel ?? nb.edgeType.replace(/[-_]/g, ' ').toUpperCase();
        const baseR = 5;
        const haloR = baseR * (isHover ? 4.2 : nb.shell === 'inner' ? 3.2 : 2.6);
        const haloOp = isHover ? 0.85 : nb.shell === 'inner' ? 0.55 : 0.40;
        return (
          <g
            key={`node-${nb.id}`}
            onMouseEnter={() => onHoverId(nb.id)}
            onMouseLeave={() => onHoverId(null)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={nb.x}
              cy={nb.y}
              r={haloR}
              fill="url(#lens-halo)"
              opacity={haloOp}
              pointerEvents="none"
            />
            <circle
              cx={nb.x}
              cy={nb.y}
              r={baseR}
              fill="var(--paper-ink)"
              stroke="var(--paper-pencil)"
              strokeWidth={isHover ? 1 : 0.5}
              opacity={0.95}
            />
            {isHover && (
              <circle
                cx={nb.x}
                cy={nb.y}
                r={baseR * 0.35}
                fill="var(--paper)"
                opacity={0.9}
                pointerEvents="none"
              />
            )}
            {showKindLabel && (
              <text
                x={nb.x}
                y={nb.y - 11}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={9}
                fill="var(--paper-ink)"
                opacity={0.85}
                pointerEvents="none"
              >
                {nb.kind}
              </text>
            )}
            {showEdgeLabel && (
              <text
                x={nb.x}
                y={nb.y + 11}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={7.5}
                letterSpacing="0.18em"
                fill="var(--paper-pencil)"
                opacity={0.75}
                pointerEvents="none"
              >
                {edgeLabelText}
              </text>
            )}
          </g>
        );
      })}

      {/* Focused-node celestial pole. */}
      <g className="lens-pole">
        <circle
          cx={LENS_CENTER.x}
          cy={LENS_CENTER.y}
          r={50}
          fill="none"
          stroke="var(--paper-pencil)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.85}
        />
        <circle
          cx={LENS_CENTER.x}
          cy={LENS_CENTER.y}
          r={32}
          fill="none"
          stroke="var(--paper-pencil)"
          strokeWidth={0.5}
          strokeDasharray="2 4"
          opacity={0.55}
        />
        <circle
          cx={LENS_CENTER.x}
          cy={LENS_CENTER.y}
          r={14}
          fill="var(--paper-pencil)"
          stroke="var(--paper-ink)"
          strokeWidth={1.4}
          opacity={0.85}
        />
        <circle
          cx={LENS_CENTER.x}
          cy={LENS_CENTER.y}
          r={5}
          fill="var(--paper)"
          opacity={0.9}
        />
      </g>

      {/* Focal label and display id below the celestial pole. */}
      <text
        x={LENS_CENTER.x}
        y={LENS_CENTER.y + 36}
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize={15}
        fill="var(--paper-ink)"
      >
        {focusedTitle}
      </text>
      <text
        x={LENS_CENTER.x}
        y={LENS_CENTER.y + 52}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing="0.22em"
        fill="var(--paper-pencil)"
        opacity={0.6}
      >
        {focusedDisplayId}
      </text>
    </g>
  );
}
