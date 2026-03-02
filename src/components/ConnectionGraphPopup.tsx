'use client';

/**
 * ConnectionGraphPopup: portal-based modal showing a mini D3 force graph
 * of all connections for the current essay.
 *
 * Rendering follows the same two-layer pattern as ConnectionMap:
 *   - Canvas (behind): rough.js hand-drawn edges
 *   - SVG (front): React-rendered interactive nodes
 *
 * Force layout is computed synchronously (300 ticks) so the graph
 * appears instantly with no animation jank. Same technique as ConnectionMap.
 *
 * Keyboard: Escape closes. Focus trapped inside modal (backdrop click closes).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import * as d3 from 'd3';
import rough from 'roughjs';
import type { Connection } from '@/lib/connectionEngine';

const RESEARCH_URL =
  process.env.NEXT_PUBLIC_RESEARCH_URL ?? 'https://research.travisgilbert.me';

const TYPE_URL: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

const TYPE_LABEL: Record<string, string> = {
  essay: 'Essay',
  'field-note': 'Field Note',
  shelf: 'Shelf',
};

/** Fixed canvas dimensions. The popup is xl-only (ConnectionDots is hidden below xl). */
const GRAPH_W = 508;
const GRAPH_H = 320;

// ─── D3 force layout (pure data, no DOM) ────────────────────────────────────

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  isCenter: boolean;
  connection?: Connection;
  radius: number;
  color: string;
}

interface SimEdge extends d3.SimulationLinkDatum<SimNode> {
  color: string;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  isCenter: boolean;
  connection?: Connection;
  color: string;
}

interface LayoutEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 2) + '...' : text;
}

function computeLayout(
  essaySlug: string,
  connections: Connection[],
  width: number,
  height: number,
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const centerId = `essay-${essaySlug}`;

  const centerSim: SimNode = {
    id: centerId,
    isCenter: true,
    radius: 15,
    color: '#B45A2D',
    x: width / 2,
    y: height / 2,
    fx: width / 2,
    fy: height / 2,
  };

  const connSim: SimNode[] = connections.map((c) => ({
    id: c.id,
    isCenter: false,
    connection: c,
    radius: c.weight === 'heavy' ? 11 : c.weight === 'medium' ? 9 : 7,
    color: c.color,
  }));

  const allNodes: SimNode[] = [centerSim, ...connSim];

  const links: SimEdge[] = connections.map((c) => ({
    source: centerId,
    target: c.id,
    color: c.color,
  }));

  const simulation = d3
    .forceSimulation<SimNode>(allNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, SimEdge>(links)
        .id((d) => d.id)
        .distance(110)
        .strength(0.7),
    )
    .force('charge', d3.forceManyBody<SimNode>().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2).strength(0.3))
    .force(
      'collision',
      d3.forceCollide<SimNode>().radius((d) => d.radius + 14),
    )
    .stop();

  for (let i = 0; i < 300; i++) simulation.tick();

  // Clamp nodes to canvas bounds
  const pad = 28;
  for (const n of allNodes) {
    n.x = Math.max(pad + n.radius, Math.min(width - pad - n.radius, n.x ?? width / 2));
    n.y = Math.max(pad + n.radius, Math.min(height - pad - n.radius, n.y ?? height / 2));
  }

  const nodeById = new Map(allNodes.map((n) => [n.id, n]));

  const edges: LayoutEdge[] = links.map((l) => {
    const sid = typeof l.source === 'string' ? l.source : (l.source as SimNode).id;
    const tid = typeof l.target === 'string' ? l.target : (l.target as SimNode).id;
    const s = nodeById.get(sid)!;
    const t = nodeById.get(tid)!;
    return { x1: s.x ?? 0, y1: s.y ?? 0, x2: t.x ?? 0, y2: t.y ?? 0, color: l.color };
  });

  const nodes: LayoutNode[] = allNodes.map((n) => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
    radius: n.radius,
    isCenter: n.isCenter,
    connection: n.connection,
    color: n.color,
  }));

  return { nodes, edges };
}

// ─── Component ──────────────────────────────────────────────────────────────

interface ConnectionGraphPopupProps {
  connections: Connection[];
  essayTitle: string;
  essaySlug: string;
  onClose: () => void;
}

