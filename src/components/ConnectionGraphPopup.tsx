'use client';

/**
 * ConnectionGraphPopup: portal-based modal showing a mini D3 force graph
 * of all connections for the current essay.
 *
 * Rendering follows the same two-layer pattern as ConnectionMap:
 *   Canvas (behind): rough.js hand-drawn edges with signal-based encoding
 *   SVG (front): React-rendered interactive nodes
 *
 * Data is fetched client-side from the research API via useConnectionGraph.
 * Force layout uses the PRESET_COMPACT simulation preset (synchronous 300 ticks).
 *
 * Keyboard: Escape closes. Focus trapped inside modal (backdrop click closes).
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import rough from 'roughjs';
import { NODE_COLORS } from '@/lib/graph/colors';
import { scaleByScore, scaleByCount } from '@/lib/graph/radius';
import {
  runSynchronousSimulation,
  PRESET_COMPACT,
  type SimulationNode,
} from '@/lib/graph/simulation';
import { useConnectionGraph } from '@/lib/graph/useConnectionGraph';
import type { GraphNode, GraphEdge } from '@/lib/graph/connectionTransform';
import GraphTooltip, { buildSignalIndicators } from '@/components/GraphTooltip';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

interface ConnectionGraphPopupProps {
  essayTitle: string;
  essaySlug: string;
  onClose: () => void;
}

/** Extended simulation node carrying the original GraphNode data */
interface PopupNode extends SimulationNode {
  nodeData: GraphNode;
  isCenter: boolean;
}

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  essay: 'ESSAY',
  'field-note': 'FIELD NOTE',
  project: 'PROJECT',
  shelf: 'SHELF',
};

/** Fixed canvas dimensions. The popup is xl-only (ConnectionDots is hidden below xl). */
const GRAPH_W = 508;
const GRAPH_H = 320;

const RESEARCH_URL =
  process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? 'http://localhost:8001';

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function truncateTitle(str: string, maxLen = 20): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────

