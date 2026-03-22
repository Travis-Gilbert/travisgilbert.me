'use client';

import type { ViewType } from '@/lib/commonplace';
import { VIEW_REGISTRY } from '@/lib/commonplace';
import styles from './PaneHeader.module.css';

interface PaneHeaderProps {
  viewId: ViewType;
  paneId: string;
  isFocused: boolean;
  isFullscreen: boolean;
  leafCount: number;
  onSplitH: () => void;
  onSplitV: () => void;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onSplitPreview?: (direction: 'horizontal' | 'vertical' | null) => void;
}

export default function PaneHeader({
  viewId,
  paneId: _paneId,
  isFocused,
  isFullscreen,
  leafCount,
  onSplitH,
  onSplitV,
  onToggleFullscreen,
  onClose,
  onSplitPreview,
}: PaneHeaderProps) {
  const reg = VIEW_REGISTRY[viewId];

  return (
    <div
      className="cp-pane-header"
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        background: isFocused ? 'var(--cp-chrome-mid)' : 'var(--cp-chrome)',
        borderBottom: isFocused
          ? '2px solid #B8623D'
          : '1px solid var(--cp-chrome-line)',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontFamily: 'var(--font-metadata)',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: isFocused ? 'var(--cp-text)' : 'var(--cp-text-dim)',
          }}
        >
          {reg?.label ?? viewId}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <HeaderButton
          title="Split horizontal (Ctrl+\)"
          onClick={onSplitH}
          onMouseEnter={() => onSplitPreview?.('horizontal')}
          onMouseLeave={() => onSplitPreview?.(null)}
        >
          <SplitHIcon />
        </HeaderButton>
        <HeaderButton
          title="Split vertical (Ctrl+-)"
          onClick={onSplitV}
          onMouseEnter={() => onSplitPreview?.('vertical')}
          onMouseLeave={() => onSplitPreview?.(null)}
        >
          <SplitVIcon />
        </HeaderButton>
        <HeaderButton
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? <CollapseIcon /> : <ExpandIcon />}
        </HeaderButton>
        {leafCount > 1 && (
          <HeaderButton title="Close pane (Ctrl+W)" onClick={onClose}>
            <CloseIcon />
          </HeaderButton>
        )}
      </div>
    </div>
  );
}

function HeaderButton({
  title,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  title: string;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: 'var(--cp-chrome-dim)',
        cursor: 'pointer',
        transition: 'color 150ms, background 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--cp-chrome-text)';
        e.currentTarget.style.background = 'var(--cp-chrome-raise)';
        onMouseEnter?.();
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--cp-chrome-dim)';
        e.currentTarget.style.background = 'transparent';
        onMouseLeave?.();
      }}
    >
      {children}
    </button>
  );
}

/* Inline SVG icons (zero dependency) */

function SplitHIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x={1} y={1} width={5} height={12} rx={1} />
      <rect x={8} y={1} width={5} height={12} rx={1} />
    </svg>
  );
}

function SplitVIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x={1} y={1} width={12} height={5} rx={1} />
      <rect x={1} y={8} width={12} height={5} rx={1} />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polyline points="1,5 1,1 5,1" />
      <polyline points="9,1 13,1 13,5" />
      <polyline points="13,9 13,13 9,13" />
      <polyline points="5,13 1,13 1,9" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <polyline points="5,1 5,5 1,5" />
      <polyline points="9,5 13,5 9,1" />
      <polyline points="9,13 9,9 13,9" />
      <polyline points="1,9 5,9 5,13" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <line x1={3} y1={3} x2={11} y2={11} />
      <line x1={11} y1={3} x2={3} y2={11} />
    </svg>
  );
}
