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

const STAGES = ['Ingest', 'Queue', 'ONNX', 'Store', 'Serve'];
const TEAL = '#2D5F6B';
const PARTICLE_COUNT = 24;
const NODE_R = 6;

interface Props {
  isHovered: boolean;
}

export default function IndexApiVisual({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = mulberry32(88);

    // Pre-generate particle starting phases
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      phase: rng(),
      amp: 4 + rng() * 10,
      freq: 0.8 + rng() * 1.2,
      size: 1.2 + rng() * 1.5,
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
      const speed = hoveredRef.current ? 0.25 : 0.1;
      const showLabels = hoveredRef.current;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Stage positions: evenly spaced horizontally
      const pad = w * 0.12;
      const stageX = STAGES.map((_, i) => pad + (i / (STAGES.length - 1)) * (w - pad * 2));

      // Draw pipeline line
      ctx.strokeStyle = TEAL + '30';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(stageX[0], cy);
      ctx.lineTo(stageX[stageX.length - 1], cy);
      ctx.stroke();

      // Draw particles flowing along pipeline
      const pipeLen = stageX[stageX.length - 1] - stageX[0];
      for (const p of particles) {
        const t = ((p.phase + elapsed * speed) % 1);
        const px = stageX[0] + t * pipeLen;
        const py = cy + Math.sin(t * Math.PI * 2 * p.freq + elapsed * 2) * p.amp;

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = TEAL + '50';
        ctx.fill();
      }

      // Draw stage nodes
      for (let i = 0; i < STAGES.length; i++) {
        const sx = stageX[i];

        ctx.beginPath();
        ctx.arc(sx, cy, NODE_R, 0, Math.PI * 2);
        ctx.fillStyle = TEAL;
        ctx.fill();

        // Labels
        if (showLabels) {
          ctx.font = '500 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(45, 95, 107, 0.7)';
          ctx.fillText(STAGES[i], sx, cy + NODE_R + 14);
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
