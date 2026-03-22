'use client';

import { useState, useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';

interface ComposeCatalogSplitProps {
  /** The compose editor panel */
  composeContent: React.ReactNode;
  /** The compressed catalog panel */
  catalogContent: React.ReactNode;
  /** Discovery dock content (sits below catalog) */
  discoveryContent?: React.ReactNode;
  /** Called when user clicks "Back to full catalog" */
  onExitSplit: () => void;
  /** Called when user clicks "Full compose" (maximize compose) */
  onFullCompose: () => void;
}

const MIN_COMPOSE_HEIGHT = 200;
const MIN_CATALOG_HEIGHT = 120;
const DEFAULT_RATIO = 0.55;

export default function ComposeCatalogSplit({
  composeContent,
  catalogContent,
  discoveryContent,
  onExitSplit,
  onFullCompose,
}: ComposeCatalogSplitProps) {
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const container = containerRef.current;
      if (!container) return;

      const handleMove = (ev: MouseEvent) => {
        if (!isDragging.current || !container) return;
        const bounds = container.getBoundingClientRect();
        const totalHeight = bounds.height;
        const y = ev.clientY - bounds.top;
        let nextRatio = y / totalHeight;

        const minComposeRatio = MIN_COMPOSE_HEIGHT / totalHeight;
        const maxComposeRatio = 1 - MIN_CATALOG_HEIGHT / totalHeight;
        nextRatio = Math.max(minComposeRatio, Math.min(maxComposeRatio, nextRatio));

        setRatio(nextRatio);
      };

      const handleUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [],
  );

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 10px',
    fontSize: 10,
    fontFamily: 'var(--font-metadata)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--cp-chrome-muted)',
    borderBottom: '1px solid var(--cp-chrome-line)',
  };

  const linkStyle: CSSProperties = {
    cursor: 'pointer',
    color: 'var(--cp-teal)',
    fontSize: 10,
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Compose section */}
      <div style={{ height: `${ratio * 100}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={headerStyle}>
          <span>Field Notes</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={linkStyle} onClick={onExitSplit} role="button" tabIndex={0}>
              Back to full
            </span>
            <span style={linkStyle} onClick={onFullCompose} role="button" tabIndex={0}>
              Expand
            </span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{composeContent}</div>
      </div>

      {/* Draggable divider */}
      <div
        onMouseDown={handleDividerMouseDown}
        style={{
          height: 5,
          cursor: 'row-resize',
          backgroundColor: 'var(--cp-chrome-line)',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 24,
            height: 3,
            borderRadius: 2,
            backgroundColor: 'var(--cp-chrome-muted)',
          }}
        />
      </div>

      {/* Catalog section */}
      <div
        style={{
          height: `${(1 - ratio) * 100}%`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={headerStyle}>
          <span>Catalog</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>{catalogContent}</div>
        {discoveryContent && (
          <div style={{ borderTop: '1px solid var(--cp-chrome-line)' }}>
            {discoveryContent}
          </div>
        )}
      </div>
    </div>
  );
}
