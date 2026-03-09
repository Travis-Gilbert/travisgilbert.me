'use client';

/**
 * LiveResearchGraph: d3-zoom powered force-directed graph
 * showing a content item's research relationships (sources, backlinks).
 *
 * Features: scroll-wheel zoom, drag pan, touch pinch, zoom controls (+, -, reset).
 */

import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import type {
  ResearchTrailSource,
  ResearchTrailBacklink,
} from '@/lib/studio-api';

/* ── Types ───────────────────────────────────── */

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  kind: 'center' | 'source' | 'backlink';
  color: string;
  radius: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
}

interface LiveResearchGraphProps {
  title: string;
  sources: ResearchTrailSource[];
  backlinks: ResearchTrailBacklink[];
  accentColor?: string;
}

/* ── Colors ──────────────────────────────────── */

const SOURCE_COLOR = '#B45A2D';
const BACKLINK_COLOR = '#3A8A9A';
const LINK_COLOR = 'rgba(255, 255, 255, 0.08)';

/* ── Component ───────────────────────────────── */

export default function LiveResearchGraph({
  title,
  sources,
  backlinks,
  accentColor = '#D4AA4A',
}: LiveResearchGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const width = svg.clientWidth || 320;
    const height = svg.clientHeight || 240;

    /* Build node + link data */
    const nodes: GraphNode[] = [
      {
        id: 'center',
        label: title.length > 28 ? title.slice(0, 26) + '...' : title,
        kind: 'center',
        color: accentColor,
        radius: 18,
      },
    ];

    const links: GraphLink[] = [];

    sources.forEach((src) => {
      const nodeId = `src-${src.id}`;
      nodes.push({
        id: nodeId,
        label:
          src.title.length > 22 ? src.title.slice(0, 20) + '...' : src.title,
        kind: 'source',
        color: SOURCE_COLOR,
        radius: 10,
      });
      links.push({ id: `link-${nodeId}`, source: 'center', target: nodeId });
    });

    backlinks.forEach((bl) => {
      const nodeId = `bl-${bl.contentSlug}`;
      nodes.push({
        id: nodeId,
        label:
          bl.contentTitle.length > 22
            ? bl.contentTitle.slice(0, 20) + '...'
            : bl.contentTitle,
        kind: 'backlink',
        color: BACKLINK_COLOR,
        radius: 10,
      });
      links.push({ id: `link-${nodeId}`, source: 'center', target: nodeId });
    });

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

    /* Force simulation */
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(80),
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>().radius((d) => d.radius + 8));

    /* Links */
    const link = g
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', LINK_COLOR)
      .attr('stroke-width', 1.2);

    /* Nodes */
    const node = g
      .selectAll<SVGGElement, GraphNode>('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'grab');

    node
      .append('circle')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => d.color)
      .attr('fill-opacity', (d) => (d.kind === 'center' ? 0.85 : 0.55))
      .attr('stroke', (d) => d.color)
      .attr('stroke-opacity', 0.35)
      .attr('stroke-width', 1);

    node
      .append('text')
      .text((d) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 14)
      .attr('fill', 'var(--studio-text-3)')
      .attr('font-family', 'var(--studio-font-mono)')
      .attr('font-size', '8.5px')
      .attr('pointer-events', 'none');

    /* Drag */
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    /* Tick */
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x!)
        .attr('y1', (d) => (d.source as GraphNode).y!)
        .attr('x2', (d) => (d.target as GraphNode).x!)
        .attr('y2', (d) => (d.target as GraphNode).y!);

      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [title, sources, backlinks, accentColor]);

  /* Don't render if no data */
  if (sources.length === 0 && backlinks.length === 0) {
    return null;
  }

  return (
    <div className="studio-research-graph-container">
      <svg
        ref={svgRef}
        className="studio-research-graph-svg"
        style={{ width: '100%', height: 200, touchAction: 'none' }}
      />
      <div className="studio-research-graph-controls">
        <button type="button" onClick={zoomIn} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={zoomOut} aria-label="Zoom out">
          &minus;
        </button>
        <button type="button" onClick={resetZoom} aria-label="Reset zoom">
          &cir;
        </button>
      </div>
    </div>
  );
}
