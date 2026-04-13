'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ExplorerNode, ExplorerEdge } from './useGraphData';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { CanvasTransform } from './useCanvasInteraction';
import type { InvestigationView } from '@/lib/theseus-types';

// --- Color constants (spec section 2.6) ---
const TYPE_COLORS: Record<string, [number, number, number]> = {
  source:  [74, 138, 150],   // #4A8A96 teal
  concept: [123, 94, 167],   // #7B5EA7 purple
  person:  [196, 80, 60],    // #C4503C terracotta
  hunch:   [196, 154, 74],   // #C49A4A amber
  note:    [154, 149, 141],  // #9a958d warm gray
};
const TEAL_RGB: [number, number, number] = [74, 138, 150];
const TERRACOTTA_RGB: [number, number, number] = [196, 80, 60];
const AMBER_RGB: [number, number, number] = [196, 154, 74];
const GREEN_RGB: [number, number, number] = [90, 180, 90];

// Pipeline stage colors for reasoning_trace view
const PIPELINE_COLORS: Record<string, [number, number, number]> = {
  L1: TEAL_RGB,
  L2: [123, 94, 167],
  L3: TERRACOTTA_RGB,
  L4: AMBER_RGB,
};

function getTypeColor(objectType: string): [number, number, number] {
  return TYPE_COLORS[objectType] ?? TYPE_COLORS.note;
}

interface ExplorerCanvasProps {
  nodes: ExplorerNode[];
  edges: ExplorerEdge[];
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
  activeView: InvestigationView;
  askState?: string;
  onSelectNode: (id: string | null) => void;
  onHoverNode: (id: string | null) => void;
}

