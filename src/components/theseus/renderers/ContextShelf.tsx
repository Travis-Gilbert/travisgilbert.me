'use client';

import { useMemo, useState } from 'react';
import ForceGraph3D, { type GraphData } from 'react-force-graph-3d';
import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import { createNodeObject } from './NodeMesh';
import {
  buildRendererGraph,
  getNodeRevealProgress,
  type ConstructionPlayback,
} from './rendering';

interface ContextShelfProps {
  directive: SceneDirective;
  response: TheseusResponse;
  playback: ConstructionPlayback;
  onSelectNode?: (nodeId: string) => void;
}

function getViewport() {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 720 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

export default function ContextShelf({
  directive,
  response,
  playback,
  onSelectNode,
}: ContextShelfProps) {
  const [viewport] = useState(getViewport);
  const { nodes, edges } = useMemo(
    () => buildRendererGraph(response, directive),
    [directive, response],
  );

  const anchors = directive.context_shelf.anchor_nodes.slice(0, 6);
  if (!directive.context_shelf.enabled || anchors.length === 0) {
    return null;
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const anchorIds = new Set(anchors.map((anchor) => anchor.node_id));
  const shelfNodes = anchors
    .map((anchor, index) => {
      const node = nodeLookup.get(anchor.node_id);
      if (!node) return null;

      const reveal = getNodeRevealProgress(node.id, directive, playback);
      const shelfPosition = directive.context_shelf.shelf_position;
      const leftLayout = shelfPosition === 'left';
      const count = anchors.length;
      const offset = count <= 1 ? 0 : index - (count - 1) / 2;

      return {
        ...node,
        anchorLabel: anchor.anchor_label,
        x: leftLayout ? -4 : offset * 2.5,
        y: leftLayout ? offset * -2.2 : 2.6,
        z: leftLayout ? 0 : offset * 0.4,
        fx: leftLayout ? -4 : offset * 2.5,
        fy: leftLayout ? offset * -2.2 : 2.6,
        fz: leftLayout ? 0 : offset * 0.4,
        __threeObject: createNodeObject({
          ...node,
          baseScale: node.baseScale * 0.8 * Math.max(0.3, reveal),
          opacity: node.opacity * Math.max(0.3, reveal),
          emissive: node.emissive * Math.max(0.3, reveal),
        }, true),
      };
    })
    .filter((node): node is NonNullable<typeof node> => Boolean(node));

  const shelfEdges = edges
    .filter((edge) => anchorIds.has(edge.source) && anchorIds.has(edge.target))
    .map((edge) => ({
      ...edge,
      source: edge.source,
      target: edge.target,
      width: edge.width * 0.8,
    }));

  const wrapperStyle = directive.context_shelf.shelf_position === 'left'
    ? {
        position: 'absolute' as const,
        inset: '0 auto 0 0',
        width: '25vw',
        height: '100vh',
        zIndex: 6,
      }
    : {
        position: 'absolute' as const,
        inset: '0 0 auto 0',
        width: '100vw',
        height: '20vh',
        zIndex: 6,
      };

  const graphWidth = directive.context_shelf.shelf_position === 'left'
    ? Math.max(240, Math.round(viewport.width * 0.25))
    : viewport.width;
  const graphHeight = directive.context_shelf.shelf_position === 'left'
    ? viewport.height
    : Math.max(160, Math.round(viewport.height * 0.2));

  const linePositions = anchors.map((_anchor, index) => {
    const count = anchors.length;
    if (directive.context_shelf.shelf_position === 'left') {
      const spacing = graphHeight / Math.max(count, 1);
      return {
        x1: graphWidth * 0.68,
        y1: spacing * index + spacing * 0.5,
        x2: graphWidth,
        y2: spacing * index + spacing * 0.5,
      };
    }

    const spacing = graphWidth / Math.max(count, 1);
    return {
      x1: spacing * index + spacing * 0.5,
      y1: graphHeight * 0.68,
      x2: spacing * index + spacing * 0.5,
      y2: graphHeight,
    };
  });

  return (
    <div style={wrapperStyle}>
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        {linePositions.map((line, index) => (
          <line
            key={`${anchors[index].node_id}-line`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(74,138,150,0.42)"
            strokeDasharray="6 6"
            strokeWidth="1.4"
          />
        ))}
      </svg>

      <ForceGraph3D
        width={graphWidth}
        height={graphHeight}
        backgroundColor="rgba(0,0,0,0)"
        graphData={{
          nodes: shelfNodes,
          links: shelfEdges,
        } as GraphData}
        nodeThreeObject={(node) => node.__threeObject}
        linkWidth={(link) => link.width}
        linkColor={(link) => link.color}
        linkOpacity={0.26}
        cooldownTicks={0}
        showNavInfo={false}
        enableNavigationControls={false}
        onNodeClick={(node) => onSelectNode?.(String(node.id))}
      />

      {anchors.map((anchor, index) => (
        <div
          key={`${anchor.node_id}-label`}
          style={
            directive.context_shelf.shelf_position === 'left'
              ? {
                  position: 'absolute' as const,
                  right: 16,
                  top: `${(index + 0.5) * (100 / anchors.length)}%`,
                  transform: 'translateY(-50%)',
                  maxWidth: '11rem',
                  color: '#E8E5E0',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 11,
                  lineHeight: 1.45,
                  textAlign: 'right' as const,
                  pointerEvents: 'none' as const,
                }
              : {
                  position: 'absolute' as const,
                  left: `${(index + 0.5) * (100 / anchors.length)}%`,
                  bottom: 10,
                  transform: 'translateX(-50%)',
                  maxWidth: '10rem',
                  color: '#E8E5E0',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 11,
                  lineHeight: 1.45,
                  textAlign: 'center' as const,
                  pointerEvents: 'none' as const,
                }
          }
        >
          {anchor.anchor_label}
        </div>
      ))}
    </div>
  );
}
