'use client';

import { useRef, useState, useEffect, lazy, Suspense } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import MarginSchematic from './MarginSchematic';
import type { SchematicData } from './readme-data';

const PatentMazeBackground = lazy(() => import('./PatentMazeBackground'));

/**
 * The parent .readme-page uses this padding formula to center content.
 * We negate it to break out to full width, then re-apply it for inner content.
 */
const BLEED_MARGIN = 'calc(-1 * max(24px, calc(50vw - 380px)))';
const BLEED_PADDING = 'max(24px, calc(50vw - 380px))';

interface PatentSectionProps {
  children: React.ReactNode;
  schematicData?: SchematicData;
}

export function PatentLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-code)',
        fontSize: '10px',
        fontWeight: 500,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.14em',
        color: 'var(--color-patent-text-tertiary)',
        marginBottom: '22px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <span>{children}</span>
      <span
        style={{
          flex: 1,
          height: '1px',
          background: 'var(--color-patent-border)',
        }}
      />
    </div>
  );
}

export default function PatentSection({ children, schematicData }: PatentSectionProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const el = innerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      className="patent-section"
      style={{
        padding: '52px 0',
        background: 'var(--color-patent-bg)',
        color: 'var(--color-patent-text)',
        position: 'relative',
        marginLeft: BLEED_MARGIN,
        marginRight: BLEED_MARGIN,
        paddingLeft: BLEED_PADDING,
        paddingRight: BLEED_PADDING,
        overflow: 'visible',
      }}
    >
      {/* Teal grid overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: [
            'repeating-linear-gradient(0deg, transparent, transparent 23px, var(--color-patent-grid) 23px, var(--color-patent-grid) 24px)',
            'repeating-linear-gradient(90deg, transparent, transparent 23px, var(--color-patent-grid) 23px, var(--color-patent-grid) 24px)',
          ].join(', '),
        }}
      />
      {/* Patent maze background at 8% opacity */}
      <Suspense fallback={null}>
        <PatentMazeBackground />
      </Suspense>
      {/* Content (ref on inner div for IntersectionObserver) */}
      <div
        ref={innerRef}
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '760px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'none' : 'translateY(14px)',
          transition: reducedMotion
            ? 'none'
            : 'opacity 0.45s ease, transform 0.45s ease',
        }}
      >
        {children}
        {schematicData && <MarginSchematic data={schematicData} />}
      </div>
    </div>
  );
}
