'use client';

import { useRef, useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLS = 8;
const ROWS = 6;
const CELL_COUNT = COLS * ROWS;
const ACCENT_COLORS = ['#2D5F6B', '#B45A2D', '#C49A4A', '#6B4F7A', '#4A7A5A'];
const LERP_SPEED = 0.08;

interface Props {
  isHovered: boolean;
}

export default function ComplianceVisual({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = mulberry32(77);

    // Generate cells with scattered positions and grid targets
    const cells = Array.from({ length: CELL_COUNT }, (_, i) => ({
      color: ACCENT_COLORS[Math.floor(rng() * ACCENT_COLORS.length)],
      scatterX: rng(),   // 0..1 fraction of canvas
      scatterY: rng(),
      scatterRot: (rng() - 0.5) * 0.8, // radians
      gridCol: i % COLS,
      gridRow: Math.floor(i / COLS),
      // Current interpolated state
      curX: 0,
      curY: 0,
      curRot: 0,
    }));

    // Initialize current positions to scattered
    for (const c of cells) {
      c.curX = c.scatterX;
      c.curY = c.scatterY;
      c.curRot = c.scatterRot;
    }

    let animId = 0;
    let lastW = 0;
    let lastH = 0;

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.min(rect.width, 8192));
      const h = Math.max(1, Math.min(rect.height, 8192));
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = lastW;
      const h = lastH;
      if (w < 1 || h < 1) return;

      const hovered = hoveredRef.current;

      ctx.clearRect(0, 0, w, h);

      // Grid layout dimensions
      const pad = w * 0.1;
      const gridW = w - pad * 2;
      const gridH = h - pad * 2;
      const cellW = gridW / COLS;
      const cellH = gridH / ROWS;
      const rectW = cellW * 0.7;
      const rectH = cellH * 0.65;

      for (const c of cells) {
        // Target positions (0..1 normalized)
        const targetX = hovered
          ? (pad + c.gridCol * cellW + cellW / 2) / w
          : c.scatterX;
        const targetY = hovered
          ? (pad + c.gridRow * cellH + cellH / 2) / h
          : c.scatterY;
        const targetRot = hovered ? 0 : c.scatterRot;

        // Lerp toward target
        c.curX += (targetX - c.curX) * LERP_SPEED;
        c.curY += (targetY - c.curY) * LERP_SPEED;
        c.curRot += (targetRot - c.curRot) * LERP_SPEED;

        const px = c.curX * w;
        const py = c.curY * h;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(c.curRot);
        ctx.fillStyle = c.color + '30'; // low opacity
        ctx.fillRect(-rectW / 2, -rectH / 2, rectW, rectH);
        ctx.strokeStyle = c.color + '20';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-rectW / 2, -rectH / 2, rectW, rectH);
        ctx.restore();
      }
    }

    function frame() {
      resize();
      draw();
      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(frame);
      }
    }

    resize();
    if (prefersReducedMotion) {
      draw();
    } else {
      animId = requestAnimationFrame(frame);
    }

    const handleResize = () => { lastW = 0; lastH = 0; };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
