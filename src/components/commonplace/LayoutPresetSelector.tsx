'use client';

import { LAYOUT_PRESETS } from '@/lib/commonplace-layout';

interface LayoutPresetSelectorProps {
  activePresetName: string | null;
  onSelect: (presetIndex: number) => void;
}

/**
 * Layout preset selector: small icons representing each
 * split configuration. Lives in the sidebar or toolbar.
 *
 * Each icon is a simple SVG showing the split topology:
 *   Focus: single pane
 *   Compare: two columns
 *   Research: left column + right column split top/bottom
 *   Connect: left column + right column split top/bottom (wider right)
 */
export default function LayoutPresetSelector({
  activePresetName,
  onSelect,
}: LayoutPresetSelectorProps) {
  return (
    <div className="cp-layout-selector">
      {LAYOUT_PRESETS.map((preset, i) => (
        <button
          key={preset.name}
          className="cp-layout-preset"
          data-active={activePresetName === preset.name ? 'true' : 'false'}
          onClick={() => onSelect(i)}
          title={preset.name}
          aria-label={`${preset.name} layout`}
        >
          <PresetIcon name={preset.name} />
        </button>
      ))}
    </div>
  );
}

function PresetIcon({ name }: { name: string }) {
  const w = 24;
  const h = 16;
  const gap = 1.5;
  const r = 1;
  const stroke = 'currentColor';
  const fill = 'none';
  const sw = 1;

  switch (name) {
    case 'Focus':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
        </svg>
      );

    case 'Compare':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={0.5} y={0.5} width={w / 2 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
          <rect x={w / 2 + gap / 2} y={0.5} width={w / 2 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
        </svg>
      );

    case 'Research':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* Left column: ~45% */}
          <rect x={0.5} y={0.5} width={w * 0.45 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
          {/* Right column top: ~55% of width, ~55% of height */}
          <rect x={w * 0.45 + gap / 2} y={0.5} width={w * 0.55 - gap} height={h * 0.55 - gap} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
          {/* Right column bottom */}
          <rect x={w * 0.45 + gap / 2} y={h * 0.55 + gap / 2} width={w * 0.55 - gap} height={h * 0.45 - gap} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
        </svg>
      );

    case 'Connect':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* Left column: 50% */}
          <rect x={0.5} y={0.5} width={w * 0.5 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
          {/* Right column top */}
          <rect x={w * 0.5 + gap / 2} y={0.5} width={w * 0.5 - gap} height={h * 0.5 - gap} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
          {/* Right column bottom */}
          <rect x={w * 0.5 + gap / 2} y={h * 0.5 + gap / 2} width={w * 0.5 - gap} height={h * 0.5 - gap} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
        </svg>
      );

    default:
      return null;
  }
}
