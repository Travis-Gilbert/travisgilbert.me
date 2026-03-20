'use client';

// FloatingAnnotation.tsx: MODE: FLOATING positioned text blocks for closing section.
// Text blocks placed directly on the maze like annotations on a patent drawing.
// Each has minimal frosted backing (60% opacity, 4px blur).
// On mobile, collapses to centered vertical stack via theseus-post.css.

import type { ReactNode, CSSProperties } from 'react';

interface FloatingAnnotationProps {
  children: ReactNode;
  /** CSS position for desktop (absolute within parent) */
  style?: CSSProperties;
  className?: string;
}

export default function FloatingAnnotation({
  children,
  style = {},
  className = '',
}: FloatingAnnotationProps) {
  return (
    <div
      className={`floating-annotation ${className}`}
      style={{
        background: 'rgba(244, 243, 240, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: '24px 28px',
        maxWidth: 420,
        fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
