'use client';

// MarginNote.tsx: Margin annotations that pop out of the content column.
// Desktop (>1100px): positioned absolutely into the right margin.
// Mobile: inline block with left-border accent.
// Responsive behavior handled by theseus-post.css.

import type { ReactNode } from 'react';

interface MarginNoteProps {
  label: string;
  color?: string;
  children: ReactNode;
}

export default function MarginNote({
  label,
  color = '#2D5F6B',
  children,
}: MarginNoteProps) {
  return (
    <>
      {/* Desktop: absolute positioned in right margin */}
      <aside
        className="margin-note-desktop"
        style={{
          position: 'absolute',
          right: -280,
          width: 220,
          borderLeft: `2px solid ${color}`,
          paddingLeft: 16,
          fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color,
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body, "IBM Plex Sans", sans-serif)',
            fontSize: 12,
            fontWeight: 300,
            lineHeight: 1.6,
            color: '#6B6560',
          }}
        >
          {children}
        </div>
      </aside>

      {/* Mobile: inline with left-border accent */}
      <aside
        className="margin-note-mobile"
        style={{
          borderLeft: `2px solid ${color}`,
          paddingLeft: 16,
          margin: '24px 0',
          fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono, "Courier Prime", monospace)',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body, "IBM Plex Sans", sans-serif)',
            fontSize: 13,
            fontWeight: 300,
            lineHeight: 1.6,
            color: '#6B6560',
          }}
        >
          {children}
        </div>
      </aside>
    </>
  );
}
