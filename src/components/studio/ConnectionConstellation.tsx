'use client';

/**
 * ConnectionConstellation: D3 force-directed graph showing a draft's
 * discovered connections as a constellation radiating from the center node.
 *
 * Uses runSynchronousSimulation for instant layout (no animation jank),
 * then renders SVG with d3-zoom for pan/zoom interaction.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import {
  runSynchronousSimulation,
  type SimulationNode,
} from '@/lib/graph/simulation';
import { getContentTypeIdentity } from '@/lib/studio';
import type { DraftAnalysisResult } from '@/lib/studio-api';

/* ── Types ─────────────────────────────────────── */

interface ConstellationNode extends SimulationNode {
  label: string;
  color: string;
  isDraft: boolean;
  /** Original type:slug identifier for navigation */
  rawId: string;
}

interface ConstellationEdge extends d3.SimulationLinkDatum<ConstellationNode> {
  weight: number;
}

interface ConnectionConstellationProps {
  analysis: DraftAnalysisResult | null;
  draftTitle: string;
  contentType: string;
  onNavigate?: (type: string, slug: string) => void;
}

/* ── Helpers ────────────────────────────────────── */

const SIMULATION_OVERRIDES = {
  chargeStrength: -200,
  linkDistance: 80,
  collisionPadding: 8,
  iterations: 300,
  boundaryPadding: 20,
};

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '\u2026';
}

/* ── Component ──────────────────────────────────── */

