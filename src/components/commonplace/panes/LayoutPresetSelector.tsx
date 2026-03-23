'use client';

import { LAYOUT_PRESETS } from '@/lib/commonplace-layout';
import { useLayout } from '@/lib/providers/layout-provider';

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
 *   Research: two columns (55/45)
 *   Studio: three columns (33/37/30)
 */
export default function LayoutPresetSelector({
  activePresetName,
  onSelect,
}: LayoutPresetSelectorProps) {
  const { resetLayout } = useLayout();

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
      <button
        className="cp-layout-preset cp-layout-reset"
        onClick={() => { resetLayout(); onSelect(0); }}
        title="Reset layout"
        aria-label="Reset layout to Focus"
      >
        <ResetIcon />
      </button>
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

    case 'Research':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* Left column: 55% */}
          <rect x={0.5} y={0.5} width={w * 0.55 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
          {/* Right column: 45% */}
          <rect x={w * 0.55 + gap / 2} y={0.5} width={w * 0.45 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
        </svg>
      );

    case 'Studio':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* Left column: 33% */}
          <rect x={0.5} y={0.5} width={w * 0.33 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
          {/* Center column: ~37% */}
          <rect x={w * 0.33 + gap / 2} y={0.5} width={w * 0.37 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
          {/* Right column: ~30% */}
          <rect x={w * 0.7 + gap / 2} y={0.5} width={w * 0.3 - gap} height={h - 1} rx={r} stroke={stroke} fill={fill} strokeWidth={sw} />
        </svg>
      );

    default:
      return null;
  }
}

/** Small circular-arrow icon for the reset button */
function ResetIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 2.5v3.5h3.5" />
      <path d="M1.5 6C2.1 3.4 4.3 1.5 7 1.5c3 0 5.5 2.5 5.5 5.5s-2.5 5.5-5.5 5.5a5.5 5.5 0 0 1-4.7-2.7" />
    </svg>
  );
}
