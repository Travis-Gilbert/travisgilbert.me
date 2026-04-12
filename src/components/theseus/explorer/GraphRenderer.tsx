'use client';

import { useEffect, useMemo } from 'react';
import { SigmaContainer, useRegisterEvents, useSigma } from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import type Graph from 'graphology';
import type { GraphData, InvestigationView } from '@/lib/theseus-types';
import type { NodeStyle, EdgeStyle } from '@/lib/graph-projections';

interface GraphRendererProps {
  graphData: GraphData | null;
  graph: Graph;
  activeView: InvestigationView;
  selectedNodeId: string | null;
  highlightedNodeIds: Set<string>;
  onSelectNode: (id: string | null) => void;
  onShiftSelectNode?: (id: string) => void;
  visibleNodes?: Set<string>;
  nodeStyles?: Map<string, NodeStyle>;
  edgeStyles?: Map<string, EdgeStyle>;
  secondarySelectedId?: string | null;
  pathNodeIds?: string[];
  pathEdgeIds?: Set<string>;
}

function GraphEvents({
  onSelectNode,
  onShiftSelectNode,
  selectedNodeId,
  graph,
  pathEdgeIds,
  visibleNodes,
  nodeStyles,
  edgeStyles,
  highlightedNodeIds,
  secondarySelectedId,
}: {
  onSelectNode: (id: string | null) => void;
  onShiftSelectNode?: (id: string) => void;
  selectedNodeId: string | null;
  graph: Graph;
  pathEdgeIds?: Set<string>;
  visibleNodes?: Set<string>;
  nodeStyles?: Map<string, NodeStyle>;
  edgeStyles?: Map<string, EdgeStyle>;
  highlightedNodeIds: Set<string>;
  secondarySelectedId?: string | null;
}) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();

  // Event handlers
  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        if (event.event.original.shiftKey && selectedNodeId && onShiftSelectNode) {
          onShiftSelectNode(event.node);
        } else {
          onSelectNode(event.node);
        }
      },
      clickStage: () => {
        onSelectNode(null);
      },
      doubleClickNode: (event) => {
        const camera = sigma.getCamera();
        const pos = sigma.getNodeDisplayData(event.node);
        if (pos) {
          camera.animate({ x: pos.x, y: pos.y, ratio: 0.3 }, { duration: 400 });
        }
      },
    });
  }, [registerEvents, onSelectNode, onShiftSelectNode, selectedNodeId, sigma]);

  // Tooltip: use Sigma's defaultDrawNodeHover for multi-line hover info
  useEffect(() => {
    sigma.setSetting('defaultDrawNodeHover', (context, data) => {
      const { x, y } = data;
      const size = data.size || 5;

      // Selection ring (#4A8A96)
      context.beginPath();
      context.arc(x, y, size + 3, 0, Math.PI * 2);
      context.strokeStyle = '#4A8A96';
      context.lineWidth = 2;
      context.stroke();
      context.closePath();

      // Node circle
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fillStyle = data.color || '#9a958d';
      context.fill();
      context.closePath();

      // Multi-line tooltip: title, type + role, edge count
      const nodeKey = data.key ?? '';
      const label = data.label || '';
      const objectType = (graph.hasNode(nodeKey) ? graph.getNodeAttribute(nodeKey, 'object_type') : '') as string;
      const edgeCount = (graph.hasNode(nodeKey) ? graph.getNodeAttribute(nodeKey, 'edge_count') : 0) as number;
      const cited = graph.hasNode(nodeKey) ? graph.getNodeAttribute(nodeKey, 'cited') as boolean : false;

      const lines: string[] = [label];
      if (objectType) lines.push(objectType);
      if (edgeCount > 0) lines.push(`${edgeCount} connections`);
      if (cited) lines.push('Cited in answer');

      context.font = '11px monospace';
      const lineHeight = 14;
      const padding = 6;
      const maxWidth = Math.max(...lines.map((l) => context.measureText(l).width), 0);
      const boxWidth = maxWidth + padding * 2;
      const boxHeight = lines.length * lineHeight + padding * 2;

      context.fillStyle = 'rgba(36, 34, 32, 0.95)';
      context.fillRect(x + size + 6, y - boxHeight / 2, boxWidth, boxHeight);

      lines.forEach((line, i) => {
        context.fillStyle = i === 0 ? '#F4F3F0' : '#7a7670';
        context.fillText(line, x + size + 6 + padding, y - boxHeight / 2 + padding + (i + 1) * lineHeight - 3);
      });
    });
  }, [sigma, graph]);

  // Combined reducer: selection dimming + view lens + path highlighting
  useEffect(() => {
    const hasSelection = selectedNodeId && graph.hasNode(selectedNodeId);

    const neighbors = new Set<string>();
    if (hasSelection) {
      neighbors.add(selectedNodeId);
      graph.forEachNeighbor(selectedNodeId, (n) => neighbors.add(n));
    }

    sigma.setSetting('nodeReducer', (node, data) => {
      const res = { ...data };

      // View lens: ghost nodes outside visibleNodes at opacity 0.06
      if (visibleNodes && visibleNodes.size > 0 && !visibleNodes.has(node)) {
        res.color = applyOpacity(typeof data.color === 'string' ? data.color : '#9a958d', 0.06);
        res.label = '';
        res.zIndex = -1;
        return res;
      }

      // View lens: apply custom node styles
      const style = nodeStyles?.get(node);
      if (style) {
        if (style.color) res.color = style.color;
        if (style.size) res.size = style.size;
      }

      // Highlighted nodes
      if (highlightedNodeIds.has(node)) {
        res.highlighted = true;
      }

      // Secondary selection ring
      if (secondarySelectedId === node) {
        res.highlighted = true;
        res.zIndex = 2;
      }

      // Selection: neighbor dimming at opacity 0.12
      if (hasSelection) {
        if (node === selectedNodeId) {
          res.highlighted = true;
          res.zIndex = 2;
        } else if (!neighbors.has(node)) {
          res.color = applyOpacity(typeof res.color === 'string' ? res.color : '#9a958d', 0.12);
          res.label = '';
          res.zIndex = 0;
        } else {
          res.zIndex = 1;
        }
      }

      return res;
    });

    sigma.setSetting('edgeReducer', (edge, data) => {
      const src = graph.source(edge);
      const tgt = graph.target(edge);
      const res = { ...data };

      // View lens: apply custom edge styles
      const style = edgeStyles?.get(edge);
      if (style) {
        if (style.color) res.color = style.color;
        if (style.size) res.size = style.size;
      }

      // Path edges: priority styling
      if (pathEdgeIds?.has(edge)) {
        return { ...res, color: '#4A8A96', size: 3 };
      }

      if (hasSelection) {
        if (src === selectedNodeId || tgt === selectedNodeId) {
          return { ...res, color: 'rgba(74, 138, 150, 0.4)', size: Math.max(res.size ?? 1, 1.5) };
        }
        if (pathEdgeIds?.size) {
          return { ...res, color: 'rgba(255, 255, 255, 0.04)', size: 0.5 };
        }
        if (!neighbors.has(src) || !neighbors.has(tgt)) {
          return { ...res, hidden: true };
        }
      }

      return res;
    });

    return () => {
      sigma.setSetting('nodeReducer', null);
      sigma.setSetting('edgeReducer', null);
    };
  }, [selectedNodeId, sigma, graph, pathEdgeIds, visibleNodes, nodeStyles, edgeStyles, highlightedNodeIds, secondarySelectedId]);

  return null;
}

