'use client';

/**
 * TimelineGraph: D3 force-directed connection graph for Studio.
 *
 * Two-layer rendering (mirrors KnowledgeMap.tsx and ConnectionMap.tsx):
 *   Canvas (behind): rough.js hand-drawn edges
 *   SVG (front): colored interactive nodes with hover/click
 *
 * Data source: Python connection engine via Django API (/connections/).
 * Force simulation runs synchronously (300 iterations) for instant layout.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import rough from 'roughjs';
import {
  fetchConnectionsGraph,
  type StudioConnectionsGraph,
} from '@/lib/studio-api';
import { getContentTypeIdentity, studioMix } from '@/lib/studio';

interface LayoutNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  stage: string;
  updatedAt: string;
  degree: number;
  radius: number;
  color: string;
}

interface LayoutEdge extends d3.SimulationLinkDatum<LayoutNode> {
  id: string;
  weight: number;
  reason: string;
}

function resolveNode(
  endpoint: string | number | LayoutNode,
  lookup: Map<string, LayoutNode>,
): LayoutNode | null {
  if (typeof endpoint === 'string' || typeof endpoint === 'number') {
    return lookup.get(String(endpoint)) ?? null;
  }
  return endpoint;
}

function buildLayout(
  graph: StudioConnectionsGraph,
  width: number,
  height: number,
): {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  lookup: Map<string, LayoutNode>;
} {
  const degreeByNode = new Map<string, number>();
  graph.edges.forEach((edge) => {
    degreeByNode.set(edge.source, (degreeByNode.get(edge.source) ?? 0) + 1);
    degreeByNode.set(edge.target, (degreeByNode.get(edge.target) ?? 0) + 1);
  });

  const maxDegree = Math.max(1, ...Array.from(degreeByNode.values()));

  const nodes: LayoutNode[] = graph.nodes.map((node) => {
    const degree = degreeByNode.get(node.id) ?? 0;
    const color = getContentTypeIdentity(node.contentType).color;
    return {
      id: node.id,
      title: node.title,
      slug: node.slug,
      contentType: node.contentType,
      stage: node.stage,
      updatedAt: node.updatedAt,
      degree,
      radius: 6 + (degree / maxDegree) * 11,
      color,
      x: width / 2,
      y: height / 2,
    };
  });

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));

  const edges: LayoutEdge[] = graph.edges
    .filter((edge) => nodeLookup.has(edge.source) && nodeLookup.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
      reason: edge.reason,
    }));

  const simulation = d3
    .forceSimulation<LayoutNode>(nodes)
    .force(
      'link',
      d3
        .forceLink<LayoutNode, LayoutEdge>(edges)
        .id((node) => node.id)
        .distance((edge) => 140 - Math.min(80, edge.weight * 8))
        .strength((edge) => 0.12 + Math.min(0.45, edge.weight * 0.04)),
    )
    .force('charge', d3.forceManyBody().strength(-360))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2).strength(0.03))
    .force('y', d3.forceY(height / 2).strength(0.03))
    .force('collision', d3.forceCollide<LayoutNode>().radius((node) => node.radius + 9))
    .stop();

  for (let i = 0; i < 300; i += 1) {
    simulation.tick();
  }

  nodes.forEach((node) => {
    const pad = node.radius + 24;
    node.x = Math.max(pad, Math.min(width - pad, node.x ?? width / 2));
    node.y = Math.max(pad, Math.min(height - pad, node.y ?? height / 2));
  });

  return { nodes, edges, lookup: nodeLookup };
}

export default function TimelineGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [width, setWidth] = useState(900);
  const [graph, setGraph] = useState<StudioConnectionsGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);

  const height = Math.max(900, Math.round(width * 1.05));

  /* Resize observer */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.round(entries[0].contentRect.width);
      if (nextWidth > 0) setWidth(nextWidth);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /* Fetch graph data from Python connection engine */
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void fetchConnectionsGraph({ limit: 60, maxEdges: 180 })
      .then((data) => {
        if (!active) return;
        setGraph(data);
        setSelectedId(data.nodes[0]?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        setError('Could not load graph data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /* Compute layout from graph + dimensions */
  const layout = useMemo(() => {
    if (!graph) return null;
    return buildLayout(graph, width, height);
  }, [graph, width, height]);

  /* D3 zoom behavior on SVG */
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3.5])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        setZoomTransform(event.transform);
      });

    const selection = d3.select(svgEl);
    selection.call(zoom);

    return () => {
      selection.on('.zoom', null);
    };
  }, []);

  const focusId = hoveredId ?? selectedId;

  const connectedIds = useMemo(() => {
    if (!focusId || !layout) return new Set<string>();

    const set = new Set<string>([focusId]);
    layout.edges.forEach((edge) => {
      const source =
        typeof edge.source === 'object' ? edge.source.id : String(edge.source);
      const target =
        typeof edge.target === 'object' ? edge.target.id : String(edge.target);
      if (source === focusId) set.add(target);
      if (target === focusId) set.add(source);
    });
    return set;
  }, [focusId, layout]);

  /* Draw rough.js edges on canvas */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout || layout.edges.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(
      zoomTransform.k * dpr,
      0,
      0,
      zoomTransform.k * dpr,
      zoomTransform.x * dpr,
      zoomTransform.y * dpr,
    );

    const rc = rough.canvas(canvas);

    layout.edges.forEach((edge) => {
      const source = resolveNode(edge.source, layout.lookup);
      const target = resolveNode(edge.target, layout.lookup);
      if (!source || !target || source.x == null || source.y == null || target.x == null || target.y == null) return;

      let alpha: number;
      if (focusId) {
        const isConnected = connectedIds.has(source.id) && connectedIds.has(target.id);
        alpha = isConnected ? 0.76 : 0.055;
      } else {
        alpha = 0.42;
      }

      rc.line(source.x, source.y, target.x, target.y, {
        roughness: 0.65,
        stroke: `rgba(196, 188, 176, ${alpha})`,
        strokeWidth: 0.85 + Math.min(2.8, edge.weight * 0.35),
        bowing: 1.4,
      });
    });
  }, [layout, focusId, connectedIds, width, height, zoomTransform]);

  const selectedNode = useMemo(() => {
    if (!layout || !selectedId) return null;
    return layout.lookup.get(selectedId) ?? null;
  }, [layout, selectedId]);

  const selectedLinks = useMemo(() => {
    if (!layout || !selectedId) return [] as Array<{ id: string; node: LayoutNode; reason: string }>;

    const rows: Array<{ id: string; node: LayoutNode; reason: string }> = [];
    layout.edges.forEach((edge) => {
      const source = resolveNode(edge.source, layout.lookup);
      const target = resolveNode(edge.target, layout.lookup);
      if (!source || !target) return;

      if (source.id === selectedId) {
        rows.push({ id: edge.id, node: target, reason: edge.reason });
      } else if (target.id === selectedId) {
        rows.push({ id: edge.id, node: source, reason: edge.reason });
      }
    });

    return rows.sort((a, b) => b.node.degree - a.node.degree).slice(0, 6);
  }, [layout, selectedId]);

  /* Unique content types present in graph for legend */
  const presentTypes = useMemo(() => {
    if (!layout) return [];
    const seen = new Set<string>();
    const types: Array<{ slug: string; label: string; color: string }> = [];
    layout.nodes.forEach((node) => {
      if (!seen.has(node.contentType)) {
        seen.add(node.contentType);
        const identity = getContentTypeIdentity(node.contentType);
        types.push({ slug: node.contentType, label: identity.label, color: identity.color });
      }
    });
    return types;
  }, [layout]);

  return (
    <div style={{ padding: '20px 40px 40px' }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: `${height}px`,
        }}
      >
        {loading && (
          <div
            style={{
              padding: '28px 24px',
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '11px',
              letterSpacing: '0.06em',
              color: 'var(--studio-text-3)',
            }}
          >
            LOADING GRAPH...
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: '28px 24px',
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '11px',
              color: '#A44A3A',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && layout && (
          <>
            {/* Canvas: rough.js edges (behind SVG) */}
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

            {/* SVG: interactive nodes (front) */}
            <svg
              ref={svgRef}
              width={width}
              height={height}
              style={{
                display: 'block',
                width: '100%',
                height: `${height}px`,
                position: 'relative',
                zIndex: 1,
                cursor: 'grab',
              }}
              aria-label="Content connection graph"
            >
              <g transform={zoomTransform.toString()}>
                {layout.nodes.map((node) => {
                  const dimmed = focusId ? !connectedIds.has(node.id) : false;
                  const isSelected = selectedId === node.id;
                  const isHovered = hoveredId === node.id;
                  const showLabel = isSelected || isHovered;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => setSelectedId(node.id)}
                    >
                      <circle
                        r={node.radius}
                        fill={studioMix(node.color, 44)}
                        stroke={node.color}
                        strokeWidth={isSelected ? 2.4 : isHovered ? 1.8 : 1.2}
                        opacity={dimmed ? 0.2 : 0.95}
                        style={{ transition: 'opacity 180ms ease, stroke-width 120ms ease' }}
                      />
                      {showLabel && (
                        <text
                          x={0}
                          y={node.radius + 13}
                          textAnchor="middle"
                          style={{
                            fontFamily: 'var(--studio-font-mono)',
                            fontSize: '9px',
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                            fill: 'var(--studio-text-2)',
                            pointerEvents: 'none',
                          }}
                          opacity={dimmed ? 0.3 : 0.88}
                        >
                          {node.title.length > 22
                            ? `${node.title.slice(0, 22)}\u2026`
                            : node.title}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Hint: top-right */}
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 14,
                zIndex: 5,
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '9px',
                letterSpacing: '0.06em',
                color: 'var(--studio-text-3)',
                pointerEvents: 'none',
              }}
            >
              SCROLL TO ZOOM · DRAG TO PAN · CLICK A NODE
            </div>

            {/* Legend: bottom-right */}
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                right: 14,
                zIndex: 5,
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
              }}
            >
              {presentTypes.map((t) => (
                <div
                  key={t.slug}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.06em',
                    color: 'var(--studio-text-3)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: t.color,
                      opacity: 0.75,
                      flexShrink: 0,
                    }}
                  />
                  {t.label}
                </div>
              ))}
            </div>

            {/* Selected node detail overlay: bottom-left */}
            {selectedNode && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  zIndex: 10,
                  width: 272,
                  backgroundColor: 'rgba(10, 11, 13, 0.92)',
                  border: '1px solid var(--studio-border)',
                  borderRadius: '8px',
                  padding: '12px 13px',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: 'var(--studio-font-title)',
                        fontSize: '15px',
                        color: 'var(--studio-text-bright)',
                        lineHeight: 1.25,
                        marginBottom: 3,
                      }}
                    >
                      {selectedNode.title}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--studio-font-mono)',
                        fontSize: '9px',
                        color: 'var(--studio-text-3)',
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {getContentTypeIdentity(selectedNode.contentType).label}
                      {selectedNode.stage ? ` · ${selectedNode.stage}` : ''}
                      {selectedNode.degree > 0 ? ` · ${selectedNode.degree} links` : ''}
                    </div>
                  </div>
                  <Link
                    href={`/studio/${getContentTypeIdentity(selectedNode.contentType).route}/${selectedNode.slug}`}
                    style={{
                      flexShrink: 0,
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      color: 'var(--studio-tc)',
                      textDecoration: 'none',
                      paddingTop: 2,
                    }}
                  >
                    OPEN
                  </Link>
                </div>

                {selectedLinks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {selectedLinks.map((linkRow) => {
                      const type = getContentTypeIdentity(linkRow.node.contentType);
                      return (
                        <button
                          key={linkRow.id}
                          onClick={() => setSelectedId(linkRow.node.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            padding: '5px 7px',
                            background: 'rgba(237, 231, 220, 0.03)',
                            border: '1px solid var(--studio-border)',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              backgroundColor: type.color,
                              flexShrink: 0,
                              opacity: 0.8,
                            }}
                          />
                          <span
                            style={{
                              fontFamily: 'var(--studio-font-body)',
                              fontSize: '11px',
                              color: 'var(--studio-text-2)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {linkRow.node.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p
                    style={{
                      margin: 0,
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '9px',
                      color: 'var(--studio-text-3)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    NO MAPPED CONNECTIONS
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
