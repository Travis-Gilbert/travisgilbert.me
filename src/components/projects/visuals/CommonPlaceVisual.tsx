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

/* ── Node config ── */

interface ConstellationNode {
  emoji: string;
  label: string;
  baseAngle: number;
}

const NODES: ConstellationNode[] = [
  { emoji: '\u{1F4C4}', label: 'Source', baseAngle: 0 },
  { emoji: '\u{1F4A1}', label: 'Claim', baseAngle: Math.PI / 4 },
  { emoji: '\u{1F517}', label: 'Link', baseAngle: Math.PI / 2 },
  { emoji: '\u{1F50D}', label: 'Search', baseAngle: (3 * Math.PI) / 4 },
  { emoji: '\u{1F4DD}', label: 'Note', baseAngle: Math.PI },
  { emoji: '\u{2753}', label: 'Question', baseAngle: (5 * Math.PI) / 4 },
  { emoji: '\u{1F9E0}', label: 'Model', baseAngle: (3 * Math.PI) / 2 },
  { emoji: '\u{1F4CA}', label: 'Data', baseAngle: (7 * Math.PI) / 4 },
];

// Connections: adjacent + some cross-links
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

const NODE_RADIUS = 14;
const ORBIT_R = 0.3; // fraction of min(w,h)/2

/* ── Component ── */

interface Props {
  isHovered: boolean;
}

export default function CommonPlaceVisual({ isHovered }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoveredRef = useRef(isHovered);
  hoveredRef.current = isHovered;
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = mulberry32(99);

    // Generate per-node wobble offsets
    const wobbleOffsets = NODES.map(() => ({
      phaseX: rng() * Math.PI * 2,
      phaseY: rng() * Math.PI * 2,
      ampX: 2 + rng() * 4,
      ampY: 2 + rng() * 4,
    }));

    let animId = 0;
    const startTime = performance.now();

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

    function getNodePos(idx: number, elapsed: number, cx: number, cy: number, halfW: number) {
      const node = NODES[idx];
      const wobble = wobbleOffsets[idx];
      const speed = hoveredRef.current ? 0.25 : 0.08;
      const orbitR = halfW * ORBIT_R;

      const angle = node.baseAngle + elapsed * speed;
      const baseX = cx + Math.cos(angle) * orbitR;
      const baseY = cy + Math.sin(angle) * orbitR;

      // Add gentle wobble
      const wx = Math.sin(elapsed * 0.5 + wobble.phaseX) * wobble.ampX;
      const wy = Math.cos(elapsed * 0.4 + wobble.phaseY) * wobble.ampY;

      return { x: baseX + wx, y: baseY + wy };
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
      const showLabels = hoveredRef.current;

      ctx.clearRect(0, 0, w, h);

      // Compute all positions
      const positions = NODES.map((_, i) => getNodePos(i, elapsed, cx, cy, halfW));

      // Draw dashed curved connections
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(45, 95, 107, 0.2)'; // teal, low opacity
      ctx.lineWidth = 1;

      for (const [a, b] of CONNECTIONS) {
        const pa = positions[a];
        const pb = positions[b];
        // Curved path via control point offset from midpoint
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        // Perpendicular offset for curve
        const cpx = mx - dy * 0.15;
        const cpy = my + dx * 0.15;

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.quadraticCurveTo(cpx, cpy, pb.x, pb.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      // Draw nodes
      for (let i = 0; i < NODES.length; i++) {
        const pos = positions[i];
        const node = NODES[i];

        // Node circle background
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240, 235, 228, 0.85)'; // warm parchment
        ctx.fill();
        ctx.strokeStyle = 'rgba(45, 95, 107, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Emoji
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.emoji, pos.x, pos.y + 1);

        // Labels on hover
        if (showLabels) {
          ctx.font = '500 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(92, 86, 80, 0.7)';
          ctx.fillText(node.label, pos.x, pos.y + NODE_RADIUS + 10);
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
