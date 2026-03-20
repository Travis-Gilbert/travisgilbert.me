'use client';

import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { HUBS } from './theseus-data';
import SectionLabel from '@/components/SectionLabel';

interface ForceNode extends d3.SimulationNodeDatum {
  id: number;
  nodeId: string;
  label: string;
  color: string;
  isHub: boolean;
  parentHub?: string;
  leaves?: number;
}

interface ForceLink extends d3.SimulationLinkDatum<ForceNode> {
  isSpine: boolean;
}

function buildGraphData() {
  const nodes: ForceNode[] = [];
  const links: ForceLink[] = [];
  let nodeId = 0;

  HUBS.forEach((hub) => {
    const hubIdx = nodeId++;
    nodes.push({
      id: hubIdx,
      nodeId: hub.id,
      label: hub.label,
      color: hub.color,
      isHub: true,
      leaves: hub.leaves.length,
    });

    if (hub.parentId !== null) {
      const parentNode = nodes.find((n) => n.nodeId === hub.parentId);
      if (parentNode) {
        links.push({
          source: parentNode.id,
          target: hubIdx,
          isSpine: true,
        });
      }
    }

    hub.leaves.forEach((leafLabel) => {
      const leafIdx = nodeId++;
      nodes.push({
        id: leafIdx,
        nodeId: `${hub.id}-${leafIdx}`,
        label: leafLabel,
        color: hub.color,
        isHub: false,
        parentHub: hub.id,
      });
      links.push({
        source: hubIdx,
        target: leafIdx,
        isSpine: false,
      });
    });
  });

  return { nodes, links };
}

/**
 * Renders tooltip content for a hub node.
 * All content is from static theseus-data.ts (not user input), so XSS is not a risk.
 */
function renderTooltipHTML(label: string, color: string, info: string): string {
  return `<span style="font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;display:block;margin-bottom:3px;color:${color}">${label}</span>${info}`;
}

