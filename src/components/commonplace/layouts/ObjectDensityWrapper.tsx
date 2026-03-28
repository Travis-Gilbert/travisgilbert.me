'use client';

/**
 * ObjectDensityWrapper: click-to-cycle density with FLIP-style height animation.
 *
 * Cycle order: chip -> card -> expanded -> chip
 * State is component-local (not persisted). Navigating away resets.
 *
 * Render-prop pattern: children receives the current density.
 */

import { useState, useRef, useCallback, type ReactNode } from 'react';
import type { Density } from './ObjectList';

interface ObjectDensityWrapperProps {
  defaultDensity: Density;
  /** When false, renders children at defaultDensity without click handling */
  enabled?: boolean;
  children: (density: Density) => ReactNode;
}

const CYCLE: Density[] = ['chip', 'card', 'expanded'];

export default function ObjectDensityWrapper({
  defaultDensity,
  enabled = false,
  children,
}: ObjectDensityWrapperProps) {
  const [density, setDensity] = useState<Density>(defaultDensity);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animating = useRef(false);

  const cycleDensity = useCallback(() => {
    if (!enabled || animating.current) return;

    const el = wrapperRef.current;
    if (!el) return;

    // Step 1: capture current height
    const oldHeight = el.getBoundingClientRect().height;
    animating.current = true;

    // Step 2: move to next density
    const currentIndex = CYCLE.indexOf(density);
    const nextDensity = CYCLE[(currentIndex + 1) % CYCLE.length];
    setDensity(nextDensity);

    // Step 3-5: animate after React re-render
    requestAnimationFrame(() => {
      const newHeight = el.getBoundingClientRect().height;
      el.style.maxHeight = `${oldHeight}px`;
      el.style.overflow = 'hidden';
      el.style.transition = 'max-height 400ms cubic-bezier(0.4, 0, 0.2, 1)';

      // Force reflow so the browser picks up the starting maxHeight
      void el.offsetHeight;

      el.style.maxHeight = `${newHeight}px`;

      const onEnd = () => {
        el.style.maxHeight = '';
        el.style.overflow = '';
        el.style.transition = '';
        animating.current = false;
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd, { once: true });

      // Fallback: clear after animation duration in case transitionend doesn't fire
      setTimeout(onEnd, 450);
    });
  }, [density, enabled]);

  if (!enabled) {
    return <>{children(defaultDensity)}</>;
  }

  return (
    <div
      ref={wrapperRef}
      onClick={cycleDensity}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleDensity(); } }}
      style={{ cursor: 'pointer' }}
    >
      {children(density)}
    </div>
  );
}
