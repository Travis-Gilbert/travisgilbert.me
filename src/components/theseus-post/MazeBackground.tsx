'use client';

// MazeBackground.tsx: The persistent fixed background layer.
// Composites: base color -> PatinaSvg -> rough.js walls -> MazeSchematicSvg -> BinaryStream.
// Uses dual-canvas strategy: base layer (all walls, drawn once) + highlight layer (active zones).
// Parallax: maze shifts vertically at 8% of scroll speed.
// Coordinate space: 1400x2000 (patent schematic proportions).

import { useEffect, useRef, useCallback, useState } from 'react';
import rough from 'roughjs';
import { MAZE_WALLS, MAZE_W, MAZE_H, ZONE_COLORS, type MazeZone } from './MazeWalls';
import PatinaSvg from './PatinaSvg';
import MazeSchematicSvg from './MazeSchematicSvg';
import BinaryStream from './BinaryStream';

const WALL_CONFIG = {
  structural: { strokeWidth: 3, roughness: 1.0 },
  standard: { strokeWidth: 2, roughness: 0.8 },
  baffle: { strokeWidth: 1, roughness: 0.5 },
} as const;

const BASE_INK = '#1e1a14';
const INK_MED = '#3a3428';
const SEED = 1952;

interface MazeBackgroundProps {
  activeZones: Set<MazeZone>;
  reducedMotion: boolean;
}

export default function MazeBackground({
  activeZones,
  reducedMotion,
}: MazeBackgroundProps) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [renderScale, setRenderScale] = useState(1);
  const prevZonesRef = useRef<string>('');

  // Compute scale: fill viewport width, maintain aspect ratio
  const getScale = useCallback(() => {
    if (typeof window === 'undefined') return { scale: 1, canvasH: 2000 };
    const vw = window.innerWidth;
    const scale = vw / MAZE_W;
    const canvasH = MAZE_H * scale;
    return { scale, canvasH };
  }, []);

  // Draw all walls to a canvas
  const drawWalls = useCallback(
    (
      canvas: HTMLCanvasElement,
      filter?: (zone: MazeZone) => boolean,
      colorFn?: (zone: MazeZone) => string,
      widthBoost?: number,
    ) => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const { canvasH } = getScale();

      canvas.width = w * dpr;
      canvas.height = canvasH * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${canvasH}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, canvasH);

      const rc = rough.canvas(canvas);
      const { scale } = getScale();

      for (const wall of MAZE_WALLS) {
        if (filter && !filter(wall.zone)) continue;

        const config = WALL_CONFIG[wall.weight];
        // Baffles use a lighter ink for visual hierarchy
        const defaultColor = wall.weight === 'baffle' ? INK_MED : BASE_INK;
        const color = colorFn ? colorFn(wall.zone) : defaultColor;
        const sw = config.strokeWidth + (widthBoost || 0);

        rc.line(
          wall.x1 * scale,
          wall.y1 * scale,
          wall.x2 * scale,
          wall.y2 * scale,
          {
            stroke: color,
            strokeWidth: sw,
            roughness: config.roughness,
            seed: SEED,
          },
        );
      }
    },
    [getScale],
  );

  // Draw base layer (all walls, ink color)
  const drawBaseLayer = useCallback(() => {
    const canvas = baseCanvasRef.current;
    if (!canvas) return;
    drawWalls(canvas);
  }, [drawWalls]);

  // Draw highlight layer (active zone walls only, in zone color)
  const drawHighlightLayer = useCallback(() => {
    const canvas = highlightCanvasRef.current;
    if (!canvas) return;

    if (activeZones.size === 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const { canvasH } = getScale();
        canvas.width = window.innerWidth * dpr;
        canvas.height = canvasH * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${canvasH}px`;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    drawWalls(
      canvas,
      (zone) => activeZones.has(zone),
      (zone) => ZONE_COLORS[zone],
      0.3,
    );

    // Add subtle glow to highlighted walls
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'blur(4px)';
      ctx.globalAlpha = 0.15;
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [activeZones, drawWalls, getScale]);

  // Initial draw + resize handler
  useEffect(() => {
    setRenderScale(getScale().scale);
    drawBaseLayer();

    const handleResize = () => {
      setRenderScale(getScale().scale);
      drawBaseLayer();
      drawHighlightLayer();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawBaseLayer, drawHighlightLayer, getScale]);

  // Redraw highlight layer when active zones change
  useEffect(() => {
    const zoneKey = Array.from(activeZones).sort().join(',');
    if (zoneKey !== prevZonesRef.current) {
      prevZonesRef.current = zoneKey;
      drawHighlightLayer();
    }
  }, [activeZones, drawHighlightLayer]);

  // Parallax scroll tracking
  useEffect(() => {
    if (reducedMotion) return;

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [reducedMotion]);

  const parallaxOffset = reducedMotion ? 0 : scrollY * -0.08;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundColor: '#F4F3F0',
        overflow: 'hidden',
        willChange: reducedMotion ? undefined : 'transform',
      }}
    >
      {/* Patina aging overlay */}
      <PatinaSvg />

      {/* Maze content layer (parallax moves together) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          aspectRatio: `${MAZE_W} / ${MAZE_H}`,
          transform: `translateY(${parallaxOffset}px)`,
        }}
      >
        {/* Base walls (all walls, ink color, drawn once) */}
        <canvas
          ref={baseCanvasRef}
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 2,
            opacity: 0.6,
          }}
        />

        {/* Highlight walls (active zones, colored, redrawn on zone change) */}
        <canvas
          ref={highlightCanvasRef}
          className="pointer-events-none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 3,
          }}
        />

        {/* SVG schematic overlay: labels, cross-hatching, flow arrows */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 4,
            opacity: 0.7,
          }}
        >
          <MazeSchematicSvg />
        </div>
      </div>

      {/* Binary code streams (fixed position, no parallax) */}
      <BinaryStream
        activeZones={activeZones}
        reducedMotion={reducedMotion}
        scaleX={renderScale}
        scaleY={renderScale}
      />
    </div>
  );
}