export default function ConnectionGraphPopup({
  essayTitle,
  essaySlug,
  onClose,
}: ConnectionGraphPopupProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const graphAreaRef = useRef<HTMLDivElement>(null);

  // Fetch connection data from research API
  const { nodes, edges, loading, error } = useConnectionGraph(essaySlug, essayTitle);

  useEffect(() => { setMounted(true); }, []);

  // Run force simulation
  const layout = useMemo(() => {
    if (nodes.length === 0) return [];

    const maxCount = Math.max(1, ...nodes.map((n) => n.connectionCount));
    const maxScore = Math.max(1, ...nodes.map((n) => n.totalScore));

    const simNodes: PopupNode[] = nodes.map((n, i) => ({
      id: n.id,
      radius: i === 0
        ? 15 // Center node: fixed prominent size
        : scaleByScore(n.totalScore, maxScore, 6, 12),
      connectionCount: n.connectionCount,
      nodeData: n,
      isCenter: i === 0,
      // Pin center node
      ...(i === 0 ? { fx: GRAPH_W / 2, fy: GRAPH_H / 2 } : {}),
    }));

    const simEdges = edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    runSynchronousSimulation(simNodes, simEdges, GRAPH_W, GRAPH_H, PRESET_COMPACT);

    return simNodes;
  }, [nodes, edges]);

  // Draw rough.js edges on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || layout.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = GRAPH_W * dpr;
    canvas.height = GRAPH_H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, GRAPH_W, GRAPH_H);

    const rc = rough.canvas(canvas);
    const posMap = new Map(
      layout.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]),
    );

    // Connected IDs for hover highlighting
    const connectedIds = new Set<string>();
    if (hoveredId) {
      connectedIds.add(hoveredId);
      edges.forEach((e) => {
        if (e.source === hoveredId) connectedIds.add(e.target);
        if (e.target === hoveredId) connectedIds.add(e.source);
      });
    }

    edges.forEach((e) => {
      const from = posMap.get(e.source);
      const to = posMap.get(e.target);
      if (!from || !to) return;

      let alpha = 0.4;
      if (hoveredId) {
        const isConnected =
          connectedIds.has(e.source) && connectedIds.has(e.target);
        alpha = isConnected ? 0.7 : 0.04;
      }

      rc.line(from.x, from.y, to.x, to.y, {
        roughness: e.roughness,
        stroke: hexToRgba(e.color, alpha),
        strokeWidth: e.strokeWidth,
        bowing: e.bowing,
      });
    });
  }, [layout, edges, hoveredId]);

  // Escape key to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleNodeClick = useCallback(
    (node: PopupNode) => {
      if (node.isCenter) return;
      onClose();
      router.push(node.nodeData.href);
    },
    [onClose, router],
  );

  // Connected IDs for node dimming (SVG render)
  const connectedIds = new Set<string>();
  if (hoveredId) {
    connectedIds.add(hoveredId);
    edges.forEach((e) => {
      if (e.source === hoveredId) connectedIds.add(e.target);
      if (e.target === hoveredId) connectedIds.add(e.source);
    });
  }

  // Tooltip data for hovered node
  const hoveredNode = hoveredId
    ? layout.find((n) => n.id === hoveredId)?.nodeData
    : null;

  const tooltipSignals = hoveredNode
    ? buildSignalIndicators(
        edges
          .filter((e) => e.source === hoveredId || e.target === hoveredId)
          .reduce(
            (acc, e) => {
              for (const [key, val] of Object.entries(e.signals)) {
                if (val && !acc[key]) acc[key] = val;
              }
              return acc;
            },
            {} as Record<string, { score: number; detail: string } | null>,
          ),
      )
    : [];

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

        {/* Graph area */}
        <div
          ref={graphAreaRef}
          style={{
            position: 'relative',
            width: GRAPH_W,
            height: GRAPH_H,
            margin: '0 auto',
          }}
        >
          {/* Loading state */}
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-ink-muted)',
              }}
            >
              Loading connections...
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-ink-muted)',
              }}
            >
              Could not load connections
            </div>
          )}

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
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          >
            {layout.map((simNode) => {
              const { nodeData: node } = simNode;
              const x = simNode.x ?? 0;
              const y = simNode.y ?? 0;
              const { radius } = simNode;
              const isHovered = hoveredId === node.id;
              const isDimmed = hoveredId !== null && !connectedIds.has(node.id);

              return (
                <g
                  key={node.id}
                  style={{
                    cursor: simNode.isCenter ? 'default' : 'pointer',
                    pointerEvents: 'all',
                    transition: 'opacity 200ms ease',
                  }}
                  opacity={isDimmed ? 0.15 : 1}
                  onMouseEnter={(e) => {
                    if (simNode.isCenter) return;
                    setHoveredId(node.id);
                    const rect = graphAreaRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltipPos({
                        x: e.clientX - rect.left,
                        y: y - radius - 12,
                      });
                    }
                  }}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleNodeClick(simNode)}
                  role={simNode.isCenter ? undefined : 'link'}
                  tabIndex={simNode.isCenter ? undefined : 0}
                  aria-label={
                    simNode.isCenter
                      ? undefined
                      : `${node.title} (${TYPE_LABELS[node.type]})`
                  }
                  onKeyDown={(e) => {
                    if (simNode.isCenter) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNodeClick(simNode);
                    }
                  }}
                >
                  {/* Main circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill={
                      simNode.isCenter
                        ? NODE_COLORS[node.type]
                        : `${NODE_COLORS[node.type]}20`
                    }
                    stroke={NODE_COLORS[node.type]}
                    strokeWidth={
                      simNode.isCenter ? 0 : isHovered ? 2 : 1.5
                    }
                    style={{ transition: 'stroke-width 150ms' }}
                  />

                  {/* Center node inner ring */}
                  {simNode.isCenter && (
                    <circle
                      cx={x}
                      cy={y}
                      r={radius - 4}
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth={1}
                    />
                  )}

                  {/* Type label above (connection nodes only) */}
                  {!simNode.isCenter && (
                    <text
                      x={x}
                      y={y - radius - 5}
                      textAnchor="middle"
                      fill={NODE_COLORS[node.type]}
                      style={{
                        fontFamily: 'var(--font-mono), monospace',
                        fontSize: 7,
                        fontWeight: 400,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        opacity: 0.6,
                      }}
                    >
                      {TYPE_LABELS[node.type] ?? ''}
                    </text>
                  )}

                  {/* Title label below */}
                  <text
                    x={x}
                    y={y + radius + 12}
                    textAnchor="middle"
                    fill={NODE_COLORS[node.type]}
                    style={{
                      fontFamily: 'var(--font-mono), monospace',
                      fontSize: simNode.isCenter ? 9 : 8,
                      fontWeight: simNode.isCenter ? 700 : isHovered ? 600 : 400,
                      letterSpacing: '0.04em',
                      transition: 'font-weight 100ms',
                    }}
                  >
                    {truncateTitle(node.title, simNode.isCenter ? 26 : 20)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          <GraphTooltip
            title={hoveredNode?.title ?? ''}
            subtitle={hoveredNode ? TYPE_LABELS[hoveredNode.type] : undefined}
            lines={
              hoveredNode
                ? [
                    ...(hoveredNode.score !== undefined
                      ? [`Score: ${hoveredNode.score.toFixed(2)}`]
                      : []),
                    ...(hoveredNode.explanation
                      ? [hoveredNode.explanation]
                      : []),
                  ]
                : undefined
            }
            signals={tooltipSignals}
            position={tooltipPos}
            visible={hoveredNode !== null}
          />
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
            {loading
              ? 'Loading...'
              : `${edges.length} connection${edges.length !== 1 ? 's' : ''}`}
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
