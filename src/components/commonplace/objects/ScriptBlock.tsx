'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import TerminalBlock from '../TerminalBlock';
import RoughBorder from '../RoughBorder';

const STATUS_COLORS: Record<string, string> = {
  active: '#4ADE80',
  running: '#4ADE80',
  idle: '#94A3B8',
  error: '#F87171',
  failed: '#F87171',
  complete: '#60A5FA',
  done: '#60A5FA',
};

// Steel color for script/terminal cards
const STEEL = '#94A3B8';

export default function ScriptBlock({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const status = object.status ?? 'idle';

  return (
    <RoughBorder seed={object.slug} glow glowColor={STEEL}>
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
      className="cp-object-card cp-object-script"
    >
      <TerminalBlock
        title={title}
        status={status in STATUS_COLORS ? (status as 'idle' | 'running' | 'complete' | 'error' | 'degraded') : 'idle'}
        compact={compact}
      >
        {!compact && object.body ? object.body : title}
      </TerminalBlock>
    </button>
    </RoughBorder>
  );
}
