'use client';

import { useRef, useEffect } from 'react';

const DOT_SPACING = 18;
const DOT_R = 0.6;
const DOT_R_MAX = 1.0;
const ALPHA_MIN = 0.03;
const ALPHA_MAX = 0.10;

const canvasStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
};

export function TealDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;

    function draw() {
      const cvs = canvas!;
      const ctx = cvs.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = Math.min(window.innerWidth, 8192);
      const h = Math.min(window.innerHeight, 8192);
      if (w < 1 || h < 1) return;

      cvs.width = w * dpr;
      cvs.height = h * dpr;
      cvs.style.width = `${w}px`;
      cvs.style.height = `${h}px`;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.4;
      const maxDist = Math.sqrt(cx * cx + cy * cy);

      for (let x = DOT_SPACING / 2; x < w; x += DOT_SPACING) {
        for (let y = DOT_SPACING / 2; y < h; y += DOT_SPACING) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const t = 1 - Math.min(dist / maxDist, 1);

          const alpha = ALPHA_MIN + t * (ALPHA_MAX - ALPHA_MIN);
          const r = DOT_R + t * (DOT_R_MAX - DOT_R);

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(45, 95, 107, ${alpha})`;
          ctx.fill();
        }
      }
    }

    function onResize() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(draw);
    }

    draw();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={canvasRef} style={canvasStyle} />;
}
