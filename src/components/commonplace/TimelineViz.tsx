'use client';

/**
 * TimelineViz: chronological visualization for CommonPlace.
 *
 * Objects plotted as colored dots on a horizontal time axis.
 * Edges rendered as arcs above the axis connecting related objects.
 * Scroll to zoom time range, drag to pan.
 *
 * Uses D3 scaleTime for the axis and D3 zoom for interaction.
 * Canvas layer for arcs, SVG layer for dots and axis.
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { getObjectTypeIdentity, OBJECT_TYPES } from '@/lib/commonplace';
import type { GraphNode, GraphLink } from '@/lib/commonplace';
import { getNodeColor, truncateLabel } from '@/lib/commonplace-graph';
import { EDGE_RGB } from '@/lib/graph/colors';
import GraphTooltip from '@/components/GraphTooltip';

interface TimelineVizProps {
  onOpenObject?: (objectId: string) => void;
  /** Pre-fetched graph nodes from parent NetworkView */
  graphNodes: GraphNode[];
  /** Pre-fetched graph links from parent NetworkView */
  graphLinks: GraphLink[];
}

/** Vertical offset: axis sits at 60% height, dots above and below */
const AXIS_Y_RATIO = 0.6;
/** Minimum arc height */
const MIN_ARC_HEIGHT = 30;
/** Max arc height */
const MAX_ARC_HEIGHT = 120;

