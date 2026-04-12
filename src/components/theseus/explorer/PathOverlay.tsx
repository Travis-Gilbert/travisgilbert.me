'use client';

import { useEffect, useState, useCallback } from 'react';
import { pathBetween } from '@/lib/theseus-api';
import type { PathResult } from '@/lib/theseus-types';

interface PathOverlayProps {
  nodeA: string;
  nodeB: string;
  onPathLoaded?: (path: PathResult) => void;
  onClear: () => void;
}

/**
 * PathOverlay: fetches and displays a path between two selected nodes.
 *
 * Renders as a floating panel showing the path steps with numbered badges.
 * The actual edge highlighting is done in GraphRenderer via props.
 */
export default function PathOverlay({ nodeA, nodeB, onPathLoaded, onClear }: PathOverlayProps) {
  const [path, setPath] = useState<PathResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPath = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await pathBetween(nodeA, nodeB);
    if (result.ok) {
      setPath(result);
      onPathLoaded?.(result);
    } else {
      setError('Could not compute path');
    }
    setLoading(false);
  }, [nodeA, nodeB, onPathLoaded]);

  // Auto-load on mount
  useEffect(() => {
    loadPath();
  }, [loadPath]);

  if (loading) {
    return (
      <div className="explorer-path-overlay" style={overlayStyle}>
        <div style={headerStyle}>
          <span style={labelStyle}>Computing path...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="explorer-path-overlay" style={overlayStyle}>
        <div style={headerStyle}>
          <span style={labelStyle}>{error}</span>
          <button type="button" onClick={onClear} style={closeBtnStyle}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!path || path.length === -1) {
    return (
      <div className="explorer-path-overlay" style={overlayStyle}>
        <div style={headerStyle}>
          <span style={labelStyle}>No path found (disconnected nodes)</span>
          <button type="button" onClick={onClear} style={closeBtnStyle}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="explorer-path-overlay" style={overlayStyle}>
      <div style={headerStyle}>
        <span style={labelStyle}>
          Path ({path.length} step{path.length !== 1 ? 's' : ''})
        </span>
        <button type="button" onClick={onClear} style={closeBtnStyle}>
          Close
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px' }}>
        {path.nodes.map((nodeId, index) => (
          <div key={nodeId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'var(--vie-teal-ghost, rgba(74, 138, 150, 0.15))',
                color: 'var(--vie-teal-ink, #4A8A96)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontFamily: 'var(--vie-font-mono, monospace)',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {index + 1}
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--vie-ink-1, #F4F3F0)',
                fontFamily: 'var(--vie-font-sans, sans-serif)',
              }}
            >
              {nodeId}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 25,
  background: 'var(--vie-panel-bg, #242220)',
  border: '1px solid var(--vie-border, rgba(255,255,255,0.08))',
  borderRadius: 8,
  minWidth: 200,
  maxWidth: 360,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid var(--vie-border, rgba(255,255,255,0.08))',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--vie-font-mono, monospace)',
  color: 'var(--vie-ink-2, #b5b0a8)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--vie-ink-3, #7a7670)',
  fontSize: 11,
  fontFamily: 'var(--vie-font-mono, monospace)',
  padding: '2px 6px',
};
