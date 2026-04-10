'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface GraphNode {
  id: string;
  label: string;
  objectType: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isNew?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
}

export interface RelatedObject {
  id: string;
  title: string;
  objectType: string;
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

/**
 * Simple force simulation tick. Forked from IdleGraph.tsx.
 * Same physics: center gravity, node repulsion, edge attraction, velocity damping.
 */
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
    const idealDist = 60;
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
    node.x = Math.max(node.radius + 10, Math.min(width - node.radius - 10, node.x));
    node.y = Math.max(node.radius + 10, Math.min(height - node.radius - 10, node.y));
  }
}

interface NotebookGraphProps {
  relatedObjects: RelatedObject[];
}

/**
 * NotebookGraph: scoped reactive graph for the notebook workbench.
 *
 * Forked from IdleGraph. Instead of fetching clusters on mount, it
 * receives a relatedObjects prop that updates reactively as the user
 * types. Limited to 20-30 nodes. New connections pulse teal briefly.
 */
export default function NotebookGraph({ relatedObjects }: NotebookGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Rebuild graph when relatedObjects changes
  useEffect(() => {
    const svg = svgRef.current;
    const width = svg?.clientWidth ?? 300;
    const height = svg?.clientHeight ?? 300;
    const prevIds = prevIdsRef.current;

    const limited = relatedObjects.slice(0, 25);
    const newIds = new Set(limited.map((o) => o.id));

    // Preserve positions of existing nodes
    const existingMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    const nodes: GraphNode[] = limited.map((obj) => {
      const existing = existingMap.get(obj.id);
      return {
        id: obj.id,
        label: obj.title.length > 18 ? obj.title.slice(0, 16) + '\u2026' : obj.title,
        objectType: obj.objectType,
        x: existing?.x ?? width / 2 + (Math.random() - 0.5) * width * 0.6,
        y: existing?.y ?? height / 2 + (Math.random() - 0.5) * height * 0.6,
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        radius: 5,
        isNew: !prevIds.has(obj.id),
      };
    });

    // Simple edges: connect each node to the first node (star layout)
    const edges: GraphEdge[] = [];
    if (nodes.length > 1) {
      for (let i = 1; i < nodes.length; i++) {
        edges.push({ source: nodes[0].id, target: nodes[i].id });
      }
    }

    nodesRef.current = nodes;
    edgesRef.current = edges;
    prevIdsRef.current = newIds;

    // Clear isNew flag after pulse animation
    const timer = setTimeout(() => {
      for (const node of nodesRef.current) {
        node.isNew = false;
      }
      forceRender((n) => n + 1);
    }, 600);

    return () => clearTimeout(timer);
  }, [relatedObjects]);

  // Run force simulation
  useEffect(() => {
    let ticks = 0;
    function animate() {
      const svg = svgRef.current;
      if (!svg || nodesRef.current.length === 0) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      tickForce(nodesRef.current, edgesRef.current, svg.clientWidth, svg.clientHeight);
      ticks++;
      if (ticks % 2 === 0) forceRender((n) => n + 1);
      if (ticks < 300) {
        animRef.current = requestAnimationFrame(animate);
      }
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [relatedObjects]);

  const nodes = nodesRef.current;
  const edges = edgesRef.current;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  if (relatedObjects.length === 0) {
    return (
      <div className="notebook-graph-empty">
        <p className="notebook-tab-desc">
          Start writing to see related objects from your knowledge graph.
        </p>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: '100%', minHeight: 200 }}
    >
      {/* Edges */}
      {edges.map((edge, i) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;
        return (
          <line
            key={i}
            x1={source.x} y1={source.y}
            x2={target.x} y2={target.y}
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const isHovered = hoveredId === node.id;
        const color = typeColor(node.objectType);
        return (
          <g
            key={node.id}
            style={{ cursor: 'default' }}
            onMouseEnter={() => setHoveredId(node.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* New node pulse */}
            {node.isNew && (
              <circle
                cx={node.x} cy={node.y}
                r={node.radius + 6}
                fill="none"
                stroke="rgba(74, 138, 150, 0.5)"
                strokeWidth={2}
                className="notebook-graph-pulse"
              />
            )}
            <circle
              cx={node.x} cy={node.y}
              r={isHovered ? node.radius + 2 : node.radius}
              fill={`${color}22`}
              stroke={color}
              strokeWidth={isHovered ? 1.5 : 0.8}
            />
            {(isHovered || nodes.length <= 10) && node.label && (
              <text
                x={node.x} y={node.y + node.radius + 10}
                textAnchor="middle"
                fill={isHovered ? '#e8e5e0' : '#9a958d'}
                fontSize={9}
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
