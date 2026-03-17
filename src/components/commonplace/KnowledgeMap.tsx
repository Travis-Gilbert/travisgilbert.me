'use client';

/**
 * KnowledgeMap: primary network view for CommonPlace.
 *
 * Two-layer rendering (mirrors ConnectionMap.tsx pattern):
 *   Canvas (behind): rough.js hand-drawn edges
 *   SVG (front): colored interactive nodes with hover/click
 *
 * Force simulation runs synchronously (300 iterations) for instant
 * layout. D3 zoom on the SVG layer for pan/zoom. DPR-aware canvas.
 *
 * Batch 6 additions:
 *   - Type icons inside nodes (SVG paths, 60% of radius, white stroke)
 *   - Clickable edges: invisible wide SVG lines + Floating UI tooltip
 *   - Score labels gated on mode === 'live' + scoreMap prop
 *
 * Props:
 *   onOpenObject  callback when a node is clicked (opens detail in adjacent pane)
 *   filter        optional set of object type slugs to include (all if omitted)
 *   cluster       enable type-based clustering forces
 *   mode          'live' shows relevance score labels below nodes
 *   scoreMap      node id -> score (0..1) for live mode labels
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import rough from 'roughjs';
import {
  useFloating,
  FloatingPortal,
  autoUpdate,
  offset,
  flip,
  shift,
} from '@floating-ui/react';
import { OBJECT_TYPES, getObjectTypeIdentity } from '@/lib/commonplace';
import type { GraphNode, GraphLink } from '@/lib/commonplace';
import {
  computeGraphLayout,
  getNodeColor,
  truncateLabel,
} from '@/lib/commonplace-graph';
import GraphTooltip from '@/components/GraphTooltip';

/* ─────────────────────────────────────────────────
   Icon path map (16x16 viewBox, same source as SidebarIcon)
   One entry per object type slug.
   ───────────────────────────────────────────────── */

const ICON_PATHS: Record<string, string> = {
  note: 'M2 14l1-4L11 2l3 3-8 8zM10 3l3 3',
  source: 'M2 3h4a2 2 0 012 2v9l-1-1H2zM14 3h-4a2 2 0 00-2 2v9l1-1h5z',
  person: 'M8 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 14c0-2.8 2.2-5 5-5s5 2.2 5 5',
  place: 'M8 14s5-4.5 5-8A5 5 0 003 6c0 3.5 5 8 5 8zM8 8a2 2 0 100-4 2 2 0 000 4z',
  organization: 'M3 14V3h10v11M6 5h1M9 5h1M6 8h1M9 8h1M6 11h4v3H6z',
  concept: 'M8 1a4 4 0 00-2 7.5V11h4V8.5A4 4 0 008 1zM6 13h4M6 14.5h4',
  quote: 'M3 6c0-2 1.5-3 3-3M10 6c0-2 1.5-3 3-3M3 6v3a1.5 1.5 0 003 0V6M10 6v3a1.5 1.5 0 003 0V6',
  hunch: 'M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2',
  event: 'M2 5h12M2 3h12v11H2zM5 1v3M11 1v3',
  script: 'M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12',
  task: 'M8 15A7 7 0 108 1a7 7 0 000 14zM5.5 8l2 2 3.5-4',
};

interface KnowledgeMapProps {
  onOpenObject?: (objectId: string) => void;
  /** Pre-fetched graph nodes from parent NetworkView */
  graphNodes: GraphNode[];
  /** Pre-fetched graph links from parent NetworkView */
  graphLinks: GraphLink[];
  filter?: Set<string>;
  cluster?: boolean;
  /** Show labels on all nodes (not just hover) */
  alwaysShowLabels?: boolean;
  /** 'live': show relevance score labels below nodes */
  mode?: 'live';
  /** Node id -> relevance score (0..1) for live mode */
  scoreMap?: Map<string, number>;
  /** Exposes a canvas snapshot getter to parent views (FrameManager thumbnails). */
  registerSnapshotGetter?: (getter: (() => string | null) | null) => void;
}

interface ActiveEdge {
  link: GraphLink;
  /** Midpoint in container-relative screen coords */
  midX: number;
  midY: number;
}

/* ── Signal type classification ─────────────────────── */

type SignalType = 'mention' | 'support' | 'contradict' | 'similarity' | 'causal' | 'manual';

/** Hex colors keyed by signal type (site color language). */
const SIGNAL_TYPE_COLORS: Record<SignalType, string> = {
  mention: '#2D5F6B',     // teal
  support: '#5A7A4A',     // green
  contradict: '#B8623D',  // terracotta
  similarity: '#8B6FA0',  // purple
  causal: '#C49A4A',      // gold
  manual: '#9A9590',      // faint gray
};