export default function TimelineViz({
  onOpenObject,
  graphNodes,
  graphLinks,
}: TimelineVizProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 600, height: 300 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [transform, setTransform] = useState(d3.zoomIdentity);

  /* ── Data: distribute nodes evenly on a synthetic time axis ── */
  /* The /graph/ endpoint provides topology, not chronology. We spread
     nodes uniformly so the arc visualization still communicates which
     objects are connected. The real chronological view lives in TimelineView. */

  const nodes = graphNodes;
  const links = graphLinks;

  /* Synthetic time extent: one point per node, spread over 30 "days" */
  const timeExtent = useMemo(() => {
    const now = Date.now();
    const span = 30 * 86400000; // 30 days in ms
    return [new Date(now - span), new Date(now)] as [Date, Date];
  }, []);

  /* Base X scale (before zoom transform) */
  const xScale = useMemo(
    () => d3.scaleTime().domain(timeExtent).range([60, size.width - 30]),
    [timeExtent, size.width],
  );

  /* Zoomed X scale */
  const zoomedX = useMemo(
    () => transform.rescaleX(xScale),
    [transform, xScale],
  );

  const axisY = size.height * AXIS_Y_RATIO;

  /* Node positions */
  const nodePositions = useMemo(() => {
    /* Stagger dots vertically to reduce overlap */
    const typeSlots = new Map(OBJECT_TYPES.map((t, i) => [t.slug, i]));
    const totalTypes = OBJECT_TYPES.length;
    const count = nodes.length;

    return nodes.map((n, i) => {
      /* Distribute nodes evenly across the time axis */
      const frac = count > 1 ? i / (count - 1) : 0.5;
      const syntheticTime = new Date(
        timeExtent[0].getTime() + frac * (timeExtent[1].getTime() - timeExtent[0].getTime()),
      );
      const x = zoomedX(syntheticTime);
      const slot = typeSlots.get(n.objectType) ?? 0;
      /* Distribute types in vertical band above axis */
      const bandHeight = axisY - 40;
      const y = 20 + (slot / totalTypes) * bandHeight;
      return { node: n, x, y };
    });
  }, [nodes, zoomedX, axisY, timeExtent]);

  /* Position lookup */
  const posLookup = useMemo(
    () => new Map(nodePositions.map((p) => [p.node.id, p])),
    [nodePositions],
  );

  /* Connected IDs for hover */
  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!hoveredId) return ids;
    ids.add(hoveredId);
    links.forEach((l) => {
      const src = String(l.source);
      const tgt = String(l.target);
      if (src === hoveredId) ids.add(tgt);
      if (tgt === hoveredId) ids.add(src);
    });
    return ids;
  }, [hoveredId, links]);

  /* ── Resize observer ───────────────────────────── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setSize({ width: Math.round(width), height: Math.round(Math.max(250, height)) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── D3 zoom (horizontal only) ───────────────────── */

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .translateExtent([
        [-200, 0],
        [size.width + 200, size.height],
      ])
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    d3.select(svg).call(zoomBehavior);
    return () => { d3.select(svg).on('.zoom', null); };
  }, [size.width, size.height]);

  /* ── Draw arc edges on canvas ───────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;

    // Guard: never set canvas to 0x0 (browsers render a broken-image icon)
    if (size.width < 1 || size.height < 1) return;

    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    links.forEach((l) => {
      const src = String(l.source);
      const tgt = String(l.target);
      const from = posLookup.get(src);
      const to = posLookup.get(tgt);
      if (!from || !to) return;

      /* Skip if both off-screen */
      if ((from.x < -50 && to.x < -50) || (from.x > size.width + 50 && to.x > size.width + 50)) {
        return;
      }

      let alpha = 0.15;
      if (hoveredId) {
        const isConn = connectedIds.has(src) && connectedIds.has(tgt);
        alpha = isConn ? 0.45 : 0.03;
      }

      /* Arc height proportional to distance */
      const dx = Math.abs(to.x - from.x);
      const arcHeight = Math.min(MAX_ARC_HEIGHT, Math.max(MIN_ARC_HEIGHT, dx * 0.3));

      ctx.beginPath();
      ctx.strokeStyle = `rgba(${EDGE_RGB}, ${alpha})`;
      ctx.lineWidth = 1;

      /* Quadratic bezier arc above the nodes */
      const midX = (from.x + to.x) / 2;
      const midY = Math.min(from.y, to.y) - arcHeight;

      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(midX, midY, to.x, to.y);
      ctx.stroke();
    });
  }, [links, posLookup, hoveredId, connectedIds, size]);

  /* ── Click handler ───────────────────────────── */

  const handleClick = useCallback(
    (nodeId: string) => {
      onOpenObject?.(nodeId);
    },
    [onOpenObject],
  );

  /* ── Present types for legend ───────────────── */

  const presentTypes = useMemo(() => {
    const types = new Set(nodes.map((n) => n.objectType));
    return OBJECT_TYPES.filter((t) => types.has(t.slug));
  }, [nodes]);

  /* ── Hovered node for tooltip ───────────────── */

  const hoveredPos = hoveredId ? posLookup.get(hoveredId) : null;

  return (
    <div
      ref={containerRef}
      className="cp-timeline-viz"
      style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
    >
      {/* Canvas: arc edges */}
      <canvas
        ref={canvasRef}
        width={1}
        height={1}
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      />

      {/* SVG: axis + dots */}
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        style={{ position: 'relative', zIndex: 1, cursor: 'grab' }}
        role="img"
        aria-label="Chronological timeline visualization"
      >
        {/* Time axis */}
        <g transform={`translate(0,${axisY})`}>
          <line
            x1={0}
            y1={0}
            x2={size.width}
            y2={0}
            stroke="var(--cp-border)"
            strokeWidth={1}
          />
          {/* Tick marks */}
          {zoomedX.ticks(Math.max(3, Math.floor(size.width / 120))).map((tick, i) => {
            const x = zoomedX(tick);
            if (x < 20 || x > size.width - 20) return null;
            return (
              <g key={i} transform={`translate(${x},0)`}>
                <line y1={0} y2={6} stroke="var(--cp-border)" strokeWidth={1} />
                <text
                  y={18}
                  textAnchor="middle"
                  fill="var(--cp-text-faint)"
                  style={{
                    fontFamily: 'var(--cp-font-mono)',
                    fontSize: 8,
                    letterSpacing: '0.04em',
                  }}
                >
                  {d3.timeFormat('%b %d')(tick)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Nodes as dots */}
        {nodePositions.map(({ node, x, y }) => {
          const dimmed = hoveredId !== null && !connectedIds.has(node.id);
          const color = getNodeColor(node.objectType);

          return (
            <circle
              key={node.id}
              cx={x}
              cy={y}
              r={hoveredId === node.id ? 7 : 5}
              fill={color}
              fillOpacity={dimmed ? 0.12 : 0.7}
              stroke={color}
              strokeWidth={hoveredId === node.id ? 1.5 : 0.8}
              style={{
                cursor: 'pointer',
                pointerEvents: 'all',
                transition: 'r 150ms ease, fill-opacity 200ms ease',
              }}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleClick(node.id)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      <GraphTooltip
        title={hoveredPos?.node.title ?? ''}
        subtitle={
          hoveredPos
            ? `${getObjectTypeIdentity(hoveredPos.node.objectType).label} · ${hoveredPos.node.edgeCount} connections`
            : ''
        }
        position={{
          x: hoveredPos?.x ?? 0,
          y: (hoveredPos?.y ?? 0) - 32,
        }}
        visible={!!hoveredPos}
        className="commonplace-theme"
      />

      {/* Legend (bottom-right) */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 12,
          zIndex: 5,
          display: 'flex',
          gap: 12,
        }}
      >
        {presentTypes.map((t) => (
          <div
            key={t.slug}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 8,
              letterSpacing: '0.05em',
              color: 'var(--cp-text-muted)',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: t.color,
                opacity: 0.7,
              }}
            />
            {t.label}
          </div>
        ))}
      </div>
    </div>
  );
}
