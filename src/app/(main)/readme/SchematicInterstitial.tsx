'use client';

import { useRef, useState, useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import SchematicTree from './SchematicTree';
import type { SchematicData } from './readme-data';

interface SchematicInterstitialProps {
  data: SchematicData;
}

export default function SchematicInterstitial({
  data,
}: SchematicInterstitialProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      setIsVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      className="sch-interstitial"
      style={{
        minHeight: '85vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
      }}
    >
      <div
        className="sch-inner"
        style={{
          width: '320px',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : 'translateY(30px)',
          transition: reducedMotion
            ? 'none'
            : 'opacity 0.6s ease, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <SchematicTree data={data} variant="full" isVisible={isVisible} />
      </div>
    </div>
  );
}
