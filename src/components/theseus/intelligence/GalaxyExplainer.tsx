'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateGalaxy, type GalaxyData } from './galaxyGenerator';
import {
  ALGORITHMS,
  COMMUNITY_COLORS,
  findHoveredAlgorithm,
  type Algorithm,
  type AlgorithmId,
} from './algorithmRegions';
import DetailCard from './DetailCard';

// Color constants
const TEAL_BRIGHT = '#4A8A96';
const TERRACOTTA = '#C4503C';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const COMMUNITY_RGBS = COMMUNITY_COLORS.map(hexToRgb);
const TEAL_RGB = hexToRgb(TEAL_BRIGHT);
const TERRACOTTA_RGB = hexToRgb(TERRACOTTA);
const AMBER_RGB = hexToRgb('#C49A4A');

export default function GalaxyExplainer() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galaxyRef = useRef<GalaxyData | null>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const fadeRef = useRef(0);
  const activeAlgoRef = useRef<AlgorithmId | null>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const zoomRef = useRef(1);
  const zoomTargetRef = useRef(1);
  const rotationRef = useRef(0);
  const rotationSpeedRef = useRef(1); // 1 when idle, lerps to 0 when algo hovered

  const [hoveredAlgo, setHoveredAlgo] = useState<Algorithm | null>(null);
  const [selectedAlgo, setSelectedAlgo] = useState<Algorithm | null>(null);
  const [cursorStyle, setCursorStyle] = useState<'default' | 'pointer'>('default');

  // Generate galaxy on mount and resize
  const regenerate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w < 1 || h < 1) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    galaxyRef.current = generateGalaxy(w, h);
  }, []);

  useEffect(() => {
    regenerate();
    const onResize = () => regenerate();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [regenerate]);

  // Mouse tracking (inverse-transform for zoom)
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const zoom = zoomRef.current;

      // Convert screen coords to galaxy coords (inverse of zoom + rotation)
      const zoomedX = (screenX - cx) / zoom;
      const zoomedY = (screenY - cy) / zoom;
      const rot = -rotationRef.current;
      const galaxyX = cx + zoomedX * Math.cos(rot) - zoomedY * Math.sin(rot);
      const galaxyY = cy + zoomedX * Math.sin(rot) + zoomedY * Math.cos(rot);
      mouseRef.current = { x: galaxyX, y: galaxyY };

      const galaxy = galaxyRef.current;
      if (!galaxy) return;

      const maxRadius = Math.min(w, h) * 0.65;
      const algo = findHoveredAlgorithm(galaxyX, galaxyY, cx, cy, maxRadius);
      setHoveredAlgo(algo);
      activeAlgoRef.current = algo?.id ?? null;
      setCursorStyle(algo ? 'pointer' : 'default');
    },
    [],
  );

  // Wheel zoom (0.5x to 2.0x)
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.deltaY > 0 ? -0.1 : 0.1;
    zoomTargetRef.current = Math.max(0.75, Math.min(2.0, zoomTargetRef.current + step));
  }, []);

  const onClick = useCallback(() => {
    if (hoveredAlgo) {
      setSelectedAlgo(hoveredAlgo);
    } else {
      setSelectedAlgo(null);
    }
  }, [hoveredAlgo]);

  const onCloseCard = useCallback(() => {
    setSelectedAlgo(null);
  }, []);

  // Animation loop
  useEffect(() => {
    let running = true;

    function draw() {
      if (!running) return;
      const canvas = canvasRef.current;
      const galaxy = galaxyRef.current;
      if (!canvas || !galaxy) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w < 1 || h < 1) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Smooth zoom lerp
      zoomRef.current += (zoomTargetRef.current - zoomRef.current) * 0.12;
      const zoom = zoomRef.current;

      const time = timeRef.current++;
      const { nodes, edges } = galaxy;
      const cx = w / 2;
      const cy = h / 2;
      const mouse = mouseRef.current;
      const activeAlgo = activeAlgoRef.current;

      // Lerp fade
      const targetFade = activeAlgo ? 1 : 0;
      fadeRef.current += (targetFade - fadeRef.current) * 0.08;
      const fade = fadeRef.current;

      // Idle rotation: slow spin when nothing is hovered, dampens to zero on hover
      const targetSpeed = activeAlgo ? 0 : 1;
      rotationSpeedRef.current += (targetSpeed - rotationSpeedRef.current) * 0.04;
      rotationRef.current += 0.0003 * rotationSpeedRef.current;

      // --- BACKGROUND ---
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      bgGrad.addColorStop(0, '#151618');
      bgGrad.addColorStop(0.5, '#111214');
      bgGrad.addColorStop(1, '#0a0b0c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // --- ENGINE HEAT GRADIENT ---
      const heatGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
      heatGrad.addColorStop(0, 'transparent');
      heatGrad.addColorStop(0.5, 'rgba(196,80,60,0.04)');
      heatGrad.addColorStop(1, 'rgba(196,80,60,0.08)');
      ctx.fillStyle = heatGrad;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);

      // Apply zoom + idle rotation (centered on viewport middle)
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.rotate(rotationRef.current);
      ctx.translate(-cx, -cy);

      // --- EDGES ---
      for (const edge of edges) {
        const ns = nodes[edge.source];
        const nt = nodes[edge.target];

        let edgeAlpha = 0.04 * edge.weight;
        let edgeR = 156, edgeG = 149, edgeB = 141;

        if (fade > 0.01 && activeAlgo) {
          if (activeAlgo === 'ppr') {
            const mx = (ns.x + nt.x) / 2;
            const my = (ns.y + nt.y) / 2;
            const distToMouse = Math.sqrt((mx - mouse.x) ** 2 + (my - mouse.y) ** 2);
            if (distToMouse < 200) {
              const intensity = (1 - distToMouse / 200) * fade;
              edgeAlpha = edgeAlpha + (0.15 - edgeAlpha) * intensity;
              edgeR = TEAL_RGB[0]; edgeG = TEAL_RGB[1]; edgeB = TEAL_RGB[2];
            }
          } else if (activeAlgo === 'community') {
            const sameCommunity = ns.community === nt.community;
            if (sameCommunity) {
              const cRgb = COMMUNITY_RGBS[ns.community % 7];
              edgeR = edgeR + (cRgb[0] - edgeR) * fade;
              edgeG = edgeG + (cRgb[1] - edgeG) * fade;
              edgeB = edgeB + (cRgb[2] - edgeB) * fade;
              edgeAlpha = edgeAlpha + (0.12 * edge.weight - edgeAlpha) * fade;
            } else {
              edgeR = edgeR + (AMBER_RGB[0] - edgeR) * fade;
              edgeG = edgeG + (AMBER_RGB[1] - edgeG) * fade;
              edgeB = edgeB + (AMBER_RGB[2] - edgeB) * fade;
              edgeAlpha = edgeAlpha + (0.2 * edge.weight - edgeAlpha) * fade;
            }
          } else if (activeAlgo === 'belief') {
            edgeAlpha = edgeAlpha + (0.08 - edgeAlpha) * fade;
            edgeR = edgeR + (TEAL_RGB[0] - edgeR) * fade;
            edgeG = edgeG + (TEAL_RGB[1] - edgeG) * fade;
            edgeB = edgeB + (TEAL_RGB[2] - edgeB) * fade;
          }
        }

        ctx.beginPath();
        ctx.moveTo(ns.x, ns.y);
        ctx.lineTo(nt.x, nt.y);
        ctx.strokeStyle = `rgba(${Math.round(edgeR)},${Math.round(edgeG)},${Math.round(edgeB)},${edgeAlpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // --- BELIEF PROPAGATION PARTICLES ---
      if (fade > 0.01 && activeAlgo === 'belief') {
        for (const edge of edges) {
          const ns = nodes[edge.source];
          const nt = nodes[edge.target];
          const t = ((time * 0.03 + ns.messagePhase) % 1);
          const px = ns.x + (nt.x - ns.x) * t;
          const py = ns.y + (nt.y - ns.y) * t;

          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},${0.6 * fade})`;
          ctx.fill();
        }
      }

      // --- NODES ---
      for (const node of nodes) {
        // Per-node drift: Lissajous orbit around home position
        const phase = node.pulseOffset;
        const driftX = Math.sin(time * 0.008 + phase) * 10
                     + Math.sin(time * 0.003 + phase * 2.7) * 6;
        const driftY = Math.cos(time * 0.006 + phase * 1.3) * 10
                     + Math.cos(time * 0.004 + phase * 3.1) * 6;
        const nx = node.x + driftX;
        const ny = node.y + driftY;

        const basePulse = Math.sin(time * 0.015 + node.pulseOffset) * 0.05;
        let alpha = node.brightness + basePulse;
        let r = TEAL_RGB[0], g = TEAL_RGB[1], b = TEAL_RGB[2];
        let radius = node.radius;
        let glowRadius = 0;
        let glowR = 0, glowG = 0, glowB = 0, glowAlpha = 0;

        if (fade > 0.01 && activeAlgo) {
          if (activeAlgo === 'anti-conspiracy') {
            if (node.isConspiracy) {
              const osc = Math.sin(time * 0.04 + node.pulseOffset);
              r = r + (TERRACOTTA_RGB[0] - r) * fade;
              g = g + (TERRACOTTA_RGB[1] - g) * fade;
              b = b + (TERRACOTTA_RGB[2] - b) * fade;
              radius = radius + (radius * 0.5 + radius * 0.3 * osc) * fade;
              alpha = alpha + (0.5 + 0.2 * osc - alpha) * fade;

              glowRadius = radius * 4 * fade;
              glowR = TERRACOTTA_RGB[0]; glowG = TERRACOTTA_RGB[1]; glowB = TERRACOTTA_RGB[2];
              glowAlpha = 0.15 * fade;
            } else if (node.sourceCount >= 3) {
              const scaleUp = node.sourceCount * 0.15;
              radius = radius + scaleUp * fade;
              alpha = alpha + (alpha * (node.sourceCount / 5)) * fade;
            }
          } else if (activeAlgo === 'ppr') {
            const distToMouse = Math.sqrt((node.x - mouse.x) ** 2 + (node.y - mouse.y) ** 2);
            const wavePos = (time * 1.5) % (220 * 1.5);
            const waveDist = Math.abs(distToMouse - wavePos);

            if (waveDist < 30) {
              const waveIntensity = (1 - waveDist / 30) * fade;
              alpha = alpha + (0.7 - alpha) * waveIntensity;
              radius = radius + (radius * 0.8) * waveIntensity;
            }

            const sustainRadius = 220 * 0.4;
            if (distToMouse < sustainRadius) {
              const sustainT = (1 - distToMouse / sustainRadius) * fade;
              alpha = alpha + (0.5 - alpha) * sustainT;
              radius = radius + radius * 0.5 * sustainT;
            }
          } else if (activeAlgo === 'community') {
            const cRgb = COMMUNITY_RGBS[node.community % 7];
            r = r + (cRgb[0] - r) * fade;
            g = g + (cRgb[1] - g) * fade;
            b = b + (cRgb[2] - b) * fade;
            alpha = Math.max(alpha, 0.35 * fade);
            radius = radius + radius * 0.3 * fade;
          } else if (activeAlgo === 'tms') {
            const distToMouse = Math.sqrt((node.x - mouse.x) ** 2 + (node.y - mouse.y) ** 2);
            if (distToMouse < 100) {
              const intensity = (1 - distToMouse / 100) * fade;
              alpha = node.brightness * (1 - intensity * 0.9);
              r = r + (TERRACOTTA_RGB[0] - r) * intensity;
              g = g + (TERRACOTTA_RGB[1] - g) * intensity;
              b = b + (TERRACOTTA_RGB[2] - b) * intensity;
              radius = radius * (1 - intensity * 0.5);
            } else if (distToMouse < 220) {
              const cascadeT = (distToMouse - 100) / 120;
              const intensity = (1 - cascadeT) * 0.6 * fade;
              alpha = alpha * (1 - intensity * 0.5);
              r = r + (AMBER_RGB[0] - r) * intensity;
              g = g + (AMBER_RGB[1] - g) * intensity;
              b = b + (AMBER_RGB[2] - b) * intensity;
            }
          } else if (activeAlgo === 'belief') {
            const msgPulse = Math.sin(time * 0.04 + node.messagePhase * 3) * 0.5 + 0.5;
            alpha = 0.15 + msgPulse * 0.4;
            alpha = node.brightness + (alpha - node.brightness) * fade;
            radius = node.radius * (1 + msgPulse * 0.3 * fade);

            if (node.confidence > 0.6) {
              // teal (default)
            } else if (node.confidence > 0.3) {
              r = r + (AMBER_RGB[0] - r) * fade;
              g = g + (AMBER_RGB[1] - g) * fade;
              b = b + (AMBER_RGB[2] - b) * fade;
            } else {
              r = r + (TERRACOTTA_RGB[0] - r) * fade;
              g = g + (TERRACOTTA_RGB[1] - g) * fade;
              b = b + (TERRACOTTA_RGB[2] - b) * fade;
            }
          }
        }

        // Glow (if present)
        if (glowRadius > 0) {
          const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowRadius);
          grad.addColorStop(0, `rgba(${glowR},${glowG},${glowB},${glowAlpha})`);
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(nx - glowRadius, ny - glowRadius, glowRadius * 2, glowRadius * 2);
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, Math.min(1, alpha))})`;
        ctx.fill();
      }

      // --- CENTER CORE ---
      const coreAlpha = 0.5 + Math.sin(time * 0.02) * 0.125;
      // Core glow
      const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
      coreGlow.addColorStop(0, `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},0.12)`);
      coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGlow;
      ctx.fillRect(cx - 40, cy - 40, 80, 80);
      // Core dot
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},${coreAlpha})`;
      ctx.fill();

      // --- ALGORITHM LABELS (fixed position, no rotation) ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
      const labelDist = Math.min(w, h) * 0.38;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const algo of ALGORITHMS) {
        const lx = cx + Math.cos(algo.angle) * labelDist;
        const ly = cy + Math.sin(algo.angle) * labelDist * 0.7;
        const isHovered = activeAlgo === algo.id;

        ctx.font = '11px "JetBrains Mono", "Courier New", monospace';
        const textMetrics = ctx.measureText(algo.label);
        const pw = textMetrics.width + 20;
        const ph = 24;
        const rx = lx - pw / 2;
        const ry = ly - ph / 2;
        const cornerRadius = 12;

        if (isHovered && fade > 0.01) {
          // Hovered glow
          const hGlow = ctx.createRadialGradient(lx, ly, 0, lx, ly, pw * 0.8);
          hGlow.addColorStop(0, `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},${0.08 * fade})`);
          hGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = hGlow;
          ctx.fillRect(lx - pw, ly - pw * 0.6, pw * 2, pw * 1.2);
        }

        // Pill background
        ctx.beginPath();
        ctx.roundRect(rx, ry, pw, ph, cornerRadius);
        ctx.fillStyle = isHovered
          ? `rgba(10,11,12,${0.7 + 0.2 * fade})`
          : 'rgba(15,16,18,0.5)';
        ctx.fill();

        // Pill border (hovered only)
        if (isHovered && fade > 0.01) {
          ctx.strokeStyle = `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},${0.4 * fade})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Label text
        ctx.fillStyle = isHovered
          ? `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},${0.5 + 0.5 * fade})`
          : 'rgba(244,243,240,0.12)';
        ctx.fillText(algo.label, lx, ly);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      onMouseMove={onMouseMove}
      onWheel={onWheel}
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: cursorStyle,
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Header overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '20px 24px',
          background: 'linear-gradient(to bottom, rgba(15,16,18,0.8), transparent)',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: TEAL_BRIGHT,
            boxShadow: `0 0 8px ${TEAL_BRIGHT}, 0 0 16px rgba(74,138,150,0.3)`,
            flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontFamily: 'Vollkorn, Georgia, serif', fontSize: 20, color: '#F4F3F0' }}>
            How Theseus Thinks
          </div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              fontSize: 11,
              color: 'rgba(244,243,240,0.25)',
              marginTop: 2,
            }}
          >
            Hover to explore graph algorithms
          </div>
        </div>
      </div>

      {/* Bottom hint text */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: '"JetBrains Mono", "Courier New", monospace',
          fontSize: 11,
          color: 'rgba(244,243,240,0.25)',
          pointerEvents: 'none',
        }}
      >
        {hoveredAlgo
          ? `Click to learn about ${hoveredAlgo.label}`
          : 'Move your cursor to explore the intelligence layer'}
      </div>

      {/* Detail card */}
      {selectedAlgo && (
        <DetailCard algorithm={selectedAlgo} onClose={onCloseCard} />
      )}
    </div>
  );
}
