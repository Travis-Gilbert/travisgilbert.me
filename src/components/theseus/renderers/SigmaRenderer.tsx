'use client';

import { useEffect, useMemo, useState } from 'react';
import Graph from 'graphology';
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSetSettings,
  useSigma,
} from '@react-sigma/core';
import '@react-sigma/core/lib/style.css';
import type { Attributes } from 'graphology-types';
import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import {
  buildRendererGraph,
  getClusterCoalesceProgress,
  getEdgeRevealProgress,
  getNodeRevealProgress,
  getVisibleLabelIds,
  hexToRgba,
  type ConstructionPlayback,
} from './rendering';

interface SigmaNodeAttributes extends Attributes {
  x: number;
  y: number;
  size: number;
  color: string;
  label?: string;
  originalColor: string;
  originalSize: number;
}

interface SigmaEdgeAttributes extends Attributes {
  size: number;
  color: string;
  originalColor: string;
  originalSize: number;
}

interface SigmaRendererProps {
  directive: SceneDirective;
  response: TheseusResponse;
  playback: ConstructionPlayback;
  onSelectNode?: (nodeId: string) => void;
  onError?: (error: Error) => void;
}

function buildGraph(
  response: TheseusResponse,
  directive: SceneDirective,
  playback: ConstructionPlayback,
): Graph<SigmaNodeAttributes, SigmaEdgeAttributes> {
  const graph = new Graph<SigmaNodeAttributes, SigmaEdgeAttributes>();
  const { nodes, edges } = buildRendererGraph(response, directive);
  const labelIds = getVisibleLabelIds(nodes, playback);
  const clusterProgress = getClusterCoalesceProgress(playback);

  nodes.forEach((node) => {
    const reveal = getNodeRevealProgress(node.id, directive, playback);
    const spreadFactor = 1 + (1 - clusterProgress) * 0.4;
    const color = hexToRgba(node.color, node.opacity * reveal);

    graph.addNode(node.id, {
      x: node.initialPosition[0] * spreadFactor,
      y: node.initialPosition[2] * spreadFactor,
      size: Math.max(1, node.baseScale * reveal * 8),
      color,
      label: labelIds.has(node.id) ? node.label : undefined,
      originalColor: color,
      originalSize: Math.max(1, node.baseScale * 8),
    });
  });

  edges.forEach((edge) => {
    const reveal = getEdgeRevealProgress(edge.id, directive, playback);
    const color = hexToRgba(edge.color, Math.max(0.12, 0.8 * reveal * edge.visibility));
    graph.addEdge(edge.source, edge.target, {
      size: (1 + ((edge.strength - 0.3) / 0.7) * 3) * reveal,
      color,
      originalColor: color,
      originalSize: 1 + ((edge.strength - 0.3) / 0.7) * 3,
    });
  });

  return graph;
}

