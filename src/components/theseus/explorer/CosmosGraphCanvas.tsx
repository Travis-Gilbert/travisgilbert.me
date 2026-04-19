'use client';

import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { Graph } from '@cosmos.gl/graph';
import type { GraphConfig } from '@cosmos.gl/graph';
import { hexToRgb } from '@/hooks/useThemeColor';
import { DEFAULT_POINT_COLOR, type CosmoLink, type CosmoPoint } from './useGraphData';
import type { GraphAdapter } from '@/lib/theseus/cosmograph/adapter';

export interface CosmosGraphCanvasProps {
  points: CosmoPoint[];
  links: CosmoLink[];
  /** Optional pinned XY positions keyed by point id. Providing this
   *  disables the force simulation and pins every matching point (SBERT /
   *  KGE / GeoGCN / spacetime layer projections). */
  pinnedPositions?: Record<string, [number, number]> | null;
  onPointClick?: (pointId: string | null) => void;
  onReady?: (graph: Graph) => void;
}

export type CosmosGraphCanvasHandle = GraphAdapter;

function hexToRgbaFloats(hex: string, alpha = 1): [number, number, number, number] {
  try {
    const [r, g, b] = hexToRgb(hex);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      throw new Error('nan');
    }
    return [r / 255, g / 255, b / 255, alpha];
  } catch {
    const [dr, dg, db] = hexToRgb(DEFAULT_POINT_COLOR);
    return [dr / 255, dg / 255, db / 255, alpha];
  }
}

/**
 * React wrapper around the cosmos.gl `Graph` class. Points and links are
 * flat Float32Arrays; this wrapper converts the JS object arrays from
 * `useGraphData` and pushes them via the imperative API.
 */
