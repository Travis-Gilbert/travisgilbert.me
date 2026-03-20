'use client';

// ContentSection.tsx: Frosted-glass editorial content wrapper (MODE: EDITORIAL).
// 740px centered column, backdrop-blur, translucent parchment background.
// The primary prose container for long-form content sections.

import { forwardRef, type ReactNode } from 'react';

interface ContentSectionProps {
  id: string;
  children: ReactNode;
  className?: string;
}

const ContentSection = forwardRef<HTMLElement, ContentSectionProps>(
  function ContentSection({ id, children, className = '' }, ref) {
    return (
      <section
        ref={ref}
        id={id}
        className={className}
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 740,
          margin: '0 auto',
          padding: '48px 32px',
          background: 'rgba(244, 243, 240, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderLeft: '1px solid rgba(212, 207, 198, 0.3)',
          borderRight: '1px solid rgba(212, 207, 198, 0.3)',
          fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
        }}
      >
        {children}
      </section>
    );
  },
);

export default ContentSection;
