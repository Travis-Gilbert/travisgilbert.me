'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as d3 from 'd3';
import {
  fetchConnectionsGraph,
  type StudioConnectionsGraph,
} from '@/lib/studio-api';
import { getContentTypeIdentity, studioMix } from '@/lib/studio';
import SectionLabel from '../SectionLabel';

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

  const maxDegree = Math.max(1, ...Array.from(degreeByNode.values(), (d) => d));

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
      radius: 7 + (degree / maxDegree) * 13,
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
        .distance((edge) => 150 - Math.min(90, edge.weight * 10))
        .strength((edge) => 0.15 + Math.min(0.5, edge.weight * 0.05)),
    )
    .force('charge', d3.forceManyBody().strength(-260))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x', d3.forceX(width / 2).strength(0.04))
    .force('y', d3.forceY(height / 2).strength(0.04))
    .force('collision', d3.forceCollide<LayoutNode>().radius((node) => node.radius + 7))
    .stop();

  for (let i = 0; i < 320; i += 1) {
    simulation.tick();
  }

  nodes.forEach((node) => {
    const radius = node.radius + 20;
    node.x = Math.max(radius, Math.min(width - radius, node.x ?? width / 2));
    node.y = Math.max(radius, Math.min(height - radius, node.y ?? height / 2));
  });

  return { nodes, edges, lookup: nodeLookup };
}

