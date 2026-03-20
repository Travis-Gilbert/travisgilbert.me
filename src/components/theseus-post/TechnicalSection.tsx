'use client';

// TechnicalSection.tsx: MODE: TECHNICAL dark terminal surface.
// Full viewport width, dark background (#1A1C22 at 95% opacity).
// The maze is faintly visible through the 5% transparency.
// Used for pipeline passes and roadmap.

import { forwardRef, type ReactNode } from 'react';

interface TechnicalSectionProps {
  id: string;
  children: ReactNode;
}

const TechnicalSection = forwardRef<HTMLElement, TechnicalSectionProps>(
  function TechnicalSection({ id, children }, ref) {
    return (
      <section
        ref={ref}
        id={id}
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'rgba(26, 28, 34, 0.95)',
          padding: '64px 0',
          borderTop: '1px solid rgba(42, 38, 32, 0.4)',
          borderBottom: '1px solid rgba(42, 38, 32, 0.4)',
          fontFeatureSettings: "'kern' 1, 'liga' 1, 'calt' 1",
        }}
      >
        <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 32px' }}>
          {children}
        </div>
      </section>
    );
  },
);

export default TechnicalSection;
