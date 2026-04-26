'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import rough from 'roughjs';
import styles from '@/app/(spacetime)/spacetime/spacetime.module.css';

interface InfoCardProps {
  side: 'left' | 'right';
  children: ReactNode;
}

/**
 * Drafting-corner card pinned to the upper-left or upper-right.
 *
 * Visual: rough.js hand-drawn outline over a semi-transparent terracotta
 * fill with a strong backdrop-blur, so the PRWN data grid behind it is
 * still legible as a hum but the card reads as a discrete instrument.
 *
 * Children are page-specific (topic meta on the left, legend +
 * suggested topics on the right).
 */
export default function InfoCard({ side, children }: InfoCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sideClass = side === 'left' ? styles.infoLeft : styles.infoRight;
  // Stable seed per side so the rough strokes don't reflow on re-render.
  const seed = side === 'left' ? 17 : 41;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.min(rect.width, 8192));
      const h = Math.max(1, Math.min(rect.height, 8192));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rc = rough.canvas(canvas);
      rc.rectangle(2, 2, w - 4, h - 4, {
        roughness: 0.7,
        bowing: 0.7,
        strokeWidth: 1.2,
        stroke: '#2A2420',
        seed,
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [seed]);

  return (
    <div ref={containerRef} className={`${styles.infoCard} ${sideClass}`}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className={styles.infoCardCanvas}
      />
      <div className={styles.infoCardInner}>{children}</div>
    </div>
  );
}
