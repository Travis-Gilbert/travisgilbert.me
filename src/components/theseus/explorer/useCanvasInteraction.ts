'use client';

import { useCallback, useRef } from 'react';
import type { ExplorerNode } from './useGraphData';

export interface CanvasTransform {
  zoom: number;
  rotation: number;
  cx: number;
  cy: number;
}

export interface UseCanvasInteractionReturn {
  /** Convert screen coords to graph coords (inverse of zoom + rotation). */
  screenToGraph: (screenX: number, screenY: number, transform: CanvasTransform) => { x: number; y: number };
  /** Find nearest node within hitRadius px of graph coords. */
  findNearestNode: (gx: number, gy: number, nodes: ExplorerNode[], w: number, h: number, hitRadius?: number) => ExplorerNode | null;
  /** Handle mouse move: update mouseRef, return hovered node. */
  handleMouseMove: (
    e: React.MouseEvent,
    wrapperRect: DOMRect,
    nodes: ExplorerNode[],
    w: number,
    h: number,
    transform: CanvasTransform,
  ) => ExplorerNode | null;
  /** Handle click: return clicked node or null (deselect). */
  handleClick: (
    e: React.MouseEvent,
    wrapperRect: DOMRect,
    nodes: ExplorerNode[],
    w: number,
    h: number,
    transform: CanvasTransform,
  ) => ExplorerNode | null;
  /** Current mouse position in graph coords. */
  mouseRef: React.MutableRefObject<{ x: number; y: number }>;
}

export function useCanvasInteraction(): UseCanvasInteractionReturn {
  const mouseRef = useRef({ x: -9999, y: -9999 });

  const screenToGraph = useCallback(
    (screenX: number, screenY: number, transform: CanvasTransform) => {
      const { zoom, rotation, cx, cy } = transform;
      // Inverse of: translate(cx,cy) -> scale(zoom) -> rotate(rotation) -> translate(-cx,-cy)
      const zoomedX = (screenX - cx) / zoom;
      const zoomedY = (screenY - cy) / zoom;
      const rot = -rotation;
      const graphX = cx + zoomedX * Math.cos(rot) - zoomedY * Math.sin(rot);
      const graphY = cy + zoomedX * Math.sin(rot) + zoomedY * Math.cos(rot);
      return { x: graphX, y: graphY };
    },
    [],
  );

  const findNearestNode = useCallback(
    (gx: number, gy: number, nodes: ExplorerNode[], w: number, h: number, hitRadius = 15) => {
      let closest: ExplorerNode | null = null;
      let closestDist = hitRadius;

      for (const node of nodes) {
        // Node positions are normalized [0,1]; scale to canvas size
        const nx = node.x * w;
        const ny = node.y * h;
        const dx = gx - nx;
        const dy = gy - ny;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) {
          closestDist = dist;
          closest = node;
        }
      }

      return closest;
    },
    [],
  );

  const handleMouseMove = useCallback(
    (
      e: React.MouseEvent,
      wrapperRect: DOMRect,
      nodes: ExplorerNode[],
      w: number,
      h: number,
      transform: CanvasTransform,
    ) => {
      const screenX = e.clientX - wrapperRect.left;
      const screenY = e.clientY - wrapperRect.top;
      const { x: gx, y: gy } = screenToGraph(screenX, screenY, transform);
      mouseRef.current = { x: gx, y: gy };
      return findNearestNode(gx, gy, nodes, w, h);
    },
    [screenToGraph, findNearestNode],
  );

  const handleClick = useCallback(
    (
      e: React.MouseEvent,
      wrapperRect: DOMRect,
      nodes: ExplorerNode[],
      w: number,
      h: number,
      transform: CanvasTransform,
    ) => {
      const screenX = e.clientX - wrapperRect.left;
      const screenY = e.clientY - wrapperRect.top;
      const { x: gx, y: gy } = screenToGraph(screenX, screenY, transform);
      return findNearestNode(gx, gy, nodes, w, h);
    },
    [screenToGraph, findNearestNode],
  );

  return {
    screenToGraph,
    findNearestNode,
    handleMouseMove,
    handleClick,
    mouseRef,
  };
}
