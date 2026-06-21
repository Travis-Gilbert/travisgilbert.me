'use client';

/**
 * Cluster lens — the object plus its neighborhood in the graph, as a scoped
 * d3-force ego-graph (P2 / FR-020..022, SC-020).
 *
 * Neighbors are seeded by the object via gqlAsk (the unified retrieve), capped
 * at top-k — never the global graph (no fetchGraph). Nodes are typed, reusing
 * the object-type color from the object renderers; the source object is
 * centered and visually distinct; clicking a neighbor re-centers the ego-graph
 * on it (walks the graph in place).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { askObject, provenanceToNeighbors } from './lens-data';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import type { LensViewProps } from './lens-types';

const W = 640;
const H = 420;
const TOP_K = 12;

interface Seed { id: number; slug: string; title: string; type: string }

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  ref: number;
  slug: string;
  title: string;
  type: string;
  isCenter: boolean;
  score: number;
}
interface SimLink extends d3.SimulationLinkDatum<SimNode> { score: number }

export default function ClusterLens({ ctx }: LensViewProps) {
  const [seed, setSeed] = useState<Seed>({ id: ctx.objectRef, slug: ctx.objectSlug, title: ctx.objectTitle, type: ctx.objectType });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [, setFrame] = useState(0);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);

  useEffect(() => {
    setSeed({ id: ctx.objectRef, slug: ctx.objectSlug, title: ctx.objectTitle, type: ctx.objectType });
  }, [ctx.objectRef, ctx.objectSlug, ctx.objectTitle, ctx.objectType]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    askObject(seed.title, undefined, TOP_K)
      .then((result) => {
        if (cancelled) return;
        const neighbors = provenanceToNeighbors(result.provenance, seed.slug).slice(0, TOP_K);
        const center: SimNode = { id: seed.slug, ref: seed.id, slug: seed.slug, title: seed.title, type: seed.type, isCenter: true, score: 1, x: W / 2, y: H / 2, fx: W / 2, fy: H / 2 };
        const nodes: SimNode[] = [center, ...neighbors.map((n) => ({
          id: n.object.slug, ref: n.object.id, slug: n.object.slug,
          title: n.object.display_title ?? n.object.title, type: n.object.object_type_slug,
          isCenter: false, score: n.score,
          x: W / 2 + (Math.random() - 0.5) * 120, y: H / 2 + (Math.random() - 0.5) * 120,
        }))];
        const links: SimLink[] = neighbors.map((n) => ({ source: seed.slug, target: n.object.slug, score: n.score }));

        nodesRef.current = nodes;
        linksRef.current = links;
        simRef.current?.stop();
        const sim = d3.forceSimulation<SimNode>(nodes)
          .force('charge', d3.forceManyBody<SimNode>().strength(-220))
          .force('link', d3.forceLink<SimNode, SimLink>(links).id((d) => d.id).distance((l) => 70 + (1 - l.score) * 50).strength(0.6))
          .force('center', d3.forceCenter(W / 2, H / 2))
          .force('collide', d3.forceCollide<SimNode>(28))
          .on('tick', () => setFrame((f) => f + 1));
        simRef.current = sim;
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });

    return () => { cancelled = true; simRef.current?.stop(); };
  }, [seed]);

  const recenter = useCallback((n: SimNode) => {
    if (n.isCenter) return;
    setSeed({ id: n.ref, slug: n.slug, title: n.title, type: n.type });
  }, []);

  const nodes = nodesRef.current;
  const links = linksRef.current;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '8px 12px', fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-muted)', borderBottom: '1px solid var(--cp-border-faint)' }}>
        Centered on <span style={{ color: getObjectTypeIdentity(seed.type).color }}>{seed.title}</span>
        {status === 'ready' && ` · ${Math.max(0, nodes.length - 1)} neighbors`}
      </div>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {status === 'loading' && <Centered>mapping neighborhood…</Centered>}
        {status === 'error' && <Centered>Could not reach the engine.</Centered>}
        {status === 'ready' && nodes.length <= 1 && <Centered>No neighbors in the graph yet.</Centered>}
        {status === 'ready' && nodes.length > 1 && (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
            {links.map((l, i) => {
              const s = l.source as SimNode; const t = l.target as SimNode;
              return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="var(--cp-border)" strokeWidth={0.5 + l.score * 1.5} strokeOpacity={0.4 + l.score * 0.4} />;
            })}
            {nodes.map((n) => {
              const id = getObjectTypeIdentity(n.type);
              const r = n.isCenter ? 14 : 7 + n.score * 4;
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`} style={{ cursor: n.isCenter ? 'default' : 'pointer' }} onClick={() => recenter(n)}>
                  <circle r={r} fill={id.color} stroke={n.isCenter ? 'var(--cp-text)' : 'var(--cp-surface, #fff)'} strokeWidth={n.isCenter ? 2 : 1} />
                  <text x={0} y={r + 11} textAnchor="middle" style={{ fontFamily: 'var(--cp-font-body)', fontSize: n.isCenter ? 12 : 10, fontWeight: n.isCenter ? 600 : 400, fill: 'var(--cp-text)', pointerEvents: 'none' }}>
                    {n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cp-text-muted)', fontFamily: 'var(--cp-font-body)', fontSize: 12, fontStyle: 'italic' }}>
      {children}
    </div>
  );
}
