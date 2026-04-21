/**
 * ConceptMap — inline small-graph renderer for `diagram` answer_type.
 *
 * Reads `visual.structured.nodes: Array<{ id, label, weight?, linked_evidence? }>`
 * and `visual.structured.edges: Array<{ from, to, label? }>`.
 *
 * Uses a deterministic radial layout rather than a force simulation so
 * the map is stable across re-renders and SSR-safe (no Math.random).
 * For a richer layout, route through d3-pro in a follow-up.
 */

'use client';

import type { FC } from 'react';
import { useMemo } from 'react';
import type { StructuredVisual, StructuredVisualRegion } from '@/lib/theseus-types';

interface ConceptNode {
  id: string;
  label: string;
  weight: number;
  linked_evidence?: string[];
}

interface ConceptEdge {
  from: string;
  to: string;
  label?: string;
}

interface ConceptMapProps {
  visual: StructuredVisual;
  onRegionHover?: (region: StructuredVisualRegion | null) => void;
  onRegionSelect?: (region: StructuredVisualRegion) => void;
}

function readNodes(visual: StructuredVisual): ConceptNode[] {
  const raw = visual.structured?.nodes;
  if (!Array.isArray(raw)) return [];
  const nodes: ConceptNode[] = [];
  for (const n of raw) {
    if (!n || typeof n !== 'object') continue;
    const rec = n as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : '';
    const label = typeof rec.label === 'string' ? rec.label : '';
    if (!id || !label) continue;
    const weight = typeof rec.weight === 'number' ? Math.max(0, Math.min(1, rec.weight)) : 0.5;
    const linked = Array.isArray(rec.linked_evidence) ? rec.linked_evidence.map(String) : undefined;
    nodes.push({ id, label, weight, linked_evidence: linked });
  }
  return nodes;
}

function readEdges(visual: StructuredVisual): ConceptEdge[] {
  const raw = visual.structured?.edges;
  if (!Array.isArray(raw)) return [];
  const edges: ConceptEdge[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const rec = e as Record<string, unknown>;
    const from = typeof rec.from === 'string' ? rec.from : '';
    const to = typeof rec.to === 'string' ? rec.to : '';
    if (!from || !to) continue;
    const label = typeof rec.label === 'string' ? rec.label : undefined;
    edges.push({ from, to, label });
  }
  return edges;
}

const VIEWBOX = 400;
const CENTER = VIEWBOX / 2;

const ConceptMap: FC<ConceptMapProps> = ({ visual, onRegionHover }) => {
  const nodes = useMemo(() => readNodes(visual), [visual]);
  const edges = useMemo(() => readEdges(visual), [visual]);

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (nodes.length === 0) return map;
    // First node sits at the center; remaining distribute on a circle.
    // Radius scales with the number of nodes so labels don't collide.
    map.set(nodes[0].id, { x: CENTER, y: CENTER });
    const ring = nodes.slice(1);
    const radius = Math.min(140, 60 + ring.length * 8);
    ring.forEach((node, i) => {
      const theta = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
      map.set(node.id, {
        x: CENTER + Math.cos(theta) * radius,
        y: CENTER + Math.sin(theta) * radius,
      });
    });
    return map;
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--color-paper, #fdfbf6)',
        border: '1px solid color-mix(in srgb, var(--color-ink) 12%, transparent)',
        borderRadius: 6,
        padding: 12,
        boxShadow: 'var(--shadow-warm-sm)',
      }}
    >
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} width="100%" role="img" aria-label="Concept map">
        {edges.map((edge, i) => {
          const a = positions.get(edge.from);
          const b = positions.get(edge.to);
          if (!a || !b) return null;
          return (
            <g key={`e${i}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="color-mix(in srgb, var(--color-ink) 30%, transparent)"
                strokeWidth={1.2}
              />
              {edge.label && (
                <text
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2 - 2}
                  textAnchor="middle"
                  fontSize={8}
                  fontFamily="var(--font-metadata)"
                  fill="var(--color-ink-muted)"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((node) => {
          const p = positions.get(node.id);
          if (!p) return null;
          const r = 6 + node.weight * 6;
          const hasLinked = node.linked_evidence && node.linked_evidence.length > 0;
          return (
            <g
              key={node.id}
              onMouseEnter={() => {
                if (!onRegionHover || !hasLinked) return;
                onRegionHover({
                  id: node.id,
                  label: node.label,
                  x: p.x,
                  y: p.y,
                  width: r * 2,
                  height: r * 2,
                  linked_evidence: node.linked_evidence,
                });
              }}
              onMouseLeave={() => onRegionHover?.(null)}
              style={{ cursor: hasLinked ? 'pointer' : 'default' }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill="var(--color-terracotta, #B45A2D)"
                stroke="var(--color-paper, #fdfbf6)"
                strokeWidth={2}
                opacity={0.8 + node.weight * 0.2}
              />
              <text
                x={p.x}
                y={p.y + r + 12}
                textAnchor="middle"
                fontSize={10}
                fontFamily="var(--font-body)"
                fill="var(--color-ink)"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default ConceptMap;