export default function ConnectionGraphPopup({
  connections,
  essayTitle,
  essaySlug,
  onClose,
}: ConnectionGraphPopupProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Portal requires client-side mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Hover state for SVG nodes
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Compute layout once (connections are static, computed at build time)
  const [layout, setLayout] = useState<{ nodes: LayoutNode[]; edges: LayoutEdge[] } | null>(null);

  useEffect(() => {
    setLayout(computeLayout(essaySlug, connections, GRAPH_W, GRAPH_H));
  }, [connections, essaySlug]);

  // Draw rough.js edges on canvas after layout is ready
  useEffect(() => {
    if (!layout || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = GRAPH_W * dpr;
    canvas.height = GRAPH_H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, GRAPH_W, GRAPH_H);

    const rc = rough.canvas(canvas);
    for (const edge of layout.edges) {
      rc.line(edge.x1, edge.y1, edge.x2, edge.y2, {
        roughness: 1.3,
        bowing: 0.9,
        stroke: `${edge.color}55`,
        strokeWidth: 1.2,
      });
    }
  }, [layout]);

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleNodeClick = useCallback(
    (node: LayoutNode) => {
      if (node.isCenter || !node.connection) return;
      const prefix = TYPE_URL[node.connection.type] ?? '';
      onClose();
      router.push(`${prefix}/${node.connection.slug}`);
    },
    [onClose, router],
  );

  const researcherUrl = `${RESEARCH_URL}/paper-trail/essay-trail/${essaySlug}/`;

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Connection map for: ${essayTitle}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(14, 10, 14, 0.72)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal panel */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: 'var(--color-paper)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-warm), 0 8px 60px rgba(0,0,0,0.45)',
          width: `${GRAPH_W + 32}px`,
          maxWidth: '96vw',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '12px 16px 10px',
            borderBottom: '1px solid var(--color-border-light)',
          }}
        >
          <div>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-terracotta)',
                opacity: 0.8,
                marginBottom: 3,
              }}
            >
              Connection Map
            </span>
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-annotation)',
                fontSize: 14,
                color: 'var(--color-ink)',
                lineHeight: 1.25,
              }}
            >
              {essayTitle}
            </span>
          </div>
          <button
            autoFocus
            onClick={onClose}
            aria-label="Close connection map"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 4px',
              color: 'var(--color-ink-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              lineHeight: 1,
              marginLeft: 12,
              flexShrink: 0,
              opacity: 0.6,
              transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'; }}
          >
            &times;
          </button>
        </div>

        {/* Graph area: canvas (edges) + SVG (nodes) */}
        <div
          style={{
            position: 'relative',
            width: GRAPH_W,
            height: GRAPH_H,
            margin: '0 auto',
          }}
        >
          {/* Rough.js edge layer */}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: GRAPH_W,
              height: GRAPH_H,
              pointerEvents: 'none',
            }}
          />

          {/* Interactive node layer */}
          <svg
            width={GRAPH_W}
            height={GRAPH_H}
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {layout?.nodes.map((node) => {
              const isHovered = hoveredId === node.id;
              const isDimmed = hoveredId !== null && !isHovered && !node.isCenter;
              const title = node.isCenter
                ? essayTitle
                : (node.connection?.title ?? '');

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{
                    cursor: node.isCenter ? 'default' : 'pointer',
                    transition: 'opacity 150ms',
                    opacity: isDimmed ? 0.28 : 1,
                  }}
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => { if (!node.isCenter) setHoveredId(node.id); }}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Main circle */}
                  <circle
                    r={node.radius}
                    fill={node.isCenter ? node.color : `${node.color}20`}
                    stroke={node.color}
                    strokeWidth={node.isCenter ? 0 : isHovered ? 2 : 1.5}
                    style={{ transition: 'stroke-width 150ms' }}
                  />

                  {/* Center node inner ring for visual depth */}
                  {node.isCenter && (
                    <circle
                      r={node.radius - 4}
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth={1}
                    />
                  )}

                  {/* Type label above (connection nodes only) */}
                  {!node.isCenter && (
                    <text
                      y={-(node.radius + 5)}
                      textAnchor="middle"
                      fill={node.color}
                      fontFamily="var(--font-mono), monospace"
                      fontSize={7}
                      fontWeight="400"
                      letterSpacing="0.08em"
                      style={{ opacity: 0.6, textTransform: 'uppercase' }}
                    >
                      {TYPE_LABEL[node.connection!.type]?.toUpperCase() ?? ''}
                    </text>
                  )}

                  {/* Title label below */}
                  <text
                    y={node.radius + 12}
                    textAnchor="middle"
                    fill={node.color}
                    fontFamily="var(--font-mono), monospace"
                    fontSize={node.isCenter ? 9 : 8}
                    fontWeight={node.isCenter ? '700' : isHovered ? '600' : '400'}
                    letterSpacing="0.04em"
                    style={{ transition: 'font-weight 100ms' }}
                  >
                    {truncate(title, node.isCenter ? 26 : 20)}
                  </text>

                  {/* Hover: secondary line with full title if truncated */}
                  {isHovered && title.length > 20 && (
                    <text
                      y={node.radius + 22}
                      textAnchor="middle"
                      fill={node.color}
                      fontFamily="var(--font-mono), monospace"
                      fontSize={8}
                      letterSpacing="0.03em"
                      style={{ opacity: 0.6 }}
                    >
                      {truncate(title.slice(18), 20)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderTop: '1px solid var(--color-border-light)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--color-ink-muted)',
            }}
          >
            {connections.length} connection{connections.length !== 1 ? 's' : ''}
          </span>
          <a
            href={researcherUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--color-terracotta)',
              opacity: 0.7,
              textDecoration: 'none',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.7'; }}
          >
            Explore full trail in Researcher &rarr;
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
