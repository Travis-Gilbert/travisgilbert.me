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

const COLORS = ['#C49A4A', '#B45A2D', '#2D5F6B', '#C49A4A', '#B45A2D', '#2D5F6B',
                '#C49A4A', '#B45A2D', '#2D5F6B', '#C49A4A', '#B45A2D', '#2D5F6B'];
const HOUSE_COUNT = 12;

interface Props {
  isHovered: boolean;
}

export default function PorchfestVisual({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = mulberry32(123);

    // Pre-generate house sizes
    const houses = Array.from({ length: HOUSE_COUNT }, (_, i) => ({
      size: 8 + rng() * 6,
      color: COLORS[i % COLORS.length],
      phaseOffset: rng() * Math.PI * 2,
      waveCount: 2 + Math.floor(rng() * 3),
    }));

    let animId = 0;
    const startTime = performance.now();
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

    function drawHouse(
      ctx: CanvasRenderingContext2D,
      x: number, y: number,
      size: number, color: string,
    ) {
      const hw = size;
      const hh = size * 0.8;
      const roofH = size * 0.5;

      // Body
      ctx.fillStyle = color + '25';
      ctx.fillRect(x - hw / 2, y - hh, hw, hh);
      ctx.strokeStyle = color + '60';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x - hw / 2, y - hh, hw, hh);

      // Roof
      ctx.beginPath();
      ctx.moveTo(x - hw / 2 - 2, y - hh);
      ctx.lineTo(x, y - hh - roofH);
      ctx.lineTo(x + hw / 2 + 2, y - hh);
      ctx.closePath();
      ctx.fillStyle = color + '18';
      ctx.fill();
      ctx.strokeStyle = color + '60';
      ctx.stroke();

      // Door
      const doorW = hw * 0.25;
      const doorH = hh * 0.4;
      ctx.fillStyle = color + '30';
      ctx.fillRect(x - doorW / 2, y - doorH, doorW, doorH);
    }

    function draw(time: number) {
      if (!canvas || !ctx) return;
      const w = lastW;
      const h = lastH;
      if (w < 1 || h < 1) return;

      const elapsed = (time - startTime) / 1000;
      const hovered = hoveredRef.current;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h * 0.55;
      const arcR = Math.min(w, h) * 0.32;

      // Compute house positions in an arc
      const positions: { x: number; y: number }[] = [];
      for (let i = 0; i < HOUSE_COUNT; i++) {
        const angle = Math.PI + (i / (HOUSE_COUNT - 1)) * Math.PI; // bottom arc
        const hx = cx + Math.cos(angle) * arcR;
        const bounce = hovered ? Math.sin(elapsed * 3 + houses[i].phaseOffset) * 3 : 0;
        const hy = cy + Math.sin(angle) * arcR * 0.5 + bounce;
        positions.push({ x: hx, y: hy });
      }

      // Dashed paths between adjacent houses
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(196, 154, 74, 0.2)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < HOUSE_COUNT - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(positions[i].x, positions[i].y);
        ctx.lineTo(positions[i + 1].x, positions[i + 1].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw houses and music waves
      for (let i = 0; i < HOUSE_COUNT; i++) {
        const pos = positions[i];
        const house = houses[i];
        drawHouse(ctx, pos.x, pos.y, house.size, house.color);

        // Music waves on hover
        if (hovered) {
          const roofTop = pos.y - house.size * 0.8 - house.size * 0.5;
          ctx.strokeStyle = house.color + '35';
          ctx.lineWidth = 0.6;
          for (let w_i = 0; w_i < house.waveCount; w_i++) {
            const waveY = roofTop - 4 - w_i * 5;
            const waveW = house.size * (0.5 + w_i * 0.2);
            const phase = elapsed * 4 + house.phaseOffset + w_i;
            ctx.beginPath();
            for (let t = -waveW; t <= waveW; t += 1) {
              const x = pos.x + t;
              const y = waveY + Math.sin(t * 0.3 + phase) * 2;
              if (t === -waveW) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
        }
      }
    }

    function frame(time: number) {
      resize();
      draw(time);
      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(frame);
      }
    }

    resize();
    if (prefersReducedMotion) {
      draw(startTime);
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