export default function ForceTree() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear any previous render
    container.textContent = '';

    const W = container.clientWidth;
    const H = Math.max(600, container.clientHeight);
    if (W < 1 || H < 1) return;

    const { nodes, links } = buildGraphData();

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', W)
      .attr('height', H)
      .style('display', 'block');

    const g = svg.append('g');

    // Zoom: disable wheel zoom so it doesn't hijack page scroll.
    // Users can still pinch-to-zoom or double-click to zoom.
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .filter((e) => e.type !== 'wheel')
      .on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoomBehavior);

    // Force simulation
    const sim = d3
      .forceSimulation(nodes)
      .force(
        'link',
        d3
          .forceLink<ForceNode, ForceLink>(links)
          .id((d) => d.id)
          .distance((d) => (d.isSpine ? 180 : 50))
          .strength((d) => (d.isSpine ? 0.3 : 0.8)),
      )
      .force(
        'charge',
        d3.forceManyBody<ForceNode>().strength((d) => (d.isHub ? -600 : -30)),
      )
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.03))
      .force(
        'collision',
        d3
          .forceCollide<ForceNode>()
          .radius((d) => (d.isHub ? 40 : 14))
          .strength(0.8),
      )
      .force('x', d3.forceX(W / 2).strength(0.01))
      .force('y', d3.forceY(H / 2).strength(0.01));

    // Pre-compute 350 ticks, then animate last steps
    for (let i = 0; i < 350; i++) sim.tick();
    sim.alpha(0.15).restart();

    // ── Draw ──

    // Edges
    const edgeG = g.append('g');
    const edgeSel = edgeG
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d) =>
        d.isSpine ? 'rgba(42,36,32,0.15)' : 'rgba(42,36,32,0.1)',
      )
      .attr('stroke-width', (d) => (d.isSpine ? 1.2 : 0.7));

    // Node group
    const nodeG = g.append('g');

    // Leaf nodes
    const leafSel = nodeG
      .selectAll<SVGCircleElement, ForceNode>('.leaf')
      .data(nodes.filter((n) => !n.isHub))
      .enter()
      .append('circle')
      .attr('class', 'leaf')
      .attr('r', 5)
      .attr('fill', (d) => d.color)
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', 0.5)
      .attr('fill-opacity', 0.8)
      .style('cursor', 'pointer');

    // Hub nodes
    const hubSel = nodeG
      .selectAll<SVGCircleElement, ForceNode>('.hub')
      .data(nodes.filter((n) => n.isHub))
      .enter()
      .append('circle')
      .attr('class', 'hub')
      .attr('r', (d) => (d.nodeId === 'root' ? 16 : 10))
      .attr('fill', (d) =>
        d.nodeId === 'root' ? d.color : 'var(--color-paper)',
      )
      .attr('fill-opacity', (d) => (d.nodeId === 'root' ? 0.15 : 1))
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', (d) => (d.nodeId === 'root' ? 2.5 : 1.8))
      .style('cursor', 'pointer');

    // Hub labels
    const labelSel = nodeG
      .selectAll<SVGTextElement, ForceNode>('.hub-label')
      .data(nodes.filter((n) => n.isHub))
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => (d.nodeId === 'root' ? -24 : -18))
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('font-size', (d) => (d.nodeId === 'root' ? '11px' : '9px'))
      .attr('font-weight', '600')
      .attr('letter-spacing', '0.06em')
      .attr('fill', (d) => d.color)
      .text((d) => d.label)
      .style('pointer-events', 'none');

    // Leaf labels (hidden by default)
    const leafLabelSel = nodeG
      .selectAll<SVGTextElement, ForceNode>('.leaf-label')
      .data(nodes.filter((n) => !n.isHub))
      .enter()
      .append('text')
      .attr('text-anchor', 'start')
      .attr('dx', 9)
      .attr('dy', 3)
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('font-size', '8px')
      .attr('font-weight', '400')
      .attr('fill', 'var(--color-ink-light)')
      .attr('letter-spacing', '0.03em')
      .text((d) => d.label)
      .attr('opacity', 0)
      .style('pointer-events', 'none');

    // ── Drag ──
    const drag = d3
      .drag<SVGCircleElement, ForceNode>()
      .on('start', (e, d) => {
        if (!e.active) sim.alphaTarget(0.1).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (e, d) => {
        d.fx = e.x;
        d.fy = e.y;
      })
      .on('end', (e, d) => {
        if (!e.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    hubSel.call(drag);
    leafSel.call(drag);

    // ── Tick ──
    sim.on('tick', () => {
      edgeSel
        .attr('x1', (d) => (d.source as ForceNode).x!)
        .attr('y1', (d) => (d.source as ForceNode).y!)
        .attr('x2', (d) => (d.target as ForceNode).x!)
        .attr('y2', (d) => (d.target as ForceNode).y!);
      hubSel.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
      leafSel.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);
      labelSel.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
      leafLabelSel.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
    });

    // ── Tooltip ──
    const tooltip = document.createElement('div');
    tooltip.style.cssText =
      'position:fixed;pointer-events:none;z-index:20;'
      + 'background:rgba(250,250,248,0.95);border:1px solid #D4CFC6;'
      + 'border-radius:6px;padding:10px 12px;max-width:280px;'
      + 'box-shadow:0 4px 12px rgba(42,36,32,0.12);'
      + 'opacity:0;transition:opacity 0.15s;'
      + 'font-size:12px;color:#6A5E52;line-height:1.5;'
      + "font-family:'IBM Plex Sans',sans-serif;backdrop-filter:blur(8px);";
    document.body.appendChild(tooltip);

    // Hub info map
    const hubInfoMap = new Map<string, { label: string; color: string; info: string }>();
    HUBS.forEach((h) => {
      hubInfoMap.set(h.id, { label: h.label, color: h.color, info: h.info });
    });

    // ── Hub hover ──
    hubSel
      .on('mouseenter', function (_event, d) {
        const info = hubInfoMap.get(d.nodeId);
        if (!info) return;

        // Static content from theseus-data.ts, not user-supplied
        tooltip.innerHTML = renderTooltipHTML(info.label, info.color, info.info);
        tooltip.style.opacity = '1';

        // Highlight cluster
        leafSel.attr('opacity', (n) =>
          n.parentHub === d.nodeId ? 1 : 0.15,
        );
        leafLabelSel.attr('opacity', (n) =>
          n.parentHub === d.nodeId ? 0.8 : 0,
        );
        hubSel.attr('opacity', (n) =>
          n.nodeId === d.nodeId || n.nodeId === 'root' ? 1 : 0.2,
        );
        edgeSel
          .attr('opacity', (e) => {
            const src = e.source as ForceNode;
            const tgt = e.target as ForceNode;
            if (src.nodeId === d.nodeId || tgt.nodeId === d.nodeId) return 1;
            if (src.parentHub === d.nodeId || tgt.parentHub === d.nodeId) return 1;
            return 0.05;
          })
          .attr('stroke-width', (e) => {
            const src = e.source as ForceNode;
            const tgt = e.target as ForceNode;
            if (src.parentHub === d.nodeId || tgt.parentHub === d.nodeId) return 1.2;
            if (src.nodeId === d.nodeId || tgt.nodeId === d.nodeId) return 2;
            return 0.3;
          });

        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', d.nodeId === 'root' ? 20 : 14);
        labelSel.attr('font-size', (n) =>
          n.nodeId === d.nodeId
            ? '12px'
            : n.nodeId === 'root'
              ? '11px'
              : '9px',
        );
      })
      .on('mousemove', function (event) {
        tooltip.style.left = event.clientX + 16 + 'px';
        tooltip.style.top = event.clientY - 10 + 'px';
      })
      .on('mouseleave', function (_event, d) {
        tooltip.style.opacity = '0';
        leafSel.attr('opacity', 1);
        leafLabelSel.attr('opacity', 0);
        hubSel.attr('opacity', 1);
        edgeSel
          .attr('opacity', 1)
          .attr('stroke-width', (e) => (e.isSpine ? 1.2 : 0.7));
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', d.nodeId === 'root' ? 16 : 10);
        labelSel.attr('font-size', (n) =>
          n.nodeId === 'root' ? '11px' : '9px',
        );
      });

    // Leaf hover
    leafSel
      .on('mouseenter', function (_event, d) {
        // Static content, not user-supplied
        tooltip.innerHTML = renderTooltipHTML(d.label, d.color, '');
        tooltip.style.opacity = '1';
        d3.select(this).transition().duration(100).attr('r', 8);
      })
      .on('mousemove', function (event) {
        tooltip.style.left = event.clientX + 16 + 'px';
        tooltip.style.top = event.clientY - 10 + 'px';
      })
      .on('mouseleave', function () {
        tooltip.style.opacity = '0';
        d3.select(this).transition().duration(100).attr('r', 5);
      });

    // ── Auto-fit ──
    setTimeout(() => {
      const bounds = g.node()?.getBBox();
      if (!bounds) return;
      const fullW = bounds.width + 100;
      const fullH = bounds.height + 100;
      const scale = Math.min(W / fullW, H / fullH, 1.2);
      const tx = W / 2 - (bounds.x + bounds.width / 2) * scale;
      const ty = H / 2 - (bounds.y + bounds.height / 2) * scale;
      svg
        .transition()
        .duration(800)
        .call(
          zoomBehavior.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale),
        );
    }, 1500);

    // Cleanup
    return () => {
      sim.stop();
      tooltip.remove();
      container.textContent = '';
    };
  }, []);

  return (
    <section className="theseus-force-tree" style={{ width: '100%' }}>
      <div className="theseus-section">
        <SectionLabel color="terracotta">Architecture</SectionLabel>
        <h2 className="font-title text-2xl md:text-[32px] font-bold leading-tight mb-3">
          The Graph <em className="text-terracotta italic">IS</em> the Network
        </h2>
        <p className="text-ink-muted text-[15px] max-w-[660px] mb-4 leading-relaxed font-light">
          Every object type, every engine pass, every infrastructure decision. Hover
          a hub node for implementation details. Drag to rearrange. Scroll to zoom.
        </p>
      </div>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          minHeight: 600,
          height: '70vh',
          maxHeight: 800,
        }}
      />
    </section>
  );
}