export default function TimelineGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [width, setWidth] = useState(900);
  const [graph, setGraph] = useState<StudioConnectionsGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(
    d3.zoomIdentity,
  );

  const height = Math.max(560, Math.round(width * 0.65));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.round(entries[0].contentRect.width);
      if (nextWidth > 0) {
        setWidth(nextWidth);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void fetchConnectionsGraph({ limit: 90, maxEdges: 260 })
      .then((data) => {
        if (!active) {
          return;
        }
        setGraph(data);
        setSelectedId(data.nodes[0]?.id ?? null);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setError('Could not load graph data from Django API.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const layout = useMemo(() => {
    if (!graph) {
      return null;
    }
    return buildLayout(graph, width, height);
  }, [graph, width, height]);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) {
      return;
    }

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 3])
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
    if (!focusId || !layout) {
      return new Set<string>();
    }

    const set = new Set<string>([focusId]);
    layout.edges.forEach((edge) => {
      const source =
        typeof edge.source === 'object' ? edge.source.id : String(edge.source);
      const target =
        typeof edge.target === 'object' ? edge.target.id : String(edge.target);
      if (source === focusId) {
        set.add(target);
      }
      if (target === focusId) {
        set.add(source);
      }
    });
    return set;
  }, [focusId, layout]);

  const selectedNode = useMemo(() => {
    if (!layout || !selectedId) {
      return null;
    }
    return layout.lookup.get(selectedId) ?? null;
  }, [layout, selectedId]);

  const selectedLinks = useMemo(() => {
    if (!layout || !selectedId) {
      return [] as Array<{ id: string; node: LayoutNode; reason: string }>;
    }

    const rows: Array<{ id: string; node: LayoutNode; reason: string }> = [];
    layout.edges.forEach((edge) => {
      const source = resolveNode(edge.source, layout.lookup);
      const target = resolveNode(edge.target, layout.lookup);
      if (!source || !target) {
        return;
      }

      if (source.id === selectedId) {
        rows.push({ id: edge.id, node: target, reason: edge.reason });
      } else if (target.id === selectedId) {
        rows.push({ id: edge.id, node: source, reason: edge.reason });
      }
    });

    return rows.slice(0, 8);
  }, [layout, selectedId]);

  return (
    <div style={{ padding: '32px 40px' }}>
      <SectionLabel variant="studio" hexColor="#8A6A9A">
        TIMELINE GRAPH
      </SectionLabel>

      <p
        style={{
          margin: '8px 0 12px',
          fontFamily: 'var(--studio-font-body)',
          fontSize: '13px',
          color: 'var(--studio-text-2)',
          lineHeight: 1.45,
        }}
      >
        Scroll to zoom. Drag to pan. Click a node to inspect connections.
      </p>

      <div
        ref={containerRef}
        style={{
          border: '1px solid var(--studio-border)',
          borderRadius: '10px',
          background: 'rgba(26, 28, 30, 0.86)',
          minHeight: '560px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {loading && (
          <p
            style={{
              margin: '20px',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '13px',
              color: 'var(--studio-text-3)',
            }}
          >
            Loading graph...
          </p>
        )}

        {!loading && error && (
          <p
            style={{
              margin: '20px',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '13px',
              color: '#A44A3A',
            }}
          >
            {error}
          </p>
        )}

        {!loading && !error && layout && (
          <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{ display: 'block', width: '100%', height: `${height}px` }}
            aria-label="Timeline connection graph"
          >
            <g transform={zoomTransform.toString()}>
              {layout.edges.map((edge) => {
                const source = resolveNode(edge.source, layout.lookup);
                const target = resolveNode(edge.target, layout.lookup);
                if (!source || !target) {
                  return null;
                }

                const edgeDimmed = focusId && !(connectedIds.has(source.id) && connectedIds.has(target.id));
                return (
                  <line
                    key={edge.id}
                    x1={source.x ?? 0}
                    y1={source.y ?? 0}
                    x2={target.x ?? 0}
                    y2={target.y ?? 0}
                    stroke={studioMix('#C4BCB0', 42)}
                    strokeWidth={1 + Math.min(3.5, edge.weight * 0.45)}
                    opacity={edgeDimmed ? 0.1 : 0.42}
                  />
                );
              })}

              {layout.nodes.map((node) => {
                const dimmed = focusId ? !connectedIds.has(node.id) : false;
                const isSelected = selectedId === node.id;
                const showLabel = isSelected || (hoveredId === node.id) || node.degree >= 3;

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
                      fill={studioMix(node.color, 28)}
                      stroke={node.color}
                      strokeWidth={isSelected ? 2.2 : 1.3}
                      opacity={dimmed ? 0.2 : 0.95}
                    />
                    {showLabel && (
                      <text
                        x={0}
                        y={node.radius + 12}
                        textAnchor="middle"
                        style={{
                          fontFamily: 'var(--studio-font-mono)',
                          fontSize: '9px',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          fill: 'var(--studio-text-2)',
                          pointerEvents: 'none',
                        }}
                        opacity={dimmed ? 0.4 : 0.9}
                      >
                        {node.title.length > 20 ? `${node.title.slice(0, 20)}...` : node.title}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {!loading && !error && selectedNode && (
        <div
          style={{
            marginTop: '12px',
            border: '1px solid var(--studio-border)',
            borderRadius: '8px',
            backgroundColor: 'var(--studio-surface)',
            padding: '12px 14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              marginBottom: '8px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--studio-font-title)',
                  fontSize: '20px',
                  color: 'var(--studio-text-bright)',
                  lineHeight: 1.2,
                }}
              >
                {selectedNode.title}
              </div>
              <div
                style={{
                  marginTop: '3px',
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '9px',
                  color: 'var(--studio-text-3)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {getContentTypeIdentity(selectedNode.contentType).label} · {selectedNode.stage}
              </div>
            </div>

            <Link
              href={`/studio/${getContentTypeIdentity(selectedNode.contentType).route}/${selectedNode.slug}`}
              style={{
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--studio-tc)',
                textDecoration: 'none',
              }}
            >
              Open in editor
            </Link>
          </div>

          {selectedLinks.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedLinks.map((linkRow) => {
                const type = getContentTypeIdentity(linkRow.node.contentType);
                return (
                  <div
                    key={linkRow.id}
                    style={{
                      border: '1px solid var(--studio-border)',
                      borderRadius: '6px',
                      padding: '7px 9px',
                      backgroundColor: 'rgba(237, 231, 220, 0.02)',
                    }}
                  >
                    <Link
                      href={`/studio/${type.route}/${linkRow.node.slug}`}
                      style={{
                        fontFamily: 'var(--studio-font-title)',
                        fontSize: '15px',
                        color: 'var(--studio-text-bright)',
                        textDecoration: 'none',
                      }}
                    >
                      {linkRow.node.title}
                    </Link>
                    <div
                      style={{
                        marginTop: '3px',
                        fontFamily: 'var(--studio-font-body)',
                        fontSize: '12px',
                        color: 'var(--studio-text-3)',
                        lineHeight: 1.4,
                      }}
                    >
                      {linkRow.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--studio-font-body)',
                fontSize: '12px',
                color: 'var(--studio-text-3)',
                fontStyle: 'italic',
              }}
            >
              This node currently has no mapped connections.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
