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
 * Props:
 *   onOpenObject  callback when a node is clicked (opens detail in adjacent pane)
 *   filter        optional set of object type slugs to include (all if omitted)
 *   cluster       enable type-based clustering forces
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import rough from 'roughjs';
import { OBJECT_TYPES, getObjectTypeIdentity } from '@/lib/commonplace';
import type { GraphNode, GraphLink } from '@/lib/commonplace';
import {
  computeGraphLayout,
  getNodeColor,
  truncateLabel,
} from '@/lib/commonplace-graph';
import { EDGE_RGB } from '@/lib/graph/colors';
import GraphTooltip from '@/components/GraphTooltip';

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
}

export default function KnowledgeMap({
  onOpenObject,
  graphNodes: rawNodes,
  graphLinks: rawLinks,
  filter,
  cluster = false,
  alwaysShowLabels = false,
}: KnowledgeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 400 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [clickedId, setClickedId] = useState<string | null>(null);
  const [transform, setTransform] = useState(d3.zoomIdentity);

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

  /* ── Layout ───────────────────────────── */

  const layout = useMemo(
    () =>
      computeGraphLayout(filteredNodes, filteredLinks, containerSize.width, containerSize.height, {
        charge: -120,
        linkDistance: 80,
        cluster,
      }),
    [filteredNodes, filteredLinks, containerSize.width, containerSize.height, cluster],
  );

  /* Position lookup for edges */
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
        setContainerSize({
          width: Math.round(width),
          height: Math.round(height),
        });
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

    return () => {
      d3.select(svg).on('.zoom', null);
    };
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
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Apply zoom transform to canvas */
    ctx.setTransform(
      transform.k * dpr,
      0,
      0,
      transform.k * dpr,
      transform.x * dpr,
      transform.y * dpr,
    );

    const rc = rough.canvas(canvas);

    filteredLinks.forEach((l) => {
      const src = String(l.source);
      const tgt = String(l.target);
      const from = posMap.get(src);
      const to = posMap.get(tgt);
      if (!from || !to) return;

      let alpha = 0.25;
      if (hoveredId) {
        const isConnected = connectedIds.has(src) && connectedIds.has(tgt);
        alpha = isConnected ? 0.55 : 0.05;
      }

      rc.line(from.x, from.y, to.x, to.y, {
        roughness: 0.8,
        stroke: `rgba(${EDGE_RGB}, ${alpha})`,
        strokeWidth: 1.2,
        bowing: 1.5,
      });
    });
  }, [layout, filteredLinks, hoveredId, connectedIds, containerSize, posMap, transform]);

  /* ── Click handler ───────────────────────────── */

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setClickedId(nodeId);
      /* Brief pulse animation, then open */
      setTimeout(() => {
        setClickedId(null);
        onOpenObject?.(nodeId);
      }, 250);
    },
    [onOpenObject],
  );

  /* ── Legend ───────────────────────────── */

  const presentTypes = useMemo(() => {
    const types = new Set(layout.map((l) => l.node.objectType));
    return OBJECT_TYPES.filter((t) => types.has(t.slug));
  }, [layout]);

  /* ── Tooltip for hovered node ───────────────── */

  const hoveredNode = hoveredId ? posMap.get(hoveredId) : null;

  return (
    <div
      ref={containerRef}
      className="cp-graph-canvas"
      style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
    >
      {/* Canvas layer: rough.js edges */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />

      {/* SVG layer: interactive nodes */}
      <svg
        ref={svgRef}
        width={containerSize.width}
        height={containerSize.height}
        style={{ position: 'relative', zIndex: 1, cursor: 'grab' }}
        role="img"
        aria-label="Knowledge map showing object relationships"
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {layout.map(({ x, y, radius, node }) => {
            const dimmed = hoveredId !== null && !connectedIds.has(node.id);
            const pulsing = clickedId === node.id;
            const color = getNodeColor(node.objectType);
            const showLabel = alwaysShowLabels || hoveredId === node.id;

            return (
              <g
                key={node.id}
                style={{
                  cursor: 'pointer',
                  pointerEvents: 'all',
                  transition: 'opacity 200ms ease',
                }}
                opacity={dimmed ? 0.12 : 1}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleNodeClick(node.id)}
              >
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
                {/* Label: shown on hover or always for EntityNetwork */}
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
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip for hovered node */}
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
