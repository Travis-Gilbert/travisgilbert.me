'use client';

/**
 * SourceSankey: flow diagram showing how sources connect to content.
 *
 * Left column: source nodes grouped by type.
 * Right column: content nodes (essays, field notes).
 * Flow bands: SourceLinks colored by role, width proportional
 * to the number of shared sources.
 *
 * This is a simplified Sankey (no d3-sankey dependency) using
 * manual positioning with bezier curves.
 *
 * Data comes from GET /api/v1/graph/.
 */

import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { GraphResponse } from '@/lib/research';
import { fetchSourceGraph } from '@/lib/research';

const SOURCE_TYPE_COLORS: Record<string, string> = {
  book: '#C49A4A',
  article: '#B45A2D',
  paper: '#6B4A8A',
  video: '#A44A3A',
  podcast: '#5A7A4A',
  dataset: '#2D5F6B',
  document: '#8A7A5A',
  report: '#5A6A7A',
  map: '#4A7A5A',
  archive: '#7A6A4A',
  interview: '#6A5A7A',
  website: '#5A7A8A',
  other: '#6A5E52',
};

const CONTENT_COLORS: Record<string, string> = {
  essay: '#B45A2D',
  field_note: '#2D5F6B',
};

const ROLE_COLORS: Record<string, string> = {
  primary: '#B45A2D',
  background: '#9A8E82',
  inspiration: '#C49A4A',
  data: '#2D5F6B',
  counterargument: '#A44A3A',
  methodology: '#5A7A4A',
  reference: '#6A5E52',
};

interface SankeyNode {
  id: string;
  label: string;
  type: string;
  color: string;
  x: number;
  y: number;
  height: number;
  connectionCount: number;
}

interface SankeyLink {
  sourceId: string;
  targetId: string;
  role: string;
  sourceY: number;
  targetY: number;
  thickness: number;
}