function SigmaGraph({
  directive,
  graph,
  onSelectNode,
  onHoverNodeChange,
}: {
  directive: SceneDirective;
  graph: Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;
  onSelectNode?: (nodeId: string) => void;
  onHoverNodeChange: (nodeId: string | null) => void;
}) {
  const sigma = useSigma<SigmaNodeAttributes, SigmaEdgeAttributes>();
  const loadGraph = useLoadGraph<SigmaNodeAttributes, SigmaEdgeAttributes>();
  const registerEvents = useRegisterEvents<SigmaNodeAttributes, SigmaEdgeAttributes>();
  const setSettings = useSetSettings<SigmaNodeAttributes, SigmaEdgeAttributes>();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    loadGraph(graph, true);
    sigma.refresh();
  }, [graph, loadGraph, sigma]);

  useEffect(() => {
    registerEvents({
      clickNode: ({ node }) => onSelectNode?.(node),
      enterNode: ({ node }) => {
        setHoveredNode(node);
        onHoverNodeChange(node);
      },
      leaveNode: () => {
        setHoveredNode(null);
        onHoverNodeChange(null);
      },
    });
  }, [onHoverNodeChange, onSelectNode, registerEvents]);

  useEffect(() => {
    let neighborSet = new Set<string>();

    if (hoveredNode) {
      neighborSet = new Set(graph.neighbors(hoveredNode));
      neighborSet.add(hoveredNode);
    }

    setSettings({
      labelRenderedSizeThreshold: 1000,
      renderLabels: true,
      renderEdgeLabels: false,
      allowInvalidContainer: true,
      zIndex: true,
      nodeReducer: (node, data) => {
        if (!hoveredNode) {
          return data;
        }

        if (neighborSet.has(node)) {
          return data;
        }

        return {
          ...data,
          color: data.originalColor.replace(/rgba\((.+),\s*([0-9.]+)\)$/, 'rgba($1, 0.2)'),
        };
      },
      edgeReducer: (edge, data) => {
        if (!hoveredNode) {
          return data;
        }

        const [source, target] = graph.extremities(edge);
        const connected = source === hoveredNode || target === hoveredNode;
        if (connected) {
          return {
            ...data,
            size: data.originalSize * 2,
          };
        }

        return {
          ...data,
          color: data.originalColor.replace(/rgba\((.+),\s*([0-9.]+)\)$/, 'rgba($1, 0.2)'),
          size: Math.max(0.5, data.originalSize * 0.65),
        };
      },
    });

    sigma.refresh();
  }, [graph, hoveredNode, setSettings, sigma]);

  useEffect(() => {
    let timeoutId: number | undefined;
    let worker: { start: () => void; stop: () => void; kill: () => void } | null = null;
    let cancelled = false;

    async function layoutGraph() {
      const settings = {
        gravity: directive.force_config.center_gravity,
        scalingRatio: Math.abs(directive.force_config.charge_strength) / 100,
        barnesHutOptimize: graph.order > 50,
      };

      if (graph.order > 100) {
        const module = await import('graphology-layout-forceatlas2/worker');
        if (cancelled) return;

        const FA2Layout = module.default;
        worker = new FA2Layout(graph, { settings });
        worker.start();
        timeoutId = window.setTimeout(() => {
          worker?.stop();
          sigma.refresh();
        }, 900);
        return;
      }

      const module = await import('graphology-layout-forceatlas2');
      if (cancelled) return;

      module.default.assign(graph, {
        iterations: 120,
        settings,
      });
      sigma.refresh();
    }

    layoutGraph().catch(() => {
      sigma.refresh();
    });

    return () => {
      cancelled = true;
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId);
      }
      worker?.kill();
    };
  }, [graph, sigma]);

  return null;
}

export default function SigmaRenderer({
  directive,
  response,
  playback,
  onSelectNode,
  onError,
}: SigmaRendererProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const graph = useMemo(() => {
    try {
      return buildGraph(response, directive, playback);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to build Sigma graph'));
      return new Graph<SigmaNodeAttributes, SigmaEdgeAttributes>();
    }
  }, [directive, onError, playback, response]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SigmaContainer<SigmaNodeAttributes, SigmaEdgeAttributes>
        graph={graph}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
        settings={{
          allowInvalidContainer: true,
          defaultNodeType: 'circle',
          defaultEdgeType: 'line',
          renderLabels: true,
          labelColor: { color: '#E8E5E0' },
          labelFont: 'IBM Plex Sans',
          labelSize: 14,
        }}
      >
        <SigmaGraph
          directive={directive}
          graph={graph}
          onSelectNode={onSelectNode}
          onHoverNodeChange={setHoveredNode}
        />
      </SigmaContainer>

      {hoveredNode && (
        <div
          style={{
            position: 'absolute',
            left: 24,
            bottom: 24,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(15,16,18,0.82)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#E8E5E0',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 12,
            pointerEvents: 'none',
          }}
        >
          {hoveredNode}
        </div>
      )}
    </div>
  );
}
