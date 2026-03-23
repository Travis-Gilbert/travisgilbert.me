'use client';

import { useRef, useState, useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import MarginSchematic from './MarginSchematic';
import type { SchematicData } from './readme-data';

interface ReadmeSectionProps {
  children: React.ReactNode;
  noBorder?: boolean;
  className?: string;
  schematicData?: SchematicData;
}

export default function ReadmeSection({
  children,
  noBorder,
  className = '',
  schematicData,
}: ReadmeSectionProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
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
    <section
      ref={ref}
      className={`readme-section ${className}`}
      style={{
        padding: '52px 0',
        color: 'var(--color-readme-text)',
        borderBottom: noBorder
          ? 'none'
          : '1px solid var(--color-readme-border)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(14px)',
        transition: reducedMotion
          ? 'none'
          : 'opacity 0.45s ease, transform 0.45s ease',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      {children}
      {schematicData && <MarginSchematic data={schematicData} />}
    </section>
  );
}