function classifySignal(link: GraphLink): SignalType {
  const engine = (link.engine || '').toLowerCase();
  const edgeType = (link.edge_type || '').toLowerCase();
  const reason = (link.reason || '').toLowerCase();

  if (engine.includes('manual')) return 'manual';

  if (
    edgeType.includes('counter') ||
    edgeType.includes('tension') ||
    reason.includes('contradict')
  ) {
    return 'contradict';
  }
  if (edgeType.includes('support') || reason.includes('support') || reason.includes('entail')) {
    return 'support';
  }
  if (edgeType.includes('causal') || reason.includes('caus')) {
    return 'causal';
  }
  if (
    edgeType.includes('similar') ||
    reason.includes('similar') ||
    engine.includes('embedding') ||
    engine.includes('kge')
  ) {
    return 'similarity';
  }
  // Default: NER co-occurrence, bridge links, or unclassified connections
  return 'mention';
}

/** djb2 hash for deterministic rough.js seeds. */
function hashSeed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Map edge strength (0..1) to stroke width (0.5..3.0). */
function strengthToWidth(strength: number | undefined): number {
  const s = typeof strength === 'number' ? Math.max(0, Math.min(1, strength)) : 0.4;
  return 0.5 + s * 2.5;
}

/** Map edge strength to roughness: strong edges are smoother (0.8), weak edges are sketchier (1.5). */
function strengthToRoughness(strength: number | undefined): number {
  const s = typeof strength === 'number' ? Math.max(0, Math.min(1, strength)) : 0.4;
  return 1.5 - s * 0.7;
}

/** Convert hex (#RRGGBB) to "R, G, B" string for rgba(). */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function edgeTone(link: GraphLink): string {
  return classifySignal(link).replace(/_/g, ' ');
}

interface EdgeStyleResult {
  color: string;
  width: number;
  roughness: number;
  bowing: number;
  seed: number;
  dash?: string;
}

function edgeStyle(link: GraphLink): EdgeStyleResult {
  const signal = classifySignal(link);
  const hex = SIGNAL_TYPE_COLORS[signal];
  const rgb = hexToRgb(hex);
  const edgeId = `${String(link.source)}-${String(link.target)}-${link.reason ?? ''}`;

  const base: EdgeStyleResult = {
    color: rgb,
    width: strengthToWidth(link.strength),
    roughness: strengthToRoughness(link.strength),
    bowing: signal === 'contradict' ? 2.0 : signal === 'similarity' ? 0.3 : 0.5,
    seed: hashSeed(edgeId),
  };

  if (signal === 'manual') {
    base.dash = '1.5 5';
  }

  return base;
}

