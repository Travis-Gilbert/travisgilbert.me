'use client';

import { useRef, useEffect } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const PURPLE = '#6B4F7A';

interface TreeNode {
  label: string;
  depth: number;
  x: number;  // fraction 0..1
  y: number;  // fraction 0..1
  radius: number;
  children: number[]; // indices into TREE array
}

// 3-level tree: App -> (View, Model, Template) -> (List, Detail, Field, Field, Block, Block)
const TREE: TreeNode[] = [
  { label: 'App', depth: 0, x: 0.5, y: 0.18, radius: 8, children: [1, 2, 3] },
  { label: 'View', depth: 1, x: 0.2, y: 0.48, radius: 6, children: [4, 5] },
  { label: 'Model', depth: 1, x: 0.5, y: 0.48, radius: 6, children: [6, 7] },
  { label: 'Template', depth: 1, x: 0.8, y: 0.48, radius: 6, children: [8, 9] },
  { label: 'List', depth: 2, x: 0.12, y: 0.78, radius: 4, children: [] },
  { label: 'Detail', depth: 2, x: 0.28, y: 0.78, radius: 4, children: [] },
  { label: 'Field', depth: 2, x: 0.42, y: 0.78, radius: 4, children: [] },
  { label: 'Field', depth: 2, x: 0.58, y: 0.78, radius: 4, children: [] },
  { label: 'Block', depth: 2, x: 0.72, y: 0.78, radius: 4, children: [] },
  { label: 'Block', depth: 2, x: 0.88, y: 0.78, radius: 4, children: [] },
];

interface Props {
  isHovered: boolean;
}

export default function DjangoDesignVisual({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

      const pad = w * 0.06;
      const areaW = w - pad * 2;
      const areaH = h - pad * 2;

      // Draw edges first (behind nodes)
      ctx.strokeStyle = PURPLE + '30';
      ctx.lineWidth = 1;
      for (const node of TREE) {
        const nx = pad + node.x * areaW;
        const ny = pad + node.y * areaH;
        for (const childIdx of node.children) {
          const child = TREE[childIdx];
          const cx = pad + child.x * areaW;
          const cy = pad + child.y * areaH;
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }
      }

      // Draw nodes
      for (let i = 0; i < TREE.length; i++) {
        const node = TREE[i];
        const nx = pad + node.x * areaW;
        const ny = pad + node.y * areaH;

        // Pulse on hover
        const pulse = hovered
          ? 1 + Math.sin(elapsed * 3 + i * 0.7) * 0.2
          : 1;
        const r = node.radius * pulse;

        // Node circle
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = PURPLE;
        ctx.fill();

        // Subtle glow for root node
        if (node.depth === 0) {
          const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 3);
          glow.addColorStop(0, PURPLE + '20');
          glow.addColorStop(1, PURPLE + '00');
          ctx.beginPath();
          ctx.arc(nx, ny, r * 3, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Labels (always visible on hover, depth 0-1 always visible)
        if (hovered || node.depth <= 1) {
          ctx.font = `500 ${node.depth === 2 ? 7 : 8}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = PURPLE + (hovered ? 'AA' : '70');
          ctx.fillText(node.label, nx, ny + r + 11);
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
