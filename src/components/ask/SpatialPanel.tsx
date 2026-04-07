'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface SpatialPanelProps {
  anchorX: number;
  anchorY: number;
  text: string;
  complete: boolean;
  onDismiss?: () => void;
}

/**
 * DOM overlay panel that blooms from a clicked node position on the galaxy
 * canvas. Renders when a response exceeds the inline threshold. Supports
 * text selection, links, and scrolling.
 */
export default function SpatialPanel({
  anchorX,
  anchorY,
  text,
  complete,
  onDismiss,
}: SpatialPanelProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [bloomed, setBloomed] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Trigger bloom animation on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setBloomed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Dismiss on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onDismiss?.();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onDismiss]);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        left: anchorX,
        top: anchorY,
        zIndex: 15,
        pointerEvents: 'auto',
        minWidth: 320,
        maxWidth: 480,
        maxHeight: 400,
        overflowY: 'auto',
        background: 'var(--vie-surface-panel)',
        border: '1px solid var(--vie-surface-panel-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: 'var(--vie-surface-panel-glow)',
        borderRadius: 16,
        padding: '20px 24px',
        transform: prefersReducedMotion ? 'scale(1)' : (bloomed ? 'scale(1)' : 'scale(0.92)'),
        opacity: prefersReducedMotion ? 1 : (bloomed ? 1 : 0),
        transition: prefersReducedMotion
          ? 'none'
          : 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease',
        transformOrigin: 'top left',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--vie-font-body)',
          fontSize: 14,
          lineHeight: 1.65,
          color: 'var(--vie-text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
        {!complete && (
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 14,
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              background: 'var(--vie-teal)',
              animation: 'vie-cursor-blink 1s step-end infinite',
            }}
          />
        )}
      </div>
    </div>
  );
}