const CosmosGraphCanvas = forwardRef<CosmosGraphCanvasHandle, CosmosGraphCanvasProps>(
  function CosmosGraphCanvas({ points, links, pinnedPositions, onPointClick, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const graphRef = useRef<Graph | null>(null);
    const onPointClickRef = useRef(onPointClick);
    const onReadyRef = useRef(onReady);
    const indexToIdRef = useRef<string[]>([]);
    const idToIndexRef = useRef<Map<string, number>>(new Map());
    const latestDataRef = useRef({
      points: [] as CosmoPoint[],
      links: [] as CosmoLink[],
      pinnedPositions: null as Record<string, [number, number]> | null | undefined,
    });

    onPointClickRef.current = onPointClick;
    onReadyRef.current = onReady;
    latestDataRef.current = { points, links, pinnedPositions };

    const { idToIndex, indexToId } = useMemo(() => {
      const map = new Map<string, number>();
      points.forEach((p, i) => map.set(p.id, i));
      return { idToIndex: map, indexToId: points.map((p) => p.id) };
    }, [points]);

    idToIndexRef.current = idToIndex;
    indexToIdRef.current = indexToId;

    useImperativeHandle(
      ref,
      (): CosmosGraphCanvasHandle => ({
        focusNodes(ids: string[]) {
          const graph = graphRef.current;
          if (!graph) return;
          const indices = ids
            .map((id) => idToIndexRef.current.get(id))
            .filter((i): i is number => typeof i === 'number');
          if (indices.length > 0) {
            graph.selectPointsByIndices(indices);
          } else {
            graph.unselectPoints();
          }
        },
        clearFocus() {
          graphRef.current?.unselectPoints();
        },
        zoomToNode(id, durationMs, distance) {
          const graph = graphRef.current;
          const idx = idToIndexRef.current.get(id);
          if (!graph || typeof idx !== 'number') return;
          graph.zoomToPointByIndex(idx, durationMs, distance);
        },
        fitView(durationMs = 400, padding = 0.12) {
          graphRef.current?.fitView(durationMs, padding, true);
        },
      }),
      [],
    );

    const pushDataToGraph = () => {
      const graph = graphRef.current;
      const { points: pts, links: lks, pinnedPositions: pinned } = latestDataRef.current;
      if (!graph || pts.length === 0) return;

      const pointCount = pts.length;
      const positions = new Float32Array(pointCount * 2);
      const pinnedIndices: number[] = [];
      // Spread the random seed positions wider than the default 1024×1024
      // so the force simulation doesn't start as a tight overlap. Scale
      // with node count so very large graphs still land in one viewport.
      const space = Math.max(2200, Math.sqrt(pointCount) * 90);
      for (let i = 0; i < pointCount; i++) {
        const id = pts[i].id;
        const fixed = pinned?.[id];
        if (fixed) {
          positions[i * 2] = fixed[0];
          positions[i * 2 + 1] = fixed[1];
          pinnedIndices.push(i);
        } else {
          positions[i * 2] = (Math.random() - 0.5) * space;
          positions[i * 2 + 1] = (Math.random() - 0.5) * space;
        }
      }

      const colors = new Float32Array(pointCount * 4);
      for (let i = 0; i < pointCount; i++) {
        const [r, g, b, a] = hexToRgbaFloats(pts[i].colorHex, 1);
        colors[i * 4] = r;
        colors[i * 4 + 1] = g;
        colors[i * 4 + 2] = b;
        colors[i * 4 + 3] = a;
      }

      const sizes = new Float32Array(pointCount);
      const maxDegree = pts.reduce((m, p) => Math.max(m, p.degree), 1);
      for (let i = 0; i < pointCount; i++) {
        const d = pts[i].degree;
        const norm = d > 0 ? Math.sqrt(d / maxDegree) : 0;
        sizes[i] = 6 + norm * 30;
      }

      const indexMap = idToIndexRef.current;
      let validLinkCount = 0;
      for (const link of lks) {
        if (indexMap.has(link.source) && indexMap.has(link.target)) validLinkCount++;
      }
      const linksArray = new Float32Array(validLinkCount * 2);
      const linkWidthsArray = new Float32Array(validLinkCount);
      let li = 0;
      for (const link of lks) {
        const src = indexMap.get(link.source);
        const tgt = indexMap.get(link.target);
        if (src === undefined || tgt === undefined) continue;
        linksArray[li * 2] = src;
        linksArray[li * 2 + 1] = tgt;
        linkWidthsArray[li] = 0.5 + link.weight * 1.5;
        li++;
      }

      graph.setPointPositions(positions);
      graph.setPointColors(colors);
      graph.setPointSizes(sizes);
      graph.setLinks(linksArray);
      graph.setLinkWidths(linkWidthsArray);
      graph.setPinnedPoints(pinnedIndices.length > 0 ? pinnedIndices : null);

      // The onSimulationEnd config callback re-fits the view once the
      // force sim settles; calling fitView() at frame 0 would anchor the
      // viewport to the random seed positions and drift out of frame.
      const allPinned = pinnedIndices.length === pointCount;
      if (allPinned) {
        graph.render(0);
      } else {
        graph.render(1);
        graph.start?.(1);
      }
    };

    // luma.gl's `autoResize` captures the canvas's initial clientWidth at
    // construction time; if we instantiate Graph during the React commit
    // before the grid layout resolves, autoResize locks onto 0 and never
    // recovers. Observe the container ourselves and delay Graph
    // construction until it has real pixels.
    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let cancelled = false;
      let graph: Graph | null = null;
      let resizeObserver: ResizeObserver | null = null;

      const config: GraphConfig = {
        backgroundColor: [0, 0, 0, 0],
        spaceSize: 4096,
        pointDefaultColor: DEFAULT_POINT_COLOR,
        pointDefaultSize: 10,
        pointSizeScale: 1.6,
        linkDefaultColor: [0.72, 0.62, 0.52, 0.55],
        linkDefaultWidth: 1.2,
        linkOpacity: 0.7,
        renderLinks: true,
        renderHoveredPointRing: true,
        hoveredPointRingColor: [1, 0.64, 0.38, 1],
        hoveredPointCursor: 'pointer',
        enableDrag: true,
        enableZoom: true,
        fitViewOnInit: true,
        fitViewDelay: 800,
        fitViewPadding: 0.2,
        simulationRepulsion: 1.6,
        simulationGravity: 0.02,
        simulationCenter: 0.2,
        simulationLinkSpring: 0.6,
        simulationLinkDistance: 28,
        simulationFriction: 0.9,
        simulationDecay: 8000,
        scalePointsOnZoom: true,
        onSimulationEnd: () => {
          graphRef.current?.fitView?.(600, 0.18, false);
        },
        onClick: (index) => {
          const cb = onPointClickRef.current;
          if (!cb) return;
          if (typeof index !== 'number') {
            cb(null);
            return;
          }
          cb(indexToIdRef.current[index] ?? null);
        },
      };

      const construct = () => {
        if (cancelled || graph) return;
        graph = new Graph(container, config);
        graphRef.current = graph;
        graph.ready.then(() => {
          if (!cancelled && graphRef.current === graph && graph) {
            onReadyRef.current?.(graph);
          }
        });
        pushDataToGraph();
      };

      const initialRect = container.getBoundingClientRect();
      if (initialRect.width > 0 && initialRect.height > 0) {
        construct();
      } else {
        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && !graph) {
            construct();
            resizeObserver?.disconnect();
            resizeObserver = null;
          }
        });
        resizeObserver.observe(container);
      }

      return () => {
        cancelled = true;
        graphRef.current = null;
        resizeObserver?.disconnect();
        graph?.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-push when data identity changes. We read from refs inside
    // `pushDataToGraph`, so this effect only needs the triggers as deps.
    useLayoutEffect(() => {
      if (graphRef.current) pushDataToGraph();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points, links, pinnedPositions]);

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      />
    );
  },
);

export default CosmosGraphCanvas;
