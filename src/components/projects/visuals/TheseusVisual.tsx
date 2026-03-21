'use client';

import { useRef, useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/* ── Deterministic PRNG (mulberry32) ── */

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Engine pass config ── */

interface PassNode {
  label: string;
  color: string;
  angle: number;
  satellites: number;
}

const PASSES: PassNode[] = [
  { label: 'NER', color: '#C4503C', angle: 0, satellites: 5 },
  { label: 'BM25', color: '#2D5F6B', angle: Math.PI / 3, satellites: 5 },
  { label: 'SBERT', color: '#C49A4A', angle: (2 * Math.PI) / 3, satellites: 5 },
  { label: 'NLI', color: '#6B4F7A', angle: Math.PI, satellites: 4 },
  { label: 'RotatE', color: '#4A7A5A', angle: (4 * Math.PI) / 3, satellites: 5 },
  { label: 'Louvain', color: '#C4503C', angle: (5 * Math.PI) / 3, satellites: 4 },
];

const HUB_RADIUS = 6;
const PASS_RADIUS = 5;
const SAT_RADIUS = 1.8;
const ORBIT_R = 0.3; // fraction of canvas half-width for pass orbit
const SAT_ORBIT_R = 0.09; // fraction of canvas half-width for satellite orbit

/* ── Component ── */

interface Props {
  isHovered: boolean;
}

export default function TheseusVisual({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = mulberry32(42);

    // Generate satellite offsets once (deterministic)
    const satelliteOffsets: { passIdx: number; angleOffset: number; radiusJitter: number }[] = [];
    for (let p = 0; p < PASSES.length; p++) {
      for (let s = 0; s < PASSES[p].satellites; s++) {
        satelliteOffsets.push({
          passIdx: p,
          angleOffset: rng() * Math.PI * 2,
          radiusJitter: 0.7 + rng() * 0.6,
        });
      }
    }

    let animId = 0;
    let startTime = performance.now();

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.min(rect.width, 8192));
      const h = Math.max(1, Math.min(rect.height, 8192));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(time: number) {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 1 || h < 1) return;

      const cx = w / 2;
      const cy = h / 2;
      const halfW = Math.min(w, h) / 2;
      const elapsed = (time - startTime) / 1000;
      const speed = hoveredRef.current ? 0.6 : 0.15;
      const showLabels = hoveredRef.current;

      ctx.clearRect(0, 0, w, h);

      // Draw ring edges (connecting adjacent passes)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < PASSES.length; i++) {
        const a = PASSES[i];
        const b = PASSES[(i + 1) % PASSES.length];
        const aAngle = a.angle + elapsed * speed;
        const bAngle = b.angle + elapsed * speed;
        const orbitR = halfW * ORBIT_R;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(aAngle) * orbitR, cy + Math.sin(aAngle) * orbitR);
        ctx.lineTo(cx + Math.cos(bAngle) * orbitR, cy + Math.sin(bAngle) * orbitR);
        ctx.stroke();
      }

      // Draw spoke edges (pass to center)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      for (const pass of PASSES) {
        const angle = pass.angle + elapsed * speed;
        const orbitR = halfW * ORBIT_R;
        const px = cx + Math.cos(angle) * orbitR;
        const py = cy + Math.sin(angle) * orbitR;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
      }

      // Draw satellites
      const satOrbit = halfW * SAT_ORBIT_R;
      for (const sat of satelliteOffsets) {
        const pass = PASSES[sat.passIdx];
        const passAngle = pass.angle + elapsed * speed;
        const orbitR = halfW * ORBIT_R;
        const passX = cx + Math.cos(passAngle) * orbitR;
        const passY = cy + Math.sin(passAngle) * orbitR;

        const satAngle = sat.angleOffset + elapsed * speed * 1.5;
        const satR = satOrbit * sat.radiusJitter;
        const sx = passX + Math.cos(satAngle) * satR;
        const sy = passY + Math.sin(satAngle) * satR;

        ctx.beginPath();
        ctx.arc(sx, sy, SAT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = pass.color + '40'; // 25% opacity
        ctx.fill();
      }

      // Draw pass nodes
      for (const pass of PASSES) {
        const angle = pass.angle + elapsed * speed;
        const orbitR = halfW * ORBIT_R;
        const px = cx + Math.cos(angle) * orbitR;
        const py = cy + Math.sin(angle) * orbitR;

        ctx.beginPath();
        ctx.arc(px, py, PASS_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = pass.color;
        ctx.fill();

        // Labels on hover
        if (showLabels) {
          ctx.font = '500 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.fillText(pass.label, px, py + PASS_RADIUS + 12);
        }
      }

      // Draw central hub
      ctx.beginPath();
      ctx.arc(cx, cy, HUB_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#C4503C';
      ctx.fill();

      // Subtle glow on hub
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, HUB_RADIUS * 3);
      gradient.addColorStop(0, 'rgba(196, 80, 60, 0.15)');
      gradient.addColorStop(1, 'rgba(196, 80, 60, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, HUB_RADIUS * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    function frame(time: number) {
      resize();
      draw(time);
      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(frame);
      }
    }

    // Initial render
    resize();
    if (prefersReducedMotion) {
      draw(startTime);
    } else {
      animId = requestAnimationFrame(frame);
    }

    const handleResize = () => resize();
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