export default function SourceSankey() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 });

  useEffect(() => {
    let cancelled = false;
    fetchSourceGraph().then((d) => {
      if (cancelled) return;
      setData(d);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const updateSize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: Math.max(400, Math.min(container.clientWidth * 0.55, 600)),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const sourceNodes = data.nodes.filter((n) => n.type === 'source');
    const contentNodes = data.nodes.filter((n) => n.type !== 'source');

    if (sourceNodes.length === 0 || contentNodes.length === 0) return;

    // Count connections per node
    const connectionCounts = new Map<string, number>();
    for (const edge of data.edges) {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 30, right: 120, bottom: 30, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Sort sources by type then by connection count
    const sortedSources = [...sourceNodes].sort((a, b) => {
      const typeComp = (a.sourceType || 'other').localeCompare(b.sourceType || 'other');
      if (typeComp !== 0) return typeComp;
      return (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0);
    });

    // Sort content by type then connection count
    const sortedContent = [...contentNodes].sort((a, b) => {
      const typeComp = a.type.localeCompare(b.type);
      if (typeComp !== 0) return typeComp;
      return (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0);
    });

    // Position source nodes on left
    const sourceNodeHeight = Math.max(8, Math.min(innerHeight / sortedSources.length - 2, 20));
    const sourceTotalHeight = sortedSources.length * (sourceNodeHeight + 2);
    const sourceStartY = Math.max(0, (innerHeight - sourceTotalHeight) / 2);

    const sankeySourceNodes: SankeyNode[] = sortedSources.map((node, i) => ({
      id: node.id,
      label: node.label,
      type: node.sourceType || 'other',
      color: SOURCE_TYPE_COLORS[node.sourceType || 'other'] || '#6A5E52',
      x: 0,
      y: sourceStartY + i * (sourceNodeHeight + 2),
      height: sourceNodeHeight,
      connectionCount: connectionCounts.get(node.id) || 0,
    }));

    // Position content nodes on right
    const contentNodeHeight = Math.max(16, Math.min(innerHeight / sortedContent.length - 4, 40));
    const contentTotalHeight = sortedContent.length * (contentNodeHeight + 4);
    const contentStartY = Math.max(0, (innerHeight - contentTotalHeight) / 2);

    const sankeyContentNodes: SankeyNode[] = sortedContent.map((node, i) => ({
      id: node.id,
      label: node.label,
      type: node.type,
      color: CONTENT_COLORS[node.type] || '#6A5E52',
      x: innerWidth,
      y: contentStartY + i * (contentNodeHeight + 4),
      height: contentNodeHeight,
      connectionCount: connectionCounts.get(node.id) || 0,
    }));

    const allNodes = [...sankeySourceNodes, ...sankeyContentNodes];
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    // Build links with Y positions
    const sourceOffsets = new Map<string, number>();
    const targetOffsets = new Map<string, number>();

    const links: SankeyLink[] = data.edges
      .map((edge) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;

        const sOffset = sourceOffsets.get(edge.source) || 0;
        const tOffset = targetOffsets.get(edge.target) || 0;
        const thickness = Math.max(2, Math.min(source.height * 0.8, 6));

        const link: SankeyLink = {
          sourceId: edge.source,
          targetId: edge.target,
          role: edge.role,
          sourceY: source.y + sOffset + thickness / 2,
          targetY: target.y + tOffset + thickness / 2,
          thickness,
        };

        sourceOffsets.set(edge.source, sOffset + thickness + 1);
        targetOffsets.set(edge.target, tOffset + thickness + 1);

        return link;
      })
      .filter((l): l is SankeyLink => l !== null);

    // Draw links (bezier curves)
    const linkSelection = g
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGPathElement, SankeyLink>('path')
      .data(links)
      .join('path')
      .attr('d', (d) => {
        const sx = 8;
        const tx = innerWidth - 8;
        const midX = (sx + tx) / 2;
        return `M ${sx},${d.sourceY} C ${midX},${d.sourceY} ${midX},${d.targetY} ${tx},${d.targetY}`;
      })
      .attr('fill', 'none')
      .attr('stroke', (d) => ROLE_COLORS[d.role] || '#9A8E82')
      .attr('stroke-width', (d) => d.thickness)
      .attr('stroke-opacity', 0.2);

    // Source node bars (left)
    const sourceSelection = g
      .selectAll<SVGGElement, SankeyNode>('.source-bar')
      .data(sankeySourceNodes)
      .join('g')
      .attr('class', 'source-bar')
      .attr('cursor', 'pointer');

    sourceSelection
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => d.y)
      .attr('width', 8)
      .attr('height', (d) => d.height)
      .attr('rx', 2)
      .attr('fill', (d) => d.color);

    // Source labels
    sourceSelection
      .append('text')
      .attr('x', -6)
      .attr('y', (d) => d.y + d.height / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '8px')
      .attr('fill', 'var(--color-ink-light)')
      .text((d) => d.label.length > 18 ? d.label.slice(0, 16) + '...' : d.label);

    // Content node bars (right)
    const contentSelection = g
      .selectAll<SVGGElement, SankeyNode>('.content-bar')
      .data(sankeyContentNodes)
      .join('g')
      .attr('class', 'content-bar')
      .attr('cursor', 'pointer');

    contentSelection
      .append('rect')
      .attr('x', innerWidth - 8)
      .attr('y', (d) => d.y)
      .attr('width', 8)
      .attr('height', (d) => d.height)
      .attr('rx', 2)
      .attr('fill', (d) => d.color);

    // Content labels
    contentSelection
      .append('text')
      .attr('x', innerWidth + 6)
      .attr('y', (d) => d.y + d.height / 2)
      .attr('dominant-baseline', 'middle')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '9px')
      .attr('fill', 'var(--color-ink-muted)')
      .text((d) => d.label.length > 24 ? d.label.slice(0, 22) + '...' : d.label);

    // Column headers
    g.append('text')
      .attr('x', 4)
      .attr('y', -12)
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '10px')
      .attr('fill', 'var(--color-ink-light)')
      .attr('letter-spacing', '0.08em')
      .text('SOURCES');

    g.append('text')
      .attr('x', innerWidth - 4)
      .attr('y', -12)
      .attr('text-anchor', 'end')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-size', '10px')
      .attr('fill', 'var(--color-ink-light)')
      .attr('letter-spacing', '0.08em')
      .text('CONTENT');

    // Hover interactions
    sourceSelection
      .on('mouseenter', function (_, d) {
        setHoveredNode(d.id);
        linkSelection.attr('stroke-opacity', (l) =>
          l.sourceId === d.id || l.targetId === d.id ? 0.6 : 0.05
        );
      })
      .on('mouseleave', function () {
        setHoveredNode(null);
        linkSelection.attr('stroke-opacity', 0.2);
      });

    contentSelection
      .on('mouseenter', function (_, d) {
        setHoveredNode(d.id);
        linkSelection.attr('stroke-opacity', (l) =>
          l.sourceId === d.id || l.targetId === d.id ? 0.6 : 0.05
        );
      })
      .on('mouseleave', function () {
        setHoveredNode(null);
        linkSelection.attr('stroke-opacity', 0.2);
      });

  }, [data, dimensions]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-[400px] text-ink-light font-mono text-sm">
        Loading flow diagram...
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-ink-light font-body-alt text-sm">
        No research data to visualize yet.
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="rounded-lg border border-border bg-surface"
      />

      {/* Role legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-mono text-ink-light">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <span key={role} className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: color }} />
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}
