'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type {
  CodeContextResult,
  CodeEdgeType,
  CodeImpactResult,
  ImpactSymbol,
} from '@/lib/theseus-types';
import { EDGE_COLORS, clusterColor } from './codeColors';

interface Props {
  focalSymbol: string;
  impact: CodeImpactResult;
  context: CodeContextResult | null;
  onSymbolSelect: (name: string) => void;
  onSymbolHover: (symbol: ImpactSymbol | null, x: number, y: number) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  depth: number;
  ppr: number;
  community: number | undefined;
  isFocal: boolean;
  entity_type: ImpactSymbol['entity_type'] | 'focal';
  source: ImpactSymbol | null;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
  edge_type: CodeEdgeType;
  strength: number;
}

const MAX_CANVAS_PX = 8192;
const NODE_RADIUS_MIN = 4;
const NODE_RADIUS_MAX = 14;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4;

/**
 * D3 force-directed canvas for code subgraph impact visualization.
 *
 * Follows the project Canvas pattern: guard against 0 dimensions,
 * cap to 8192px, scale by devicePixelRatio, render in requestAnimationFrame.
 * The force simulation runs in parallel with a transform (zoom/pan) that
 * is applied at draw time via ctx.translate + ctx.scale.
 */
export default function ImpactCanvas({
  focalSymbol,
  impact,
  context,
  onSymbolSelect,
  onSymbolHover,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<d3.Simulation<SimNode, SimEdge> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const hoveredRef = useRef<SimNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const [size, setSize] = useState({ w: 0, h: 0 });

  // Build nodes and edges from impact + context
  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, SimNode>();

    nodeMap.set(focalSymbol, {
      id: focalSymbol,
      name: focalSymbol,
      depth: 0,
      ppr: 1.0,
      community: undefined,
      isFocal: true,
      entity_type: 'focal',
      source: null,
    });

    for (const group of impact.depth_groups) {
      for (const sym of group.symbols) {
        if (nodeMap.has(sym.name)) continue;
        nodeMap.set(sym.name, {
          id: sym.name,
          name: sym.name,
          depth: group.depth,
          ppr: sym.ppr_score,
          community: undefined,
          isFocal: false,
          entity_type: sym.entity_type,
          source: sym,
        });
      }
    }

    const edges: SimEdge[] = [];
    if (context) {
      for (const inc of context.incoming) {
        if (nodeMap.has(inc.symbol.name)) {
          edges.push({
            source: inc.symbol.name,
            target: focalSymbol,
            edge_type: inc.edge_type,
            strength: inc.strength,
          });
        }
      }
      for (const out of context.outgoing) {
        if (nodeMap.has(out.symbol.name)) {
          edges.push({
            source: focalSymbol,
            target: out.symbol.name,
            edge_type: out.edge_type,
            strength: out.strength,
          });
        }
      }
    }

    return { nodes: Array.from(nodeMap.values()), edges };
  }, [focalSymbol, impact, context]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const rect = container.getBoundingClientRect();
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Force simulation setup
  useEffect(() => {
    if (size.w < 1 || size.h < 1) return;

    nodesRef.current = nodes;
    edgesRef.current = edges;

    const centerX = size.w / 2;
    const centerY = size.h / 2;

    const sim = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimEdge>(edges)
          .id((d) => d.id)
          .distance(80)
          .strength((d) => 0.3 + d.strength * 0.4),
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-120))
      .force(
        'radial',
        d3.forceRadial<SimNode>((d) => d.depth * 90, centerX, centerY).strength(0.4),
      )
      .force('collide', d3.forceCollide<SimNode>().radius(14))
      .alphaDecay(0.04);

    // Pin the focal node to the center
    const focal = nodes.find((n) => n.isFocal);
    if (focal) {
      focal.fx = centerX;
      focal.fy = centerY;
    }

    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
  }, [nodes, edges, size.w, size.h]);

  // Render loop
  useEffect(() => {
    if (size.w < 1 || size.h < 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const cw = Math.min(size.w, MAX_CANVAS_PX);
    const ch = Math.min(size.h, MAX_CANVAS_PX);
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
    ctx.scale(dpr, dpr);

    const centerX = cw / 2;
    const centerY = ch / 2;

    const draw = () => {
      ctx.save();
      ctx.clearRect(0, 0, cw, ch);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // Depth rings
      const maxDepth = Math.max(1, ...nodesRef.current.map((n) => n.depth));
      ctx.strokeStyle = 'rgba(74, 69, 64, 0.35)';
      ctx.setLineDash([2, 6]);
      for (let d = 1; d <= maxDepth; d++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, d * 90, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Edges
      for (const edge of edgesRef.current) {
        const s = edge.source as SimNode;
        const tgt = edge.target as SimNode;
        if (typeof s === 'string' || typeof tgt === 'string') continue;
        if (s.x === undefined || tgt.x === undefined) continue;

        ctx.strokeStyle = resolveCssColor(EDGE_COLORS[edge.edge_type]);
        ctx.globalAlpha = 0.15 + edge.strength * 0.6;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y!);
        ctx.lineTo(tgt.x!, tgt.y!);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Nodes
      for (const node of nodesRef.current) {
        if (node.x === undefined || node.y === undefined) continue;

        const radius = node.isFocal
          ? NODE_RADIUS_MAX
          : NODE_RADIUS_MIN + node.ppr * (NODE_RADIUS_MAX - NODE_RADIUS_MIN);

        // Node fill
        if (node.isFocal) {
          ctx.fillStyle = resolveCssColor('var(--cw-terra)');
        } else {
          ctx.fillStyle = resolveCssColor(clusterColor(node.community ?? node.depth));
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Focal ring
        if (node.isFocal) {
          ctx.strokeStyle = resolveCssColor('var(--cw-text)');
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Hover ring
        if (hoveredRef.current?.id === node.id && !node.isFocal) {
          ctx.strokeStyle = resolveCssColor('var(--cw-text)');
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label: only focal and hovered. Renders a padded pill behind
        // the text so it reads against any node color.
        if (node.isFocal || hoveredRef.current?.id === node.id) {
          ctx.font =
            '600 13px var(--font-ibm-plex), "IBM Plex Sans", Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const textMetrics = ctx.measureText(node.name);
          const textWidth = textMetrics.width;
          const padX = 8;
          const padY = 5;
          const pillW = textWidth + padX * 2;
          const pillH = 22;
          const pillX = node.x - pillW / 2;
          const pillY = node.y - radius - pillH - 8;

          // Pill background
          ctx.fillStyle = resolveCssColor('var(--cw-panel-bg)');
          ctx.globalAlpha = 0.94;
          roundRect(ctx, pillX, pillY, pillW, pillH, 4);
          ctx.fill();

          // Pill border
          ctx.strokeStyle = resolveCssColor('var(--cw-border)');
          ctx.lineWidth = 1;
          ctx.globalAlpha = 1;
          roundRect(ctx, pillX, pillY, pillW, pillH, 4);
          ctx.stroke();

          // Text
          ctx.fillStyle = resolveCssColor('var(--cw-text)');
          ctx.fillText(node.name, node.x, pillY + pillH / 2);
          ctx.textBaseline = 'alphabetic';
        }
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [size.w, size.h]);

  // Pointer interactions
  const getWorldPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const t = transformRef.current;
    return { x: (localX - t.x) / t.k, y: (localY - t.y) / t.k };
  }, []);

  const findNodeAt = useCallback((worldX: number, worldY: number): SimNode | null => {
    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue;
      const radius = node.isFocal
        ? NODE_RADIUS_MAX
        : NODE_RADIUS_MIN + node.ppr * (NODE_RADIUS_MAX - NODE_RADIUS_MIN);
      const dx = worldX - node.x;
      const dy = worldY - node.y;
      if (dx * dx + dy * dy <= (radius + 4) ** 2) return node;
    }
    return null;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const world = getWorldPoint(e.clientX, e.clientY);
      const node = findNodeAt(world.x, world.y);
      hoveredRef.current = node;
      if (node && node.source) {
        onSymbolHover(node.source, e.clientX, e.clientY);
      } else {
        onSymbolHover(null, 0, 0);
      }
    },
    [getWorldPoint, findNodeAt, onSymbolHover],
  );

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = null;
    onSymbolHover(null, 0, 0);
  }, [onSymbolHover]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const world = getWorldPoint(e.clientX, e.clientY);
      const node = findNodeAt(world.x, world.y);
      if (node && !node.isFocal) {
        onSymbolSelect(node.name);
      }
    },
    [getWorldPoint, findNodeAt, onSymbolSelect],
  );

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const t = transformRef.current;
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newK = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, t.k * scaleFactor));

    // Zoom around cursor
    const worldX = (localX - t.x) / t.k;
    const worldY = (localY - t.y) / t.k;
    transformRef.current = {
      k: newK,
      x: localX - worldX * newK,
      y: localY - worldY * newK,
    };
  }, []);

  // Pan via drag (not on a node)
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const world = getWorldPoint(e.clientX, e.clientY);
      if (findNodeAt(world.x, world.y)) return; // Don't pan from a node
      panningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transformRef.current.x,
        ty: transformRef.current.y,
      };
    },
    [getWorldPoint, findNodeAt],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panningRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      transformRef.current = {
        ...transformRef.current,
        x: panStartRef.current.tx + dx,
        y: panStartRef.current.ty + dy,
      };
    };
    const onUp = () => {
      panningRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="ce-canvas">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onWheel={handleWheel}
      />
    </div>
  );
}

/**
 * Resolve a CSS var reference to a concrete color for canvas use.
 * Canvas context does not evaluate var() strings directly.
 *
 * The --cw-* palette is scoped to .ce-root (not documentElement), so we
 * query from a .ce-root element if present, falling back to the document
 * element for any tokens that happen to be global.
 */
function resolveCssColor(value: string): string {
  if (typeof window === 'undefined' || !value.startsWith('var(')) return value;
  const match = value.match(/var\((--[^,)]+)(?:,\s*(.+))?\)/);
  if (!match) return value;
  const scope =
    (document.querySelector('.ce-root') as HTMLElement | null) ??
    document.documentElement;
  const resolved = getComputedStyle(scope).getPropertyValue(match[1]).trim();
  return resolved || match[2]?.trim() || value;
}

/**
 * Draw a rounded rectangle path. Kept local so the canvas layer has no
 * external dependency and can be re-used for any overlay chrome.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
