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

const TERRACOTTA = '#B45A2D';
const GOLD = '#C49A4A';
const GRID_SPACING = 24;
const BUILDING_COUNT = 5;

interface Props {
  isHovered: boolean;
}

export default function GatehouseVisual({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = mulberry32(55);

    // Generate building dimensions
    const buildings = Array.from({ length: BUILDING_COUNT }, () => ({
      widthFrac: 0.1 + rng() * 0.04,
      heightFrac: 0.22 + rng() * 0.18,
      windows: Math.floor(2 + rng() * 3),
      windowRows: Math.floor(1 + rng() * 2),
      hasRoof: rng() > 0.2,
      roofHeight: 0.04 + rng() * 0.06,
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

    function draw(time: number) {
      if (!canvas || !ctx) return;
      const w = lastW;
      const h = lastH;
      if (w < 1 || h < 1) return;

      const elapsed = (time - startTime) / 1000;
      const hovered = hoveredRef.current;

      ctx.clearRect(0, 0, w, h);

      // Blueprint grid
      ctx.strokeStyle = 'rgba(180, 90, 45, 0.06)';
      ctx.lineWidth = 0.5;
      for (let x = GRID_SPACING; x < w; x += GRID_SPACING) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = GRID_SPACING; y < h; y += GRID_SPACING) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Ground line
      const groundY = h * 0.72;
      ctx.strokeStyle = TERRACOTTA + '60';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(w, groundY);
      ctx.stroke();

      // Draw buildings
      const totalGap = w * 0.08;
      const buildingAreaW = w - totalGap * 2;
      const gap = buildingAreaW * 0.03;
      const unitW = (buildingAreaW - gap * (BUILDING_COUNT - 1)) / BUILDING_COUNT;

      for (let i = 0; i < BUILDING_COUNT; i++) {
        const b = buildings[i];
        const bx = totalGap + i * (unitW + gap);
        const bw = unitW;
        const bh = h * b.heightFrac;

        // Bounce on hover
        const bounce = hovered
          ? Math.sin(elapsed * 3 + i * 0.8) * 3
          : 0;
        const by = groundY - bh + bounce;

        // Subtle fill
        ctx.fillStyle = GOLD + '0F'; // 6% opacity
        ctx.fillRect(bx, by, bw, bh - bounce);

        // Building outline
        ctx.strokeStyle = TERRACOTTA + '70';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh - bounce);

        // Roof
        if (b.hasRoof) {
          const roofH = h * b.roofHeight;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + bw / 2, by - roofH);
          ctx.lineTo(bx + bw, by);
          ctx.strokeStyle = TERRACOTTA + '70';
          ctx.stroke();
          ctx.fillStyle = GOLD + '0A';
          ctx.fill();
        }

        // Windows
        const winPadX = bw * 0.15;
        const winPadY = bh * 0.12;
        const winW = (bw - winPadX * 2 - (b.windows - 1) * 3) / b.windows;
        const winH = winW * 1.3;

        for (let row = 0; row < b.windowRows; row++) {
          for (let col = 0; col < b.windows; col++) {
            const wx = bx + winPadX + col * (winW + 3);
            const wy = by + winPadY + row * (winH + 6);
            if (wy + winH > groundY - 4) continue;
            ctx.strokeStyle = TERRACOTTA + '40';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(wx, wy, winW, winH);
          }
        }

        // Door (center bottom)
        const doorW = bw * 0.18;
        const doorH = bh * 0.18;
        const doorX = bx + (bw - doorW) / 2;
        const doorY = groundY - doorH;
        ctx.strokeStyle = TERRACOTTA + '50';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(doorX, doorY, doorW, doorH);
      }

      // Dimension lines on hover
      if (hovered) {
        const dimY = groundY + 18;
        const left = totalGap;
        const right = totalGap + buildingAreaW;

        // Horizontal dimension line
        ctx.strokeStyle = TERRACOTTA + '50';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(left, dimY);
        ctx.lineTo(right, dimY);
        ctx.stroke();

        // End ticks
        ctx.beginPath();
        ctx.moveTo(left, dimY - 4);
        ctx.lineTo(left, dimY + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(right, dimY - 4);
        ctx.lineTo(right, dimY + 4);
        ctx.stroke();

        // Label
        ctx.font = '600 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = TERRACOTTA + '80';
        ctx.fillText('5 UNITS', (left + right) / 2, dimY + 16);
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
