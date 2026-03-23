'use client';

import { useRef, useState, useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import SchematicTree from './SchematicTree';
import type { SchematicData } from './readme-data';

interface MarginSchematicProps {
  data: SchematicData;
}

/**
 * Scroll-triggered schematic that sits in the right margin of its parent section.
 *
 * The parent must have `position: relative` and `overflow: visible`.
 * On wide viewports (>=1200px), the schematic floats in the right margin area.
 * On narrow viewports, it's hidden (no margin space).
 *
 * Entrance animation: slides from the text edge rightward into the margin,
 * creating a "from text into margin" effect.
 *
 * Observes a sentinel div inside the content flow (not the absolutely positioned
 * schematic itself) because body overflow-x: clip can interfere with
 * IntersectionObserver for elements positioned in the margin.
 */
export default function MarginSchematic({ data }: MarginSchematicProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setIsVisible(true);
      return;
    }
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <>
      {/* Sentinel: sits in the content flow where the observer can see it */}
      <div
        ref={sentinelRef}
        aria-hidden="true"
        style={{ height: '1px', width: '1px', position: 'absolute', top: '80px', left: 0, pointerEvents: 'none' }}
      />
      <div
        className="margin-schematic"
        style={{
          position: 'absolute',
          right: '-240px',
          top: '52px',
          width: '280px',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateX(0)' : 'translateX(-60px)',
          transition: reducedMotion
            ? 'none'
            : 'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <SchematicTree data={data} variant="full" isVisible={isVisible} />
      </div>
    </>
  );
}
