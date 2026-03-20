'use client';

// SplitSection.tsx: MODE: SPLIT asymmetric two-column layout.
// Content on one side (55%), maze visible on the other (45%).
// The "x" concept made visual: Theseus on one side, CommonPlace on the other.
// On mobile (<768px), collapses to full-width editorial mode via theseus-post.css.

import { forwardRef, type ReactNode } from 'react';

interface SplitSectionProps {
  id: string;
  children: ReactNode;
  /** Which side the content column appears on */
  contentSide: 'left' | 'right';
}

const SplitSection = forwardRef<HTMLDivElement, SplitSectionProps>(
  function SplitSection({ id, children, contentSide }, ref) {
    const isLeft = contentSide === 'left';

    return (
      <div
        ref={ref}
        id={id}
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '80vh',
          fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
        }}
      >
        <div
          className="split-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: isLeft ? '520px 1fr' : '1fr 520px',
            minHeight: '80vh',
          }}
        >
          {isLeft ? (
            <>
              <div
                className="split-content"
                style={{
                  background: 'rgba(244, 243, 240, 0.88)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  padding: '64px 40px',
                  borderRight: '1px solid rgba(212, 207, 198, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                {children}
              </div>
              <div className="split-open">{/* Open: maze shows through */}</div>
            </>
          ) : (
            <>
              <div className="split-open">{/* Open: maze shows through */}</div>
              <div
                className="split-content"
                style={{
                  background: 'rgba(244, 243, 240, 0.88)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  padding: '64px 40px',
                  borderLeft: '1px solid rgba(212, 207, 198, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                {children}
              </div>
            </>
          )}
        </div>
      </div>
    );
  },
);

export default SplitSection;