export default function ConnectionConstellation({
  analysis,
  draftTitle,
  contentType,
  onNavigate,
}: ConnectionConstellationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  /* ── Responsive sizing via ResizeObserver ───── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* ── Zoom controls ─────────────────────────── */
  const resetZoom = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    d3.select(svg)
      .transition()
      .duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  const zoomIn = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    d3.select(svg)
      .transition()
      .duration(250)
      .call(zoomRef.current.scaleBy, 1.4);
  }, []);

  const zoomOut = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    d3.select(svg)
      .transition()
      .duration(250)
      .call(zoomRef.current.scaleBy, 1 / 1.4);
  }, []);

  /* ── D3 rendering ──────────────────────────── */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.width < 1 || size.height < 1 || !analysis) return;

    const { width, height } = size;
    const { graph } = analysis;

    if (!graph || graph.nodes.length === 0) return;

    /* Build simulation nodes */
    const draftColor = getContentTypeIdentity(contentType).color;

    const simNodes: ConstellationNode[] = graph.nodes.map((n) => {
      const isDraft = !!n.isDraft;
      const nodeRadius = isDraft ? 16 : Math.max(6, (n.score ?? 0.5) * 14);
      const color = isDraft
        ? draftColor
        : getContentTypeIdentity(n.type).color;
      return {
        id: n.id,
        radius: nodeRadius,
        label: truncate(n.label, 18),
        color,
        isDraft,
        rawId: n.id,
        connectionCount: 0,
      };
    });

    /* Count connections per node */
    for (const e of graph.edges) {
      const src = simNodes.find((n) => n.id === e.source);
      const tgt = simNodes.find((n) => n.id === e.target);
      if (src) src.connectionCount = (src.connectionCount ?? 0) + 1;
      if (tgt) tgt.connectionCount = (tgt.connectionCount ?? 0) + 1;
    }

    const simEdges: ConstellationEdge[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));

    /* Run synchronous simulation */
    runSynchronousSimulation(
      simNodes,
      simEdges,
      width,
      height,
      { ...SIMULATION_OVERRIDES, linkDistance: 80, chargeStrength: -200,
        collisionPadding: 8, iterations: 300, boundaryPadding: 20 },
    );

    /* Clear previous render */
    const svgSelection = d3.select(svg);
    svgSelection.selectAll('*').remove();

    /* Container group that receives zoom transforms */
    const g = svgSelection.append('g');

    /* Zoom behavior */
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svgSelection.call(zoom);
    zoomRef.current = zoom;

    /* Defs: glow filter for draft node */
    const defs = svgSelection.append('defs');
    const filter = defs.append('filter').attr('id', 'constellation-glow');
    filter
      .append('feGaussianBlur')
      .attr('stdDeviation', 4)
      .attr('result', 'blur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    /* Edges */
    g.selectAll<SVGLineElement, ConstellationEdge>('line.edge')
      .data(simEdges)
      .join('line')
      .attr('class', 'edge')
      .attr('x1', (d) => (d.source as ConstellationNode).x!)
      .attr('y1', (d) => (d.source as ConstellationNode).y!)
      .attr('x2', (d) => (d.target as ConstellationNode).x!)
      .attr('y2', (d) => (d.target as ConstellationNode).y!)
      .attr('stroke', 'rgba(255, 255, 255, 0.12)')
      .attr('stroke-width', (d) => Math.max(0.5, d.weight * 3))
      .attr('stroke-opacity', (d) => Math.max(0.15, d.weight * 0.8));

    /* Node groups */
    const nodeGroup = g
      .selectAll<SVGGElement, ConstellationNode>('g.cnode')
      .data(simNodes)
      .join('g')
      .attr('class', 'cnode')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', (d) => (d.isDraft ? 'default' : 'pointer'));

    /* Glow ring for draft node */
    nodeGroup
      .filter((d) => d.isDraft)
      .append('circle')
      .attr('r', (d) => d.radius + 4)
      .attr('fill', 'none')
      .attr('stroke', draftColor)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 2)
      .attr('filter', 'url(#constellation-glow)');

    /* Node circles */
    nodeGroup
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', (d) => (d.isDraft ? 0.9 : 0.6))
      .attr('stroke', (d) => d.color)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1);

    /* Labels on nodes with radius > 8 */
    nodeGroup
      .filter((d) => d.radius > 8)
      .append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 13)
      .attr('fill', 'var(--studio-text-3)')
      .attr('font-family', 'var(--studio-font-mono)')
      .attr('font-size', '8px')
      .attr('pointer-events', 'none');

    /* Click handler for non-draft nodes */
    nodeGroup
      .filter((d) => !d.isDraft)
      .on('click', (_event, d) => {
        if (!onNavigate) return;
        const parts = d.rawId.split(':');
        if (parts.length === 2) {
          onNavigate(parts[0], parts[1]);
        }
      });
  }, [analysis, draftTitle, contentType, size, onNavigate]);

  /* ── Derived counts ────────────────────────── */
  const connectionCount = analysis?.connections?.length ?? 0;
  const entityCount = analysis?.entities?.length ?? 0;

  /* ── Empty state ───────────────────────────── */
  if (!analysis) {
    return (
      <div
        style={{
          padding: '24px 16px',
          textAlign: 'center',
          color: 'var(--studio-text-3)',
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '11px',
        }}
      >
        Save your draft to discover connections.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, position: 'relative' }}
      >
        <svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          style={{ display: 'block', touchAction: 'none' }}
        />
        {size.width > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 6,
              display: 'flex',
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={zoomIn}
              aria-label="Zoom in"
              style={{
                width: 22,
                height: 22,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--studio-text-3)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              +
            </button>
            <button
              type="button"
              onClick={zoomOut}
              aria-label="Zoom out"
              style={{
                width: 22,
                height: 22,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--studio-text-3)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &#x2212;
            </button>
            <button
              type="button"
              onClick={resetZoom}
              aria-label="Reset zoom"
              style={{
                width: 22,
                height: 22,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--studio-text-3)',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              &#x25CB;
            </button>
          </div>
        )}
      </div>
      <div
        style={{
          padding: '6px 12px',
          fontSize: '10px',
          fontFamily: 'var(--studio-font-mono)',
          color: 'var(--studio-text-3)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          gap: 12,
        }}
      >
        <span>{connectionCount} connection{connectionCount !== 1 ? 's' : ''}</span>
        <span>{entityCount} entit{entityCount !== 1 ? 'ies' : 'y'}</span>
      </div>
    </div>
  );
}
