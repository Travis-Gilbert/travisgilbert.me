'use client';

import { useRef, useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const FRAME_COUNT = 4;
const FRAME_COLORS = ['#3A3530', '#443E38', '#4E4840', '#585048'];
const SPROCKET_COUNT = 6;
const LERP_SPEED = 0.1;

interface Props {
  isHovered: boolean;
}

export default function YoutubeVisual({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Current rotation and offset state for each frame
    const frameState = Array.from({ length: FRAME_COUNT }, () => ({
      curRot: 0,
      curOffsetX: 0,
      curOffsetY: 0,
    }));

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

      const cx = w / 2;
      const cy = h / 2;
      const frameW = w * 0.52;
      const frameH = frameW * (9 / 16);
      const sprocketW = 4;
      const sprocketH = 6;
      const sprocketGap = frameH / (SPROCKET_COUNT + 1);

      for (let i = 0; i < FRAME_COUNT; i++) {
        const state = frameState[i];

        // Fan targets: spread rotation and offset on hover
        const fanAngle = hovered ? (i - (FRAME_COUNT - 1) / 2) * 0.12 : 0;
        const fanOffsetX = hovered ? (i - (FRAME_COUNT - 1) / 2) * 18 : 0;
        const fanOffsetY = hovered ? -Math.abs(i - (FRAME_COUNT - 1) / 2) * 8 : i * 2;

        // Lerp
        state.curRot += (fanAngle - state.curRot) * LERP_SPEED;
        state.curOffsetX += (fanOffsetX - state.curOffsetX) * LERP_SPEED;
        state.curOffsetY += (fanOffsetY - state.curOffsetY) * LERP_SPEED;

        ctx.save();
        ctx.translate(cx + state.curOffsetX, cy + state.curOffsetY);
        ctx.rotate(state.curRot);

        // Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
        ctx.shadowBlur = 8 + i * 3;
        ctx.shadowOffsetY = 2 + i;

        // Frame rectangle
        ctx.fillStyle = FRAME_COLORS[i];
        ctx.fillRect(-frameW / 2, -frameH / 2, frameW, frameH);

        // Reset shadow for details
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Frame border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-frameW / 2, -frameH / 2, frameW, frameH);

        // Sprocket holes (left edge)
        for (let s = 0; s < SPROCKET_COUNT; s++) {
          const sy = -frameH / 2 + sprocketGap * (s + 1) - sprocketH / 2;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(-frameW / 2 + 5, sy, sprocketW, sprocketH);
        }

        // Play triangle on top frame only
        if (i === FRAME_COUNT - 1) {
          const triSize = 14;
          ctx.beginPath();
          ctx.moveTo(-triSize * 0.4, -triSize * 0.5);
          ctx.lineTo(triSize * 0.6, 0);
          ctx.lineTo(-triSize * 0.4, triSize * 0.5);
          ctx.closePath();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fill();
        }

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