export default function KnowledgeMap({
  onOpenObject,
  graphNodes: rawNodes,
  graphLinks: rawLinks,
  filter,
  cluster = false,
  alwaysShowLabels = false,
  mode,
  scoreMap,
  registerSnapshotGetter,
}: KnowledgeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 400 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [clickedId, setClickedId] = useState<string | null>(null);
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const [activeEdge, setActiveEdge] = useState<ActiveEdge | null>(null);

  /* ── Filter by object type ───────────────────────────── */

  const filteredNodes = useMemo(() => {
    if (!filter) return rawNodes;
    return rawNodes.filter((n) => filter.has(n.objectType));
  }, [rawNodes, filter]);

  const filteredLinks = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return rawLinks.filter(
      (l) => nodeIds.has(String(l.source)) && nodeIds.has(String(l.target)),
    );
  }, [rawLinks, filteredNodes]);

  /* ── Layout (deferred to yield one paint frame for loading indicator) ── */

  const layout = useMemo(
    () =>
      computeGraphLayout(filteredNodes, filteredLinks, containerSize.width, containerSize.height, {
        charge: -120,
        linkDistance: 80,
        cluster,
      }),
    [filteredNodes, filteredLinks, containerSize.width, containerSize.height, cluster],
  );

  const posMap = useMemo(
    () => new Map(layout.map((l) => [l.node.id, l])),
    [layout],
  );

  /* ── Resize observer ───────────────────────────── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ width: Math.round(width), height: Math.round(height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── D3 zoom behavior ───────────────────────────── */

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    d3.select(svg).call(zoomBehavior);
    return () => { d3.select(svg).on('.zoom', null); };
  }, []);

  /* ── Connected IDs for hover highlighting ───────── */

  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!hoveredId) return ids;
    ids.add(hoveredId);
    filteredLinks.forEach((l) => {
      const src = String(l.source);
      const tgt = String(l.target);
      if (src === hoveredId) ids.add(tgt);
      if (tgt === hoveredId) ids.add(src);
    });
    return ids;
  }, [hoveredId, filteredLinks]);

  /* ── Draw rough.js edges on canvas ───────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layout.length === 0) return;

    const { width, height } = containerSize;
    const dpr = window.devicePixelRatio || 1;

    // Guard: never set canvas to 0x0 (browsers render a broken-image icon)
    // Also cap to 8192 to stay within browser canvas size limits
    if (width < 1 || height < 1) return;
    const cw = Math.min(width, 8192);
    const ch = Math.min(height, 8192);

    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
      transform.k * dpr, 0, 0, transform.k * dpr,
      transform.x * dpr, transform.y * dpr,
    );

    const rc = rough.canvas(canvas);

    filteredLinks.forEach((l) => {
      const src = String(l.source);
      const tgt = String(l.target);
      const from = posMap.get(src);
      const to = posMap.get(tgt);
      if (!from || !to) return;

      const style = edgeStyle(l);

      // Opacity: 0.25 resting, 0.04 dimmed (hovering unrelated node), 0.7 highlighted
      let alpha = 0.25;
      if (hoveredId) {
        const connected = connectedIds.has(src) && connectedIds.has(tgt);
        alpha = connected ? 0.7 : 0.04;
      }

      rc.line(from.x, from.y, to.x, to.y, {
        roughness: style.roughness,
        stroke: `rgba(${style.color}, ${alpha})`,
        strokeWidth: style.width,
        bowing: style.bowing,
        seed: style.seed,
      });
    });
  }, [layout, filteredLinks, hoveredId, connectedIds, containerSize, posMap, transform]);

  useEffect(() => {
    if (!registerSnapshotGetter) return;
    registerSnapshotGetter(() => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      try {
        return canvas.toDataURL('image/png', 0.3);
      } catch {
        return null;
      }
    });
    return () => registerSnapshotGetter(null);
  }, [registerSnapshotGetter, containerSize.width, containerSize.height, layout.length]);

  /* ── Click handler for nodes ─────────────────────── */

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setClickedId(nodeId);
      setTimeout(() => {
        setClickedId(null);
        onOpenObject?.(nodeId);
      }, 250);
    },
    [onOpenObject],
  );

  /* ── Edge click handler ───────────────────────────── */

  const handleEdgeClick = useCallback(
    (link: GraphLink, e: React.MouseEvent) => {
      e.stopPropagation();
      const src = posMap.get(String(link.source));
      const tgt = posMap.get(String(link.target));
      if (!src || !tgt) return;

      const midX = ((src.x + tgt.x) / 2) * transform.k + transform.x;
      const midY = ((src.y + tgt.y) / 2) * transform.k + transform.y;
      setActiveEdge({ link, midX, midY });
    },
    [posMap, transform],
  );

  /* ── Floating UI for edge tooltip ────────────────── */

  const { refs: floatRefs, floatingStyles } = useFloating({
    placement: 'top',
    open: !!activeEdge,
    middleware: [offset(10), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const setFloatingRef = useCallback(
    (node: HTMLDivElement | null) => {
      floatRefs.setFloating(node);
    },
    [floatRefs],
  );

  useEffect(() => {
    if (!activeEdge || !containerRef.current) {
      floatRefs.setReference(null);
      return;
    }
    const container = containerRef.current;
    floatRefs.setReference({
      getBoundingClientRect() {
        const rect = container.getBoundingClientRect();
        const x = rect.left + activeEdge.midX;
        const y = rect.top + activeEdge.midY;
        return { x, y, width: 0, height: 0, top: y, bottom: y, left: x, right: x, toJSON() {} } as DOMRect;
      },
    });
  }, [activeEdge, floatRefs]);

  /* ── Legend ───────────────────────────── */

  const presentTypes = useMemo(() => {
    const types = new Set(layout.map((l) => l.node.objectType));
    return OBJECT_TYPES.filter((t) => types.has(t.slug));
  }, [layout]);

  const hoveredNode = hoveredId ? posMap.get(hoveredId) : null;

  /* ── Edge tooltip source/target label ────────────── */

  const edgeTooltipContent = useMemo(() => {
    if (!activeEdge) return null;
    const srcEntry = posMap.get(String(activeEdge.link.source));
    const tgtEntry = posMap.get(String(activeEdge.link.target));
    const srcType = srcEntry ? getObjectTypeIdentity(srcEntry.node.objectType).label : '';
    const tgtType = tgtEntry ? getObjectTypeIdentity(tgtEntry.node.objectType).label : '';
    const strength = typeof activeEdge.link.strength === 'number'
      ? `${Math.round(activeEdge.link.strength * 100)}%`
      : null;
    return {
      edgeTypeLabel: activeEdge.link.edge_type || 'related',
      nodePair: srcType && tgtType ? `${srcType} -- ${tgtType}` : 'Connection',
      reason: activeEdge.link.reason,
      strength,
      engine: edgeTone(activeEdge.link).replace(/_/g, ' '),
      srcNode: srcEntry?.node,
      tgtNode: tgtEntry?.node,
    };
  }, [activeEdge, posMap]);

  return (
    <div
      ref={containerRef}
      className="cp-graph-canvas"
      style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
      onClick={() => setActiveEdge(null)}
    >
      {/* Loading indicator when graph has data but layout is empty (initial render) */}
      {filteredNodes.length > 0 && layout.length === 0 && (
        <div className="cp-empty-state" style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
          Computing layout...
        </div>
      )}

      {/* Canvas layer: rough.js edges */}
      <canvas
        ref={canvasRef}
        width={1}
        height={1}
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />

      {/* SVG layer: interactive nodes + edge hit areas */}
      <svg
        ref={svgRef}
        width={containerSize.width}
        height={containerSize.height}
        style={{ position: 'relative', zIndex: 1, cursor: 'grab' }}
        role="img"
        aria-label="Knowledge map showing object relationships"
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>

          {/* Invisible edge hit areas (rendered before nodes so nodes stay on top) */}
          {filteredLinks.map((l, index) => {
            const src = String(l.source);
            const tgt = String(l.target);
            const from = posMap.get(src);
            const to = posMap.get(tgt);
            if (!from || !to) return null;
            const edgeKey = `edge-${src}-${tgt}-${l.reason ?? ''}-${index}`;
            const style = edgeStyle(l);
            return (
              <g key={edgeKey}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={`rgba(${style.color}, 0.35)`}
                  strokeWidth={style.width + 0.15}
                  strokeDasharray={style.dash}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => handleEdgeClick(l, e)}
                />
              </g>
            );
          })}

          {/* Nodes */}
          {layout.map(({ x, y, radius, node }) => {
            const dimmed = hoveredId !== null && !connectedIds.has(node.id);
            const pulsing = clickedId === node.id;
            const color = getNodeColor(node.objectType);
            const showLabel = alwaysShowLabels || hoveredId === node.id;
            const typeInfo = getObjectTypeIdentity(node.objectType);
            const iconPath = ICON_PATHS[node.objectType] ?? ICON_PATHS.note;
            const iconRadius = radius * 0.6;
            const iconScale = (iconRadius * 2) / 16;
            const score = scoreMap?.get(node.id);

            return (
              <g
                key={node.id}
                style={{ cursor: 'pointer', pointerEvents: 'all', transition: 'opacity 200ms ease' }}
                opacity={dimmed ? 0.12 : 1}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleNodeClick(node.id)}
              >
                {/* Node circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={pulsing ? radius * 1.4 : radius}
                  fill={color}
                  fillOpacity={0.65}
                  stroke={color}
                  strokeWidth={hoveredId === node.id ? 2 : 1.2}
                  style={{ transition: 'r 200ms ease, stroke-width 150ms ease' }}
                />

                {/* Type icon inside circle (16x16 path, centered and scaled) */}
                <g
                  transform={`translate(${x}, ${y}) scale(${iconScale}) translate(-8, -8)`}
                  style={{ pointerEvents: 'none' }}
                >
                  <path
                    d={iconPath}
                    stroke="white"
                    fill="none"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.75}
                  />
                </g>

                {/* Label: shown on hover or always */}
                {showLabel && (
                  <text
                    x={x}
                    y={y + radius + 13}
                    textAnchor="middle"
                    fill="var(--cp-text)"
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9,
                      letterSpacing: '0.05em',
                      pointerEvents: 'none',
                    }}
                  >
                    {truncateLabel(node.title)}
                  </text>
                )}

                {/* Score label in live mode */}
                {mode === 'live' && score !== undefined && (
                  <text
                    x={x}
                    y={y + radius + (showLabel ? 24 : 13)}
                    textAnchor="middle"
                    fill={typeInfo.color}
                    style={{
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 8,
                      letterSpacing: '0.04em',
                      pointerEvents: 'none',
                      opacity: 0.8,
                    }}
                  >
                    {Math.round(score * 100)}%
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Node hover tooltip */}
      <GraphTooltip
        title={hoveredNode?.node.title ?? ''}
        subtitle={
          hoveredNode
            ? `${getObjectTypeIdentity(hoveredNode.node.objectType).label} · ${hoveredNode.node.edgeCount} connections`
            : ''
        }
        position={{
          x: hoveredNode ? hoveredNode.x * transform.k + transform.x : 0,
          y: hoveredNode ? hoveredNode.y * transform.k + transform.y - hoveredNode.radius * transform.k - 36 : 0,
        }}
        visible={!!hoveredNode}
        className="commonplace-theme"
      />

      {/* Edge tooltip (Floating UI) */}
      <FloatingPortal>
        {activeEdge && edgeTooltipContent && (
          <div
            ref={setFloatingRef}
            style={{
              ...floatingStyles,
              zIndex: 100,
            }}
            className="commonplace-theme"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: 'var(--cp-surface)',
                border: '1px solid var(--cp-border)',
                borderRadius: 4,
                padding: '10px 12px',
                boxShadow: 'var(--cp-shadow-md)',
                maxWidth: 260,
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 11,
                color: 'var(--cp-text)',
              }}
            >
              {/* Edge type header */}
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--cp-text-faint)',
                  marginBottom: 4,
                }}
              >
                {edgeTooltipContent.edgeTypeLabel}
              </div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--cp-text-faint)',
                  marginBottom: 8,
                }}
              >
                {edgeTooltipContent.nodePair}
                {edgeTooltipContent.strength ? ` · ${edgeTooltipContent.strength}` : ''}
                {edgeTooltipContent.engine ? ` · ${edgeTooltipContent.engine}` : ''}
              </div>

              {/* Reason */}
              {edgeTooltipContent.reason && (
                <div
                  style={{
                    fontFamily: 'var(--cp-font-body)',
                    fontSize: 12,
                    color: 'var(--cp-text-muted)',
                    lineHeight: 1.45,
                    marginBottom: 8,
                  }}
                >
                  {edgeTooltipContent.reason}
                </div>
              )}

              {/* View details links */}
              <div style={{ display: 'flex', gap: 8 }}>
                {edgeTooltipContent.srcNode && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9.5,
                      letterSpacing: '0.06em',
                      color: 'rgba(180,90,45,0.8)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                    }}
                    onClick={() => {
                      setActiveEdge(null);
                      onOpenObject?.(edgeTooltipContent.srcNode!.id);
                    }}
                  >
                    {truncateLabel(edgeTooltipContent.srcNode.title, 18)}
                  </button>
                )}
                {edgeTooltipContent.srcNode && edgeTooltipContent.tgtNode && (
                  <span style={{ color: 'var(--cp-text-faint)', fontSize: 9 }}>·</span>
                )}
                {edgeTooltipContent.tgtNode && (
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontFamily: 'var(--cp-font-mono)',
                      fontSize: 9.5,
                      letterSpacing: '0.06em',
                      color: 'rgba(180,90,45,0.8)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                    }}
                    onClick={() => {
                      setActiveEdge(null);
                      onOpenObject?.(edgeTooltipContent.tgtNode!.id);
                    }}
                  >
                    {truncateLabel(edgeTooltipContent.tgtNode.title, 18)}
                  </button>
                )}
              </div>

              {/* Dismiss */}
              <button
                type="button"
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 8,
                  background: 'none',
                  border: 'none',
                  fontSize: 13,
                  color: 'var(--cp-text-faint)',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: 0,
                }}
                onClick={() => setActiveEdge(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </FloatingPortal>

      {/* Legend (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {presentTypes.map((t) => (
          <div
            key={t.slug}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              letterSpacing: '0.05em',
              color: 'var(--cp-text-muted)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: t.color,
                opacity: 0.7,
              }}
            />
            {t.label}
          </div>
        ))}
      </div>

      {/* Zoom controls (bottom-left) */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <button
          onClick={() => {
            const svg = svgRef.current;
            if (!svg) return;
            d3.select(svg).transition().duration(300).call(
              d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 4]).scaleTo,
              transform.k * 1.4,
            );
          }}
          className="cp-zoom-btn"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => {
            const svg = svgRef.current;
            if (!svg) return;
            d3.select(svg).transition().duration(300).call(
              d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 4]).scaleTo,
              transform.k / 1.4,
            );
          }}
          className="cp-zoom-btn"
          title="Zoom out"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <button
          onClick={() => {
            const svg = svgRef.current;
            if (!svg) return;
            d3.select(svg)
              .transition()
              .duration(400)
              .call(
                d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 4]).transform,
                d3.zoomIdentity,
              );
          }}
          className="cp-zoom-btn"
          title="Reset view"
          aria-label="Reset zoom"
          style={{ fontSize: 11 }}
        >
          ⟳
        </button>
      </div>
    </div>
  );
}