export default function ExplorerCanvas({
  nodes,
  edges,
  selectedNodeId,
  highlightedNodeIds,
  activeView,
  askState,
  onSelectNode,
  onHoverNode,
}: ExplorerCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const zoomRef = useRef(1);
  const zoomTargetRef = useRef(1);
  const rotationRef = useRef(0);
  const rotationSpeedRef = useRef(1);
  const hoveredNodeRef = useRef<string | null>(null);

  // Per-node dim factor for smooth neighbor dimming (spec 2.6)
  const dimFactorsRef = useRef<Map<string, number>>(new Map());
  // Per-node cursor proximity brightness boost (spec section 3)
  const cursorBoostRef = useRef<Map<string, number>>(new Map());
  // Fade lerp for view transitions (spec section 5)
  const viewFadeRef = useRef(0);
  const prevViewRef = useRef<InvestigationView>('all');
  // Heat gradient intensity lerp (spec section 6)
  const heatIntensityRef = useRef(0);
  // Evidence node fade-in stagger (spec section 6)
  const evidenceFadeRef = useRef<Map<string, number>>(new Map());
  // Edge draw progress for evidence edges (spec section 6)
  const edgeDrawProgressRef = useRef<Map<string, number>>(new Map());

  // Build neighbor set for selected node
  const neighborSetRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const set = new Set<string>();
    if (selectedNodeId) {
      set.add(selectedNodeId);
      for (const edge of edges) {
        if (edge.source === selectedNodeId) set.add(edge.target);
        if (edge.target === selectedNodeId) set.add(edge.source);
      }
    }
    neighborSetRef.current = set;
  }, [selectedNodeId, edges]);

  // Build node lookup for centroid and edge rendering
  const nodeMapRef = useRef<Map<string, ExplorerNode>>(new Map());
  useEffect(() => {
    const map = new Map<string, ExplorerNode>();
    for (const n of nodes) map.set(n.id, n);
    nodeMapRef.current = map;
  }, [nodes]);

  const interaction = useCanvasInteraction();

  // Canvas sizing (DPR-aware, spec 2.1)
  const resizeCanvas = useCallback(() => {
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
  }, []);

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas]);

  // Mouse tracking
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      const transform: CanvasTransform = {
        zoom: zoomRef.current,
        rotation: rotationRef.current,
        cx: w / 2,
        cy: h / 2,
      };

      const hit = interaction.handleMouseMove(e, rect, nodes, w, h, transform);
      const hitId = hit?.id ?? null;
      if (hitId !== hoveredNodeRef.current) {
        hoveredNodeRef.current = hitId;
        onHoverNode(hitId);
      }
    },
    [nodes, interaction, onHoverNode],
  );

  // Wheel zoom (spec 2.10: range 0.5 to 3.0)
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const step = e.deltaY > 0 ? -0.1 : 0.1;
    zoomTargetRef.current = Math.max(0.5, Math.min(3.0, zoomTargetRef.current + step));
  }, []);

  // Click handler
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      const transform: CanvasTransform = {
        zoom: zoomRef.current,
        rotation: rotationRef.current,
        cx: w / 2,
        cy: h / 2,
      };

      const hit = interaction.handleClick(e, rect, nodes, w, h, transform);
      onSelectNode(hit?.id ?? null);
    },
    [nodes, interaction, onSelectNode],
  );

  // --- Animation loop (spec 2.3) ---
  useEffect(() => {
    let running = true;

    function draw() {
      if (!running) return;
      const canvas = canvasRef.current;
      if (!canvas) {
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

      // Smooth zoom lerp (spec 2.10)
      zoomRef.current += (zoomTargetRef.current - zoomRef.current) * 0.12;
      const zoom = zoomRef.current;

      const time = timeRef.current++;
      const cx = w / 2;
      const cy = h / 2;
      const mouse = interaction.mouseRef.current;
      const hoveredId = hoveredNodeRef.current;
      const selectedId = selectedNodeId;
      const neighbors = neighborSetRef.current;
      const nodeMap = nodeMapRef.current;
      const currentView = activeView;

      // View transition lerp (spec section 5)
      if (currentView !== prevViewRef.current) {
        prevViewRef.current = currentView;
        // Reset fade to trigger smooth transition
      }
      const viewTargetFade = currentView !== 'all' ? 1 : 0;
      viewFadeRef.current += (viewTargetFade - viewFadeRef.current) * 0.08;

      // Idle rotation (spec 2.9)
      const answerActive = askState === 'CONSTRUCTING' || askState === 'EXPLORING';
      const targetSpeed = (selectedId || answerActive) ? 0 : 1;
      rotationSpeedRef.current += (targetSpeed - rotationSpeedRef.current) * 0.04;
      rotationRef.current += 0.0003 * rotationSpeedRef.current;

      // Heat gradient intensity lerp (spec 2.5 + section 6)
      const heatTarget = (askState && askState !== 'IDLE' && askState !== 'idle') ? 1 : 0;
      heatIntensityRef.current += (heatTarget - heatIntensityRef.current) * 0.08;
      const heatFactor = heatIntensityRef.current;

      // --- 1. Background radial gradient (spec 2.4) ---
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7);
      bgGrad.addColorStop(0, '#151618');
      bgGrad.addColorStop(0.5, '#111214');
      bgGrad.addColorStop(1, '#0a0b0c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // --- 2. Engine heat gradient (spec 2.5) ---
      const heatGrad = ctx.createLinearGradient(0, h * 0.7, 0, h);
      heatGrad.addColorStop(0, 'transparent');
      const baseHeatMid = 0.04 + 0.04 * heatFactor;
      const baseHeatEnd = 0.08 + 0.08 * heatFactor;
      heatGrad.addColorStop(0.5, `rgba(196,80,60,${baseHeatMid})`);
      heatGrad.addColorStop(1, `rgba(196,80,60,${baseHeatEnd})`);
      ctx.fillStyle = heatGrad;
      ctx.fillRect(0, h * 0.7, w, h * 0.3);

      // --- 3. Apply zoom + rotation transform (spec 2.10, 2.9) ---
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.rotate(rotationRef.current);
      ctx.translate(-cx, -cy);

      // --- 4. Edges (spec 2.7) ---
      for (const edge of edges) {
        const srcNode = nodeMap.get(edge.source);
        const tgtNode = nodeMap.get(edge.target);
        if (!srcNode || !tgtNode) continue;

        // Apply Lissajous drift to edge endpoints too
        const srcPhase = srcNode.driftPhase;
        const sx = srcNode.x * w + Math.sin(time * 0.008 + srcPhase) * 10 + Math.sin(time * 0.003 + srcPhase * 2.7) * 6;
        const sy = srcNode.y * h + Math.cos(time * 0.006 + srcPhase * 1.3) * 10 + Math.cos(time * 0.004 + srcPhase * 3.1) * 6;
        const tgtPhase = tgtNode.driftPhase;
        const tx = tgtNode.x * w + Math.sin(time * 0.008 + tgtPhase) * 10 + Math.sin(time * 0.003 + tgtPhase * 2.7) * 6;
        const ty = tgtNode.y * h + Math.cos(time * 0.006 + tgtPhase * 1.3) * 10 + Math.cos(time * 0.004 + tgtPhase * 3.1) * 6;

        // Edge draw progress for evidence animation (spec section 6)
        const edgeKey = `${edge.source}-${edge.target}`;
        let drawProgress = edgeDrawProgressRef.current.get(edgeKey) ?? 1;
        if (highlightedNodeIds.has(edge.source) || highlightedNodeIds.has(edge.target)) {
          const target = 1;
          const current = edgeDrawProgressRef.current.get(edgeKey) ?? 0;
          drawProgress = current + (target - current) * 0.08;
          edgeDrawProgressRef.current.set(edgeKey, drawProgress);
        }

        const isSelectedEdge = selectedId && (edge.source === selectedId || edge.target === selectedId);
        const isTensionView = currentView === 'claim_tension';
        const isTensionEdge = isTensionView && edge.edgeType === 'tension';

        ctx.beginPath();
        if (drawProgress < 0.99) {
          // Progressive edge draw
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + (tx - sx) * drawProgress, sy + (ty - sy) * drawProgress);
        } else {
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
        }

        if (isTensionEdge) {
          // Tension edges: terracotta, animated dash (spec 2.7)
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -time * 0.3;
          ctx.strokeStyle = `rgba(${TERRACOTTA_RGB[0]},${TERRACOTTA_RGB[1]},${TERRACOTTA_RGB[2]},${0.2 * edge.strength})`;
          ctx.lineWidth = 0.8;
        } else if (isSelectedEdge) {
          // Selected node edges: teal (spec 2.7)
          ctx.setLineDash([]);
          ctx.strokeStyle = `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},${0.15 * edge.strength})`;
          ctx.lineWidth = 0.8;
        } else {
          // Default: gossamer (spec 2.7)
          ctx.setLineDash([]);
          ctx.strokeStyle = `rgba(156,149,141,${0.04 * edge.strength})`;
          ctx.lineWidth = 0.5;
        }

        ctx.stroke();
        ctx.setLineDash([]);
      }

      // --- 5. Nodes (spec 2.6) ---
      // Compute centroid for core glow
      let centroidX = cx, centroidY = cy;
      if (nodes.length > 0) {
        let sumX = 0, sumY = 0;
        for (const node of nodes) { sumX += node.x * w; sumY += node.y * h; }
        centroidX = sumX / nodes.length;
        centroidY = sumY / nodes.length;
      }

      // Labels to draw after nodes (spec 2.8: labels rendered after transform restore)
      const labelsToRender: Array<{ nx: number; ny: number; label: string; type: string; edgeCount: number; isSelected: boolean; isHovered: boolean }> = [];

      for (const node of nodes) {
        // Per-node Lissajous drift (spec 2.6)
        const phase = node.driftPhase;
        const driftX = Math.sin(time * 0.008 + phase) * 10 + Math.sin(time * 0.003 + phase * 2.7) * 6;
        const driftY = Math.cos(time * 0.006 + phase * 1.3) * 10 + Math.cos(time * 0.004 + phase * 3.1) * 6;
        const nx = node.x * w + driftX;
        const ny = node.y * h + driftY;

        // Per-node brightness pulsing (spec 2.6)
        const basePulse = Math.sin(time * 0.015 + node.pulseOffset) * 0.05;
        let alpha = node.brightness + basePulse;

        // Base color from objectType (spec 2.6)
        let [r, g, b] = getTypeColor(node.objectType);
        let radius = node.radius;

        // Investigation view coloring (spec section 5)
        const viewFade = viewFadeRef.current;
        if (viewFade > 0.01) {
          if (currentView === 'evidence') {
            if (highlightedNodeIds.has(node.id)) {
              r = r + (TEAL_RGB[0] - r) * viewFade;
              g = g + (TEAL_RGB[1] - g) * viewFade;
              b = b + (TEAL_RGB[2] - b) * viewFade;
            } else {
              alpha = alpha + (0.06 - alpha) * viewFade;
            }
          } else if (currentView === 'claim_tension') {
            // Tension nodes pulse
            if (node.objectType === 'hunch' || highlightedNodeIds.has(node.id)) {
              const osc = Math.sin(time * 0.03 + node.pulseOffset) * 0.3;
              radius = radius + radius * osc * viewFade;
              r = r + (TERRACOTTA_RGB[0] - r) * viewFade;
              g = g + (TERRACOTTA_RGB[1] - g) * viewFade;
              b = b + (TERRACOTTA_RGB[2] - b) * viewFade;
            }
          } else if (currentView === 'entity_network') {
            const isEntity = node.objectType === 'person' || node.objectType === 'concept';
            if (!isEntity) {
              alpha = alpha + (0.06 - alpha) * viewFade;
            }
          } else if (currentView === 'reasoning_trace') {
            // Color by pipeline stage
            const stageColor = PIPELINE_COLORS.L1; // Default to L1 teal
            r = r + (stageColor[0] - r) * viewFade;
            g = g + (stageColor[1] - g) * viewFade;
            b = b + (stageColor[2] - b) * viewFade;
          }
        }

        // Neighbor dimming on selection (spec 2.6)
        const isSelected = node.id === selectedId;
        const isNeighbor = neighbors.has(node.id);
        const targetDim = (selectedId && !isNeighbor && !isSelected) ? 0.15 : 1.0;
        const prevDim = dimFactorsRef.current.get(node.id) ?? 1.0;
        const newDim = prevDim + (targetDim - prevDim) * 0.08;
        dimFactorsRef.current.set(node.id, newDim);
        alpha *= newDim;

        // Cursor proximity brightness boost (spec section 3)
        const distToCursor = Math.sqrt((nx - mouse.x) ** 2 + (ny - mouse.y) ** 2);
        const cursorTarget = distToCursor < 60 ? 0.1 : 0;
        const prevBoost = cursorBoostRef.current.get(node.id) ?? 0;
        const newBoost = prevBoost + (cursorTarget - prevBoost) * 0.1;
        cursorBoostRef.current.set(node.id, newBoost);
        alpha += newBoost;

        // Evidence node fade-in (spec section 6)
        if (highlightedNodeIds.has(node.id)) {
          const prevFade = evidenceFadeRef.current.get(node.id) ?? 0;
          const newFade = prevFade + (1 - prevFade) * 0.05;
          evidenceFadeRef.current.set(node.id, newFade);
          alpha *= newFade;
        }

        // Selected node glow halo (spec 2.6)
        if (isSelected) {
          const glowRadius = radius * 5;
          const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowRadius);
          grad.addColorStop(0, 'rgba(74,138,150,0.2)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(nx - glowRadius, ny - glowRadius, glowRadius * 2, glowRadius * 2);
          radius *= 1.5;
          alpha = Math.max(alpha, 0.8);
        }

        // Hovered node brightness boost (spec 2.6)
        const isHovered = node.id === hoveredId;
        if (isHovered) {
          alpha = Math.max(alpha, 0.6);
          radius *= 1.3;
        }

        // Draw node circle
        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.max(0, Math.min(1, alpha))})`;
        ctx.fill();

        // Collect labels (spec 2.8)
        if (isSelected || isHovered || node.edgeCount > 50) {
          labelsToRender.push({
            nx, ny,
            label: node.title,
            type: node.objectType,
            edgeCount: node.edgeCount,
            isSelected,
            isHovered,
          });
        }
      }

      // --- Core glow (spec 2.11) ---
      const coreAlpha = 0.5 + Math.sin(time * 0.02) * 0.125;
      const coreGlow = ctx.createRadialGradient(centroidX, centroidY, 0, centroidX, centroidY, 40);
      coreGlow.addColorStop(0, `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},0.12)`);
      coreGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = coreGlow;
      ctx.fillRect(centroidX - 40, centroidY - 40, 80, 80);
      // Core dot
      ctx.beginPath();
      ctx.arc(centroidX, centroidY, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${TEAL_RGB[0]},${TEAL_RGB[1]},${TEAL_RGB[2]},${coreAlpha})`;
      ctx.fill();

      // --- 6. Labels and tooltips (spec 2.8 + section 8) ---
      // Restore transform so labels stay upright
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);

      for (const lbl of labelsToRender) {
        if (lbl.isSelected || lbl.isHovered) {
          // Tooltip pill (spec section 8)
          const titleText = lbl.label;
          const subtitleText = `${lbl.type} \u00b7 ${lbl.edgeCount} connections`;
          ctx.font = '11px "JetBrains Mono", "Courier New", monospace';
          const titleWidth = ctx.measureText(titleText).width;
          ctx.font = '10px "JetBrains Mono", "Courier New", monospace';
          const subtitleWidth = ctx.measureText(subtitleText).width;
          const pw = Math.max(titleWidth, subtitleWidth) + 20;
          const ph = 40;
          const rx = lbl.nx - pw / 2;
          const nodeOffset = lbl.isSelected ? 6 * 1.5 : 6;
          const pillY = lbl.ny + nodeOffset + 6;

          // Pill background
          ctx.beginPath();
          ctx.roundRect(rx, pillY, pw, ph, 8);
          ctx.fillStyle = 'rgba(10,11,12,0.8)';
          ctx.fill();
          // Pill border
          ctx.strokeStyle = lbl.isSelected
            ? 'rgba(74,138,150,0.5)'
            : 'rgba(74,138,150,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Title text
          ctx.font = '11px "JetBrains Mono", "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = lbl.isSelected
            ? 'rgba(244,243,240,0.9)'
            : 'rgba(244,243,240,0.8)';
          ctx.fillText(titleText, lbl.nx, pillY + 14);

          // Subtitle
          ctx.font = '10px "JetBrains Mono", "Courier New", monospace';
          ctx.fillStyle = 'rgba(244,243,240,0.3)';
          ctx.fillText(subtitleText, lbl.nx, pillY + 28);
        } else {
          // Hub labels: dim, no pill (spec 2.8)
          ctx.font = '11px "JetBrains Mono", "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(244,243,240,0.12)';
          ctx.fillText(lbl.label, lbl.nx, lbl.ny - lbl.edgeCount * 0.01 - 10);
        }
      }

      // --- 7. Restore transform ---
      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  // Re-mount loop when data shape changes; per-frame reads use refs
  }, [nodes, edges, selectedNodeId, highlightedNodeIds, activeView, askState, interaction.mouseRef]);

  return (
    <div
      ref={wrapperRef}
      onMouseMove={onMouseMove}
      onWheel={onWheel}
      onClick={onClick}
      className="explorer-canvas-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: 'crosshair',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
}