/** Convert hex color to rgba with specified opacity */
function applyOpacity(color: string, opacity: number): string {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

export default function GraphRenderer({
  graphData,
  graph,
  selectedNodeId,
  highlightedNodeIds,
  onSelectNode,
  onShiftSelectNode,
  visibleNodes,
  nodeStyles,
  edgeStyles,
  secondarySelectedId,
  pathEdgeIds,
}: GraphRendererProps) {
  const settings = useMemo(() => ({
    labelColor: { color: '#F4F3F0' },
    labelFont: 'monospace',
    labelSize: 11,
    labelWeight: '400' as const,
    // Only show labels on larger (high-degree) nodes; prevents dense label overlap
    labelDensity: 0.3,
    labelGridCellSize: 180,
    // Only render labels for nodes above this display-size threshold
    labelRenderedSizeThreshold: 8,
    defaultNodeColor: '#9a958d',
    defaultEdgeColor: 'rgba(255, 255, 255, 0.04)',
    renderEdgeLabels: false,
    enableEdgeEvents: false,
    zIndex: true,
    minCameraRatio: 0.05,
    maxCameraRatio: 5,
    // Slight padding around nodes
    stagePadding: 30,
  }), []);

  // MUST NOT: render when graphData is null
  if (!graphData) {
    return null;
  }

  return (
    <div className="explorer-graph-renderer">
      <SigmaContainer
        graph={graph}
        settings={settings}
        className="explorer-graph-sigma"
      >
        <GraphEvents
          onSelectNode={onSelectNode}
          onShiftSelectNode={onShiftSelectNode}
          selectedNodeId={selectedNodeId}
          graph={graph}
          pathEdgeIds={pathEdgeIds}
          visibleNodes={visibleNodes}
          nodeStyles={nodeStyles}
          edgeStyles={edgeStyles}
          highlightedNodeIds={highlightedNodeIds}
          secondarySelectedId={secondarySelectedId}
        />
      </SigmaContainer>
    </div>
  );
}
