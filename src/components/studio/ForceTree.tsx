'use client';

/**
 * ForceTree: reusable D3 force-directed tree visualization.
 * Renders hierarchical data as a physics-based node-link diagram
 * with color-coded depth, zoom/pan, and draggable nodes.
 *
 * Used by Studio (research relationships) and CommonPlace (cluster viz).
 */

import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  color?: string;
  type?: string;
  detail?: string;
}

interface ForceTreeProps {
  data: TreeNode;
  width?: number;
  height?: number;
  /** Color scale: maps depth to color. Default uses Studio palette */
  colorScale?: (depth: number) => string;
  /** Called when a node is clicked */
  onNodeClick?: (node: TreeNode) => void;
  /** Node radius range [min, max]. Default: [4, 8] */
  radiusRange?: [number, number];
  /** Link distance. Default: 30 */
  linkDistance?: number;
  /** Charge strength. Default: -50 */
  chargeStrength?: number;
}

const STUDIO_TREE_COLORS = [
  '#B45A2D', // terracotta: root/primary
  '#2D5F6B', // teal: sources
  '#C49A4A', // gold: connections
  '#5A7A4A', // green: published/verified
  '#8A6A9A', // purple: backlinks
  '#9A9088', // muted: uncategorized
];

const RADIUS_RANGE: [number, number] = [4, 8];

export default function ForceTree({
  data,
  width = 600,
  height = 400,
  colorScale,
  onNodeClick,
  radiusRange = RADIUS_RANGE,
  linkDistance = 30,
  chargeStrength = -50,
}: ForceTreeProps) {
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

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !data) return;

    const root = d3.hierarchy(data);
    const links = root.links();
    const nodes = root.descendants();

    const defaultColor = (depth: number) =>
      STUDIO_TREE_COLORS[depth % STUDIO_TREE_COLORS.length];
    const getColor = colorScale ?? defaultColor;

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((_d: d3.SimulationNodeDatum, i: number) => String(i))
        .distance(linkDistance)
        .strength(1))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    const sel = d3.select(svg);
    sel.selectAll('*').remove();

    const g = sel.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    sel.call(zoom);
    zoomRef.current = zoom;

    /* Links */
    const link = g.append('g')
      .attr('stroke', 'rgba(255, 255, 255, 0.12)')
      .attr('stroke-width', 1.5)
      .selectAll('line')
      .data(links)
      .join('line');

    /* Nodes */
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', (d: any) => {
        const hasChildren = d.children && d.children.length > 0;
        return hasChildren ? radiusRange[1] : radiusRange[0];
      })
      .attr('fill', (d: any) => d.data.color ?? getColor(d.depth))
      .attr('stroke', 'rgba(0, 0, 0, 0.3)')
      .attr('stroke-width', 1)
      .style('cursor', onNodeClick ? 'pointer' : 'default')
      .call(d3.drag<any, any>()
        .on('start', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: any, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    if (onNodeClick) {
      node.on('click', (_event: any, d: any) => {
        onNodeClick(d.data);
      });
    }

    /* Tooltips via title element */
    node.append('title')
      .text((d: any) => d.data.label);

    /* Tick */
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return () => {
      simulation.stop();
    };
  }, [data, width, height, colorScale, onNodeClick, radiusRange, linkDistance, chargeStrength]);

  return (
    <div className="studio-research-graph-container" style={{ height }}>
      <svg
        ref={svgRef}
        className="studio-research-graph-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ touchAction: 'none' }}
      />
      <div className="studio-research-graph-controls">
        <button type="button" onClick={resetZoom} title="Reset zoom">
          &#x21BA;
        </button>
      </div>
    </div>
  );
}
