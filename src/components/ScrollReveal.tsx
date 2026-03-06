'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface ScrollRevealProps {
  children: ReactNode;
  /** IntersectionObserver threshold (0 to 1). Default 0.1 */
  threshold?: number;
  /** Delay before animation starts (ms). Use for stagger: index * 80 */
  delay?: number;
  /** Slide-in direction */
  direction?: 'up' | 'left' | 'right' | 'none';
  /** Additional className on the wrapper */
  className?: string;
}

export default function ScrollReveal({
  children,
  threshold = 0.1,
  delay = 0,
  direction = 'up',
  className = '',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, prefersReducedMotion]);

  const translate =
    direction === 'up'
      ? 'translateY(24px)'
      : direction === 'left'
        ? 'translateX(-16px)'
        : direction === 'right'
          ? 'translateX(16px)'
          : 'none';

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : translate,
        transition: `opacity 500ms ease-out, transform 500ms ease-out`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
