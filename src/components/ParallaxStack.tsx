'use client';

/**
 * ParallaxStack: Subtle scroll-driven vertical parallax between child layers.
 *
 * Each direct child gets a slight vertical displacement based on scroll
 * position and layer index, creating a physical "stacked papers" depth.
 * Displacement is capped at +/- 15px to keep the effect barely perceptible.
 *
 * Respects prefers-reduced-motion (disabled entirely).
 * Touch devices get 50% reduced intensity.
 */

import { useRef, useEffect, useState, type ReactNode, Children, cloneElement, isValidElement } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface ParallaxStackProps {
  children: ReactNode;
  /** Scroll-to-displacement multiplier (default 0.03) */
  intensity?: number;
}

export default function ParallaxStack({
  children,
  intensity = 0.03,
}: ParallaxStackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [enabled, setEnabled] = useState(false);
  const effectiveIntensity = useRef(intensity);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setEnabled(false);
      return;
    }

    const isTouch = window.matchMedia('(hover: none)').matches;
    effectiveIntensity.current = isTouch ? intensity * 0.5 : intensity;
    setEnabled(true);
  }, [intensity, prefersReducedMotion]);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    let rafId = 0;

    function onScroll() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const scrollOffset = -rect.top;

        layerRefs.current.forEach((el, i) => {
          if (!el) return;
          const raw = scrollOffset * effectiveIntensity.current * i;
          const clamped = Math.max(-15, Math.min(15, raw));
          el.style.transform = `translateY(${clamped}px)`;
        });
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled]);

  const childArray = Children.toArray(children);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {childArray.map((child, i) => {
        if (!isValidElement(child)) return child;
        return (
          <div
            key={i}
            ref={(el) => { layerRefs.current[i] = el; }}
            data-parallax-layer={i}
            style={{ willChange: enabled ? 'transform' : undefined }}
          >
            {cloneElement(child)}
          </div>
        );
      })}
    </div>
  );
}
