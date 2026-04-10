'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getClusters, getObject } from '@/lib/theseus-api';
import type { ClusterSummary, TheseusObject } from '@/lib/theseus-types';

interface GraphNode {
  id: string;
  label: string;
  type: 'cluster' | 'object';
  objectType?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

function typeColor(objectType: string): string {
  switch (objectType) {
    case 'source': return '#2D5F6B';
    case 'concept': return '#7B5EA7';
    case 'person': return '#C4503C';
    case 'hunch': return '#C49A4A';
    default: return '#9a958d';
  }
}

/** Simple force simulation tick (no d3-force dependency) */
function tickForce(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Center gravity
  for (const node of nodes) {
    node.vx += (width / 2 - node.x) * 0.001;
    node.vy += (height / 2 - node.y) * 0.001;
  }

  // Repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const minDist = a.radius + b.radius + 30;
      if (dist < minDist) {
        const force = (minDist - dist) / dist * 0.05;
        dx *= force;
        dy *= force;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }
  }

  // Edge attraction
  for (const edge of edges) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const idealDist = 80;
    const force = (dist - idealDist) / dist * 0.01;
    source.vx += dx * force;
    source.vy += dy * force;
    target.vx -= dx * force;
    target.vy -= dy * force;
  }

  // Apply velocity with damping
  for (const node of nodes) {
    node.vx *= 0.85;
    node.vy *= 0.85;
    node.x += node.vx;
    node.y += node.vy;
    // Bounds
    node.x = Math.max(node.radius + 20, Math.min(width - node.radius - 20, node.x));
    node.y = Math.max(node.radius + 20, Math.min(height - node.radius - 20, node.y));
  }
}

interface IdleGraphProps {
  onSelectNode: (nodeId: string) => void;
}

/**
 * IdleGraph: pre-query interactive cluster graph for the Explorer.
 *
 * Fetches clusters from the API, builds a force-directed layout
 * from cluster hubs and their top objects, renders as an interactive
 * SVG. Clicking a node opens the context panel.
 *
 * Hides itself when askState leaves IDLE (AskExperience takes over).
 */
export default function IdleGraph({ onSelectNode }: IdleGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const [ready, setReady] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  // Build graph from cluster data
  useEffect(() => {
    let cancelled = false;

    async function loadGraph() {
      const result = await getClusters();
      if (cancelled || !result.ok) return;

      const clusters = result.clusters.slice(0, 12); // Limit for performance
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const objectIds = new Set<string>();

      const svg = svgRef.current;
      const width = svg?.clientWidth ?? 800;
      const height = svg?.clientHeight ?? 600;

      // Create cluster hub nodes
      for (const cluster of clusters) {
        nodes.push({
          id: `cluster-${cluster.id}`,
          label: cluster.label.length > 20 ? cluster.label.slice(0, 18) + '\u2026' : cluster.label,
          type: 'cluster',
          x: width / 2 + (Math.random() - 0.5) * width * 0.6,
          y: height / 2 + (Math.random() - 0.5) * height * 0.6,
          vx: 0,
          vy: 0,
          radius: Math.min(8 + Math.sqrt(cluster.member_count) * 0.8, 20),
        });

        // Add top objects as connected nodes (max 3 per cluster)
        for (const objId of cluster.top_objects.slice(0, 3)) {
          if (!objectIds.has(objId)) {
            objectIds.add(objId);
            nodes.push({
              id: objId,
              label: '',
              type: 'object',
              x: width / 2 + (Math.random() - 0.5) * width * 0.6,
              y: height / 2 + (Math.random() - 0.5) * height * 0.6,
              vx: 0,
              vy: 0,
              radius: 5,
            });
          }
          edges.push({ source: `cluster-${cluster.id}`, target: objId });
        }
      }

      // Fetch object details for labels and types (batch, fire-and-forget for speed)
      const objNodes = nodes.filter((n) => n.type === 'object');
      const fetches = objNodes.slice(0, 30).map(async (node) => {
        const obj = await getObject(node.id);
        if (obj.ok) {
          node.label = obj.title.length > 16 ? obj.title.slice(0, 14) + '\u2026' : obj.title;
          node.objectType = obj.object_type;
        }
      });
      await Promise.allSettled(fetches);

      if (cancelled) return;

      nodesRef.current = nodes;
      edgesRef.current = edges;
      setReady(true);
    }

    loadGraph();
    return () => { cancelled = true; };
  }, []);

  // Run force simulation
  useEffect(() => {
    if (!ready) return;

    let ticks = 0;
    function animate() {
      const svg = svgRef.current;
      if (!svg) return;

      tickForce(nodesRef.current, edgesRef.current, svg.clientWidth, svg.clientHeight);
      ticks++;

      // Render every 2 ticks for performance, stop settling after 200
      if (ticks % 2 === 0) forceRender((n) => n + 1);
      if (ticks < 200) {
        animRef.current = requestAnimationFrame(animate);
      }
    }

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [ready]);

  const handleClick = useCallback((nodeId: string) => {
    // For cluster nodes, use the first top object
    if (nodeId.startsWith('cluster-')) {
      const clusterId = parseInt(nodeId.replace('cluster-', ''), 10);
      const edges = edgesRef.current.filter((e) => e.source === nodeId);
      if (edges.length > 0) {
        onSelectNode(edges[0].target);
        return;
      }
    }
    onSelectNode(nodeId);
  }, [onSelectNode]);

  const nodes = nodesRef.current;
  const edges = edgesRef.current;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      ref={svgRef}
      className="explorer-idle-graph"
      data-interactive
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
        pointerEvents: ready ? 'auto' : 'none',
        opacity: ready ? 1 : 0,
        transition: 'opacity 600ms ease',
      }}
    >
      {/* Edges */}
      {edges.map((edge, i) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;
        const isHovered = hoveredId === edge.source || hoveredId === edge.target;
        return (
          <line
            key={i}
            x1={source.x}
            y1={source.y}
            x2={target.x}
            y2={target.y}
            stroke={isHovered ? 'rgba(74, 138, 150, 0.3)' : 'rgba(255, 255, 255, 0.06)'}
            strokeWidth={isHovered ? 1.5 : 0.5}
            style={{ transition: 'stroke 200ms ease, stroke-width 200ms ease' }}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const isHovered = hoveredId === node.id;
        const isCluster = node.type === 'cluster';
        const color = isCluster ? '#4A8A96' : typeColor(node.objectType ?? 'note');
        const dimmed = hoveredId !== null && !isHovered
          && !edges.some((e) =>
            (e.source === hoveredId && e.target === node.id)
            || (e.target === hoveredId && e.source === node.id)
            || e.source === node.id && hoveredId === e.target
            || e.target === node.id && hoveredId === e.source,
          );

        return (
          <g
            key={node.id}
            style={{ cursor: 'pointer', opacity: dimmed ? 0.2 : 1, transition: 'opacity 200ms ease' }}
            onClick={() => handleClick(node.id)}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={isHovered ? node.radius + 2 : node.radius}
              fill={isCluster ? 'rgba(74, 138, 150, 0.15)' : `${color}22`}
              stroke={color}
              strokeWidth={isHovered ? 1.5 : 0.8}
              style={{ transition: 'r 150ms ease, stroke-width 150ms ease' }}
            />
            {/* Label (show on clusters always, objects on hover) */}
            {(isCluster || isHovered) && node.label && (
              <text
                x={node.x}
                y={node.y + node.radius + 12}
                textAnchor="middle"
                fill={isHovered ? '#e8e5e0' : '#9a958d'}
                fontSize={isCluster ? 10 : 9}
                fontFamily="'Courier Prime', monospace"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
