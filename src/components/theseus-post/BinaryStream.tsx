'use client';

// BinaryStream.tsx: Canvas overlay rendering 0s and 1s flowing through maze corridors.
// Shannon invented "bit" in 1948. This is his language.
// Particles advance along CodePaths via bezier interpolation between waypoints.

import { useEffect, useRef, useCallback } from 'react';
import { mulberry32, bezierPoint, lerp2d } from './roughMaze';
import { BINARY_PATHS, ZONE_COLORS, type CodePath, type MazeZone } from './MazeWalls';

interface BinaryParticle {
  pathIndex: number;
  t: number;
  char: '0' | '1';
  size: number;
  opacity: number;
  baseOpacity: number;
}

const MAX_PARTICLES = 200;
const MOBILE_MAX = 120;
const SMALL_MOBILE_MAX = 80;

// Ink color for inactive particles
const INACTIVE_COLOR = '#b0a890';

interface BinaryStreamProps {
  activeZones: Set<MazeZone>;
  reducedMotion: boolean;
  scaleX: number;
  scaleY: number;
  isDark?: boolean;
}

export default function BinaryStream({
  activeZones,
  reducedMotion,
  scaleX,
  scaleY,
  isDark = false,
}: BinaryStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<BinaryParticle[]>([]);
  const rafRef = useRef<number>(0);

  // Initialize particles
  const initParticles = useCallback(() => {
    const rand = mulberry32(1952 + 42);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const isSmallMobile = typeof window !== 'undefined' && window.innerWidth < 480;
    const maxCount = isSmallMobile ? SMALL_MOBILE_MAX : isMobile ? MOBILE_MAX : MAX_PARTICLES;

    const perPath = Math.floor(maxCount / BINARY_PATHS.length);
    const particles: BinaryParticle[] = [];

    for (let pi = 0; pi < BINARY_PATHS.length; pi++) {
      for (let i = 0; i < perPath; i++) {
        particles.push({
          pathIndex: pi,
          t: rand(),
          char: rand() > 0.5 ? '1' : '0',
          size: 8 + rand() * 4,
          baseOpacity: 0.15 + rand() * 0.1,
          opacity: 0.15 + rand() * 0.1,
        });
      }
    }

    particlesRef.current = particles;
  }, []);

  // Get position along a path at parameter t (0..1)
  const getPathPosition = useCallback(
    (path: CodePath, t: number): [number, number] => {
      const pts = path.points;
      if (pts.length < 2) return [pts[0][0] * scaleX, pts[0][1] * scaleY];

      const segCount = pts.length - 1;
      const rawSeg = t * segCount;
      const seg = Math.min(Math.floor(rawSeg), segCount - 1);
      const localT = rawSeg - seg;

      const p0 = pts[seg];
      const p1 = pts[Math.min(seg + 1, pts.length - 1)];

      // If we have a next segment, use bezier through midpoint for organic motion
      if (seg + 2 < pts.length) {
        const p2 = pts[seg + 2];
        const mid: [number, number] = [
          (p0[0] + p1[0] + p2[0]) / 3,
          (p0[1] + p1[1] + p2[1]) / 3,
        ];
        const pos = bezierPoint(
          [p0[0] * scaleX, p0[1] * scaleY],
          [mid[0] * scaleX, mid[1] * scaleY],
          [p1[0] * scaleX, p1[1] * scaleY],
          localT,
        );
        return pos;
      }

      return lerp2d(
        [p0[0] * scaleX, p0[1] * scaleY],
        [p1[0] * scaleX, p1[1] * scaleY],
        localT,
      );
    },
    [scaleX, scaleY],
  );

  useEffect(() => {
    initParticles();
  }, [initParticles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = 0;

    function animate(time: number) {
      const dt = lastTime ? (time - lastTime) / 1000 : 0.016;
      lastTime = time;

      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      if (canvas!.width !== w * dpr || canvas!.height !== h * dpr) {
        canvas!.width = w * dpr;
        canvas!.height = h * dpr;
        canvas!.style.width = `${w}px`;
        canvas!.style.height = `${h}px`;
      }

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, w, h);

      const particles = particlesRef.current;

      for (const p of particles) {
        const path = BINARY_PATHS[p.pathIndex];
        if (!path) continue;

        // Advance particle
        p.t += path.speed * dt * 0.3;
        if (p.t > 1) {
          p.t -= 1;
          p.char = Math.random() > 0.5 ? '1' : '0';
        }

        // Determine color and opacity based on zone activity
        const isActive = activeZones.has(path.zone);
        const targetOpacity = isActive ? p.baseOpacity * 3 : p.baseOpacity;
        p.opacity += (targetOpacity - p.opacity) * 0.05;

        const color = isActive
          ? ZONE_COLORS[path.zone]
          : INACTIVE_COLOR;

        const pos = getPathPosition(path, p.t);

        // Boost opacity in dark (TECHNICAL) mode
        const displayOpacity = isDark ? Math.min(p.opacity * 2.5, 0.9) : p.opacity;

        ctx!.font = `${p.size}px "Courier New", monospace`;
        ctx!.fillStyle = color;
        ctx!.globalAlpha = displayOpacity;
        ctx!.fillText(p.char, pos[0], pos[1]);
      }

      ctx!.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [activeZones, reducedMotion, getPathPosition, isDark]);

  if (reducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3,
      }}
    />
  );
}
