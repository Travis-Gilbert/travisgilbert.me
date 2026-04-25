'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import { Graph, defaultConfigValues } from '@cosmos.gl/graph';
import type { GraphConfig } from '@cosmos.gl/graph';
import {
  cssVarToRgba,
  mixTowardTokenRgba,
  resolveTypeColor,
  resolveTypeColorRgba,
  resetTypeColorCache,
} from '@/lib/theseus/cosmograph/typeColors';
import {
  buildClusterContext,
  resolveClusterOrdinal,
  resolveHybridClusterColorRgba,
  resetClusterColorCache,
  type ClusterContext,
} from '@/lib/theseus/cosmograph/clusterColors';
import { readCssVar, useThemeVersion } from '@/hooks/useThemeColor';
import {
  buildAdjacencyFromLinks,
  bfsHopsFromSeeds,
} from '@/lib/theseus-viz/features/graphUtils';
import type {
  FocalLabel,
  GraphAdapter,
  NeighborhoodTiers,
} from '@/lib/theseus/cosmograph/adapter';
import type {
  ConstructionPhase,
  ConstructionSequence,
  HypothesisEdgeStyle,
  NodeSalience,
} from '@/lib/theseus-viz/SceneDirective';
import { type CosmoLink, type CosmoPoint } from './useGraphData';
import { renderLabelToCanvas } from '@/lib/theseus/pretext/canvas';
import { LABEL_FONT, LABEL_LINE_HEIGHT } from '@/lib/theseus/pretext/fonts';
import { rotateColorsGlobally } from '@/lib/theseus/graph/chromaticRotation';
import { assignFlowGradient } from '@/lib/theseus/graph/flowColors';
import {
  computeClusterHulls,
  type ClusterHull,
} from '@/lib/theseus/graph/clusterHulls';
import rough from 'roughjs';
import type { LensId } from '@/lib/theseus-viz/SceneDirective';

export interface CosmosGraphCanvasProps {
  points: CosmoPoint[];
  links: CosmoLink[];
  /** Optional pinned XY positions keyed by point id. Providing this
   *  disables the force simulation and pins every matching point (SBERT /
   *  KGE / GeoGCN / spacetime layer projections). */
  pinnedPositions?: Record<string, [number, number]> | null;
  onPointClick?: (pointId: string | null) => void;
  /** Fires within DOUBLE_CLICK_MS of a previous click on the same point.
   *  Used by SimulationPart to trigger /api/v2/theseus/explain_node/. */
  onPointDoubleClick?: (pointId: string) => void;
  /** Fires on drag gesture frames after the threshold is crossed.
   *  SimulationPart listens to compute remove intent. */
  onPointDragStart?: (pointId: string) => void;
  /** Fires on pointer-up after a drag. finalPosition is screen-space
   *  relative to the canvas; null when cosmos.gl can't report a position.
   *  When the drag delta exceeds DRAG_REMOVE_THRESHOLD_PX, the canvas
   *  also fires onPointRemoveRequested. */
  onPointDragEnd?: (pointId: string, finalPosition: [number, number] | null) => void;
  /** Fires when a drag gesture exceeds DRAG_REMOVE_THRESHOLD_PX.
   *  SimulationPart consumes this to remove the primitive via
   *  adapter.replaceScene(). */
  onPointRemoveRequested?: (pointId: string) => void;
  onReady?: (graph: Graph) => void;
  /** When false, the overlay canvas is cleared every frame but no
   *  focal labels are drawn. Defaults to true. */
  labelsOn?: boolean;
}

/** Screen-space drag distance past which the canvas interprets a gesture
 *  as a remove-from-scene request. Tuned so casual pans don't strip nodes
 *  but an intentional fling off the card does. Matches spec §What shipping
 *  looks like ("drags something out"). */
const DRAG_REMOVE_THRESHOLD_PX = 120;

/** Window in ms during which a second click on the same point fires
 *  onPointDoubleClick. Outside this window the second click is a fresh
 *  single click instead. Matches browser default dblclick expectations. */
const DOUBLE_CLICK_MS = 320;

export type CosmosGraphCanvasHandle = GraphAdapter;

// --- Buffer pools -------------------------------------------------------
//
// cosmos.gl consumes Float32Array buffers for positions, colors, sizes,
// links, link widths, and link colors. Allocating fresh typed arrays on
// every directive update fragments GC; we pool by exact element count,
// clearing entries when the count changes (which is rare: only on a new
// dataset load).

interface BufferPool {
  pointCount: number;
  linkCount: number;
  linkEndpoints: Int32Array;         // 2 entries per valid link: [srcIndex, dstIndex]
  baseColors: Float32Array;
  baseSizes: Float32Array;
  colors: Float32Array;               // Live colors (post-encoding + filter).
  encodedColors: Float32Array;        // Colors before the filter mask is applied.
  sizes: Float32Array;                // Live sizes (written by tween + filter).
  encodedSizes: Float32Array;         // Post-salience target sizes.
  baseLinkWidths: Float32Array;
  baseLinkColors: Float32Array;
  linkWidths: Float32Array;
  linkColors: Float32Array;
  encodedLinkWidths: Float32Array;    // Link widths before filter mask is applied.
  encodedLinkColors: Float32Array;    // Link colors before filter mask is applied.
  // Construction tween scratch. Populated at phase start with the pool's
  // current state; the tween lerps from these toward the encoded*
  // buffers. Allocated once at pool init.
  tweenStartColors: Float32Array;
  tweenStartSizes: Float32Array;
  tweenStartLinkWidths: Float32Array;
  tweenStartLinkColors: Float32Array;
  // Per-point filter mask (1 = visible, 0 = filtered). `null` filter
  // state is represented by all-1s. Same length as pointCount.
  filterMask: Uint8Array;
  filterActive: boolean;
  /** Scratch target for within-cluster chromatic rotation (RGBA per point). */
  rotationScratch: Float32Array;
  /** Scratch target for Flow-lens position rotation (x/y per point).
   *  Pre-allocated so the onSimulationTick handler never churns GC. */
  rotationPositionScratch: Float32Array;
  /** Per-point Leiden community id, populated during pushDataToGraph.
   *  -1 means "no cluster" (sentinel used by rotateColorsWithinClusters). */
  clusterIds: Int32Array;
  // --- Orbit-lens fields (populated on setLens('orbit')) -------------
  /** Per-point solar-system center: cluster centroid coordinates. */
  orbitCenters: Float32Array;
  /** Per-point orbital radius (distance from centroid at lens entry). */
  orbitRadii: Float32Array;
  /** Per-point orbital phase in radians (atan2 at lens entry). */
  orbitPhases: Float32Array;
  /** Per-point angular velocity in radians per second. Slower for
   *  larger radii (Kepler-ish), plus a small per-point jitter so
   *  points on the same orbital ring don't lock into a rigid wheel. */
  orbitOmegas: Float32Array;
  /** Per-point eccentricity. 0 = circular orbit, approaching 1 =
   *  highly elliptical. Each point has its own value so no two
   *  orbits are the same shape. */
  orbitEccentricities: Float32Array;
  /** Per-point initial orbit-plane tilt in radians. The major axis
   *  of each ellipse points in this direction at t=0. */
  orbitTilts: Float32Array;
  /** Per-point precession rate in radians per second. The orbit's
   *  major axis rotates around the centroid at this rate, so even
   *  identical orbits would drift out of alignment over time. */
  orbitPrecessions: Float32Array;
  /** performance.now() timestamp captured at orbit-lens entry. Phase
   *  advances by omega * (now - orbitT0) / 1000 so motion scales
   *  with real time and does not hiccup when the sim tick rate
   *  briefly drops. */
  orbitT0: number;
}

function makeBufferPool(pointCount: number, linkCount: number): BufferPool {
  const filterMask = new Uint8Array(pointCount);
  filterMask.fill(1);
  return {
    pointCount,
    linkCount,
    linkEndpoints: new Int32Array(linkCount * 2),
    baseColors: new Float32Array(pointCount * 4),
    baseSizes: new Float32Array(pointCount),
    colors: new Float32Array(pointCount * 4),
    encodedColors: new Float32Array(pointCount * 4),
    sizes: new Float32Array(pointCount),
    encodedSizes: new Float32Array(pointCount),
    baseLinkWidths: new Float32Array(linkCount),
    baseLinkColors: new Float32Array(linkCount * 4),
    linkWidths: new Float32Array(linkCount),
    linkColors: new Float32Array(linkCount * 4),
    encodedLinkWidths: new Float32Array(linkCount),
    encodedLinkColors: new Float32Array(linkCount * 4),
    tweenStartColors: new Float32Array(pointCount * 4),
    tweenStartSizes: new Float32Array(pointCount),
    tweenStartLinkWidths: new Float32Array(linkCount),
    tweenStartLinkColors: new Float32Array(linkCount * 4),
    filterMask,
    filterActive: false,
    rotationScratch: new Float32Array(pointCount * 4),
    rotationPositionScratch: new Float32Array(pointCount * 2),
    clusterIds: new Int32Array(pointCount),
    orbitCenters: new Float32Array(pointCount * 2),
    orbitRadii: new Float32Array(pointCount),
    orbitPhases: new Float32Array(pointCount),
    orbitOmegas: new Float32Array(pointCount),
    orbitEccentricities: new Float32Array(pointCount),
    orbitTilts: new Float32Array(pointCount),
    orbitPrecessions: new Float32Array(pointCount),
    orbitT0: 0,
  };
}

// --- Construction tween -------------------------------------------------

/** Scoped target for a single construction phase. `colors`, `sizes`,
 *  `linkWidths`, `linkColors` reference the pool's encoded target buffers;
 *  `startColors` etc. are the pool's tween-start scratch. A phase tween
 *  linearly interpolates each index between start and target over its
 *  duration. */
type EasingFn = (t: number) => number;

const EASING: Record<string, EasingFn> = {
  'ease-out': (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out': (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  'linear': (t) => t,
  // Soft cosmic overshoot for 'spring'; keeps everything within 0..1 so
  // we never drive buffers past their encoded targets.
  'spring': (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
};

function getEasing(name: string): EasingFn {
  return EASING[name] ?? EASING.linear;
}

function formatPrimitiveTooltip(
  entry: {
    metadata: Record<string, number | string | boolean>;
    displayKeys?: string[];
  } | null | undefined,
): string {
  if (!entry) return '';
  const keys = entry.displayKeys && entry.displayKeys.length > 0
    ? entry.displayKeys
    : Object.keys(entry.metadata);
  const lines: string[] = [];
  for (const key of keys) {
    const value = entry.metadata[key];
    if (value === undefined) continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      lines.push(`${key}: ${value % 1 === 0 ? value : value.toFixed(2)}`);
      continue;
    }
    if (typeof value === 'boolean') {
      lines.push(`${key}: ${value ? 'yes' : 'no'}`);
      continue;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join('\n');
}

// --- Component ----------------------------------------------------------

/**
 * React wrapper around the cosmos.gl `Graph` class. Points and links are
 * flat Float32Arrays; this wrapper converts the JS object arrays from
 * `useGraphData` and pushes them via the imperative API. All directive
 * setters live here; callers reach the rendering layer only through the
 * `GraphAdapter` interface exposed on the forwarded ref.
 */
const CosmosGraphCanvas = forwardRef<CosmosGraphCanvasHandle, CosmosGraphCanvasProps>(
  function CosmosGraphCanvas(
    {
      points,
      links,
      pinnedPositions,
      onPointClick,
      onPointDoubleClick,
      onPointDragStart,
      onPointDragEnd,
      onPointRemoveRequested,
      onReady,
      labelsOn = true,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const graphRef = useRef<Graph | null>(null);
    const onPointClickRef = useRef(onPointClick);
    const onPointDoubleClickRef = useRef(onPointDoubleClick);
    const onPointDragStartRef = useRef(onPointDragStart);
    const onPointDragEndRef = useRef(onPointDragEnd);
    const onPointRemoveRequestedRef = useRef(onPointRemoveRequested);
    const onReadyRef = useRef(onReady);
    const labelsOnRef = useRef<boolean>(labelsOn);
    // Zoom subscription plumbing. Lives next to the Graph instance so
    // the adapter can broadcast to multiple listeners without tying
    // into React state each tick.
    const zoomListenersRef = useRef<Set<(zoom: number) => void>>(new Set());
    const indexToIdRef = useRef<string[]>([]);
    const idToIndexRef = useRef<Map<string, number>>(new Map());
    const latestDataRef = useRef({
      points: [] as CosmoPoint[],
      links: [] as CosmoLink[],
      pinnedPositions: null as Record<string, [number, number]> | null | undefined,
    });

    const poolRef = useRef<BufferPool | null>(null);
    const adjacencyRef = useRef<Map<string, Set<string>>>(new Map());
    const currentSalienceRef = useRef<Map<string, NodeSalience>>(new Map());
    // Count of distinct non-null leiden_community values in the current
    // point set. Stable across encoding passes: only rewritten when a
    // fresh dataset is pushed. Zero triggers the pending-visual branch
    // for every node (honest empty state per claim M7).
    const clusterContextRef = useRef<ClusterContext>({
      leidenOrdinal: new Map(),
      kCoreOrdinal: new Map(),
      totalOrdinals: 0,
    });
    const encodingActiveRef = useRef(false);
    const focalLabelsRef = useRef<FocalLabel[]>([]);
    const overlayAnimRef = useRef<number | null>(null);
    /** Orbit-lens animation handle. The Orbit lens runs its own rAF
     *  loop (independent of cosmos.gl's onSimulationTick) so motion
     *  is guaranteed smooth at vsync regardless of how often the sim
     *  itself ticks. Null when the loop is not running. */
    const orbitRafRef = useRef<number | null>(null);
    // Hypothesis color-mix factor applied on top of encoded colors. Kept
    // on a ref so theme-flip re-encodes can reapply without plumbing the
    // value through adapter calls.
    const hypothesisMixFactorRef = useRef(0);
    const primitiveMetadataRef = useRef(new Map<string, {
      metadata: Record<string, number | string | boolean>;
      displayKeys?: string[];
    }>());
    const lastClickRef = useRef<{ id: string; at: number } | null>(null);
    const dragStateRef = useRef<{
      pointId: string;
      startedAt: [number, number];
    } | null>(null);
    const pushDataToGraphRef = useRef<(() => void) | null>(null);

    /** Chromatic rotation pacing. 1 means rotate every tick (fastest);
     *  higher values slow the flow. Set to 90 (~1.5s at 60fps) under
     *  prefers-reduced-motion. */
    const rotationEveryNTicksRef = useRef<number>(1);
    const tickCounterRef = useRef<number>(0);

    /** Active Explorer lens. Gates chromatic rotation (Flow only) and
     *  other lens-specific behavior. `setLens` updates this ref and
     *  reshapes the live buffer state. */
    const lensRef = useRef<LensId>('flow');
    /** Scratch buffer that holds the Flow-lens-rotated colors so we can
     *  restore them when switching back from Atlas. Allocated lazily on
     *  first lens switch. */
    const flowColorsSnapshotRef = useRef<Float32Array | null>(null);
    /** Current points, mirrored into a ref so setLens('clusters') can
     *  resolve dominant object_type per Leiden community without
     *  threading props through the imperative handle. */
    const pointsRef = useRef<CosmoPoint[]>(points);
    pointsRef.current = points;
    /** Cached Clusters-lens hulls in space coordinates. Recomputed each
     *  time the user enters the Clusters lens (positions are stable
     *  then, so the cache is valid until the next setLens call). */
    const clusterHullsRef = useRef<ClusterHull[]>([]);

    // --- Construction tween state ---------------------------------------
    //
    // `phaseTimers` stores queued phase kickoffs (setTimeout handles); the
    // active tween uses `rafHandle`. `finalCallback` fires exactly once on
    // natural completion or cancel. Start-value snapshots are taken at
    // each phase's kickoff so the interpolation begins from the pool's
    // current state (not whatever it was when the sequence was handed in).
    const constructionStateRef = useRef<{
      phaseTimers: number[];
      rafHandle: number | null;
      finalCallback: (() => void) | null;
      active: boolean;
    }>({ phaseTimers: [], rafHandle: null, finalCallback: null, active: false });

    // --- Ambient idle breathing ----------------------------------------
    //
    // Tracks the last wall-clock time the user interacted with the canvas
    // (hover, pan, zoom, click, ask submit). After ~10s of silence we enter
    // a subtle alpha-modulation breathing loop. Exits on any interaction.
    const lastInteractionAtRef = useRef<number>(Date.now());
    const ambientRafRef = useRef<number | null>(null);
    const ambientActiveRef = useRef(false);

    // Theme version bumps when the document theme flips. The CSS variables
    // referenced by resolveTypeColor get new resolved values under the new
    // theme; re-upload point+link colors to match.
    const themeVersion = useThemeVersion();

    onPointClickRef.current = onPointClick;
    onPointDoubleClickRef.current = onPointDoubleClick;
    onPointDragStartRef.current = onPointDragStart;
    onPointDragEndRef.current = onPointDragEnd;
    onPointRemoveRequestedRef.current = onPointRemoveRequested;
    onReadyRef.current = onReady;
    latestDataRef.current = { points, links, pinnedPositions };

    const { idToIndex, indexToId } = useMemo(() => {
      const map = new Map<string, number>();
      points.forEach((p, i) => map.set(p.id, i));
      return { idToIndex: map, indexToId: points.map((p) => p.id) };
    }, [points]);

    idToIndexRef.current = idToIndex;
    indexToIdRef.current = indexToId;

    // -------- Helpers on refs (stable across renders) ---------------------

    const writeBaselineColors = useCallback((pool: BufferPool, pts: CosmoPoint[]) => {
      // Hybrid color: leiden_community if present, else k_core_number as a
      // structural fallback, both on the same warm continuous ramp. Nodes
      // with neither signal fall through the resolver to the dim note
      // token at 60% alpha (claim M7 honest pending visual).
      const ctx = clusterContextRef.current;
      for (let i = 0; i < pts.length; i++) {
        const [r, g, b, a] = resolveHybridClusterColorRgba(
          pts[i],
          ctx,
          1,
          themeVersion,
        );
        const off = i * 4;
        pool.baseColors[off] = r;
        pool.baseColors[off + 1] = g;
        pool.baseColors[off + 2] = b;
        pool.baseColors[off + 3] = a;
        pool.colors[off] = r;
        pool.colors[off + 1] = g;
        pool.colors[off + 2] = b;
        pool.colors[off + 3] = a;
      }
    }, [themeVersion]);

    const writeBaselineSizes = useCallback((pool: BufferPool, pts: CosmoPoint[]) => {
      const maxDegree = pts.reduce((m, p) => Math.max(m, p.degree), 1);
      for (let i = 0; i < pts.length; i++) {
        const d = pts[i].degree;
        const norm = d > 0 ? Math.sqrt(d / maxDegree) : 0;
        const size = 6 + norm * 30;
        pool.baseSizes[i] = size;
        pool.sizes[i] = size;
      }
    }, []);

    const writeBaselineLinkStyles = useCallback((pool: BufferPool, lks: CosmoLink[], indexMap: Map<string, number>) => {
      // Flow-lens baseline edge tint: near-invisible backdrop hatching.
      // Hover / focus handlers promote incident edges to full alpha;
      // this is only the at-rest ambient layer.
      const linkTint = cssVarToRgba('--vie-text-dim', 0.08);
      let li = 0;
      for (const link of lks) {
        if (!indexMap.has(link.source) || !indexMap.has(link.target)) continue;
        const w = 0.4 + link.weight * 0.8;
        pool.baseLinkWidths[li] = w;
        pool.linkWidths[li] = w;
        const off = li * 4;
        pool.baseLinkColors[off] = linkTint[0];
        pool.baseLinkColors[off + 1] = linkTint[1];
        pool.baseLinkColors[off + 2] = linkTint[2];
        pool.baseLinkColors[off + 3] = linkTint[3];
        pool.linkColors[off] = linkTint[0];
        pool.linkColors[off + 1] = linkTint[1];
        pool.linkColors[off + 2] = linkTint[2];
        pool.linkColors[off + 3] = linkTint[3];
        li++;
      }
    }, []);

    // -------- Overlay (pretext labels) ------------------------------------

    const sizeOverlayToContainer = useCallback(() => {
      const container = containerRef.current;
      const overlay = overlayCanvasRef.current;
      if (!container || !overlay) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      const cw = Math.min(w, 8192);
      const ch = Math.min(h, 8192);
      const backingW = Math.min(cw * dpr, 8192);
      const backingH = Math.min(ch * dpr, 8192);
      if (overlay.width !== backingW) overlay.width = backingW;
      if (overlay.height !== backingH) overlay.height = backingH;
      overlay.style.width = `${cw}px`;
      overlay.style.height = `${ch}px`;
    }, []);

    const drawOverlay = useCallback(() => {
      const overlay = overlayCanvasRef.current;
      const graph = graphRef.current;
      if (!overlay || !graph) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      // Clusters lens: draw rough.js convex hulls around each Leiden
      // community plus a centroid label naming the dominant type.
      // spaceToScreenPosition returns buffer-pixel values (already
      // scaled for DPR), so we draw hulls + labels under an identity
      // transform, then restore the DPR transform for the focal-label
      // branch below. Only the top 20 largest clusters are labelled
      // to control overlap at overview zoom.
      if (lensRef.current === 'clusters' && clusterHullsRef.current.length > 0) {
        const rc = rough.canvas(overlay);
        const hullStroke = cssVarToRgba('--vie-terra', 1);
        const strokeColor = `rgba(${Math.round(hullStroke[0] * 255)},${Math.round(hullStroke[1] * 255)},${Math.round(hullStroke[2] * 255)},0.7)`;
        const fillColor = `rgba(${Math.round(hullStroke[0] * 255)},${Math.round(hullStroke[1] * 255)},${Math.round(hullStroke[2] * 255)},0.06)`;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const topHulls = clusterHullsRef.current.slice(0, 20);
        for (const hull of topHulls) {
          const screenHull: Array<[number, number]> = [];
          for (const [sx, sy] of hull.hullSpace) {
            const projected = graph.spaceToScreenPosition([sx, sy]);
            if (!projected) continue;
            screenHull.push([projected[0], projected[1]]);
          }
          if (screenHull.length >= 3) {
            rc.polygon(screenHull, {
              stroke: strokeColor,
              strokeWidth: 1.5,
              roughness: 2.0,
              bowing: 1.8,
              fill: fillColor,
              fillStyle: 'hachure',
              hachureGap: 14,
              hachureAngle: -30,
            });
          }
          const centerScreen = graph.spaceToScreenPosition(hull.centroidSpace);
          if (centerScreen) {
            const labelText = `${hull.dominantType.toUpperCase()} · ${hull.count}`;
            ctx.font = '500 22px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Soft halo so labels stay readable over hachure.
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'rgba(243, 239, 230, 0.85)';
            ctx.strokeText(labelText, centerScreen[0], centerScreen[1]);
            ctx.fillStyle = strokeColor;
            ctx.fillText(labelText, centerScreen[0], centerScreen[1]);
          }
        }
        ctx.restore();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // Labels toggle: clear the overlay every frame but skip label
      // rendering when the Atlas controls have hidden labels. Keeps
      // the overlay layer honest rather than caching stale text.
      if (!labelsOnRef.current) return;

      const labels = focalLabelsRef.current;
      if (labels.length === 0) return;

      const textColor = resolveTypeColor(undefined, themeVersion);
      const shadowColor = readCssVar('--color-shadow') || readCssVar('--color-ink-muted');
      // Positions are stable for the whole frame; read once, not per label.
      const positions = graph.getPointPositions();
      if (!positions) return;
      for (const label of labels) {
        const idx = idToIndexRef.current.get(label.nodeId);
        if (typeof idx !== 'number') continue;
        if (positions.length < (idx + 1) * 2) continue;
        const spaceX = positions[idx * 2];
        const spaceY = positions[idx * 2 + 1];
        const screen = graph.spaceToScreenPosition([spaceX, spaceY]);
        if (!screen) continue;
        const [sx, sy] = screen;
        const poolSize = poolRef.current?.sizes[idx] ?? 10;
        const labelY = sy + poolSize * 0.9 + 8;

        ctx.save();
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        renderLabelToCanvas(ctx, label.text, sx, labelY, {
          font: LABEL_FONT,
          lineHeight: LABEL_LINE_HEIGHT,
          color: textColor,
          maxWidth: 220,
          align: 'center',
          baseline: 'top',
        });
        ctx.restore();
      }
    }, [themeVersion]);

    const scheduleOverlayTick = useCallback(() => {
      if (overlayAnimRef.current != null) return;
      const tick = () => {
        overlayAnimRef.current = null;
        drawOverlay();
        if (focalLabelsRef.current.length > 0) {
          overlayAnimRef.current = requestAnimationFrame(tick);
        }
      };
      overlayAnimRef.current = requestAnimationFrame(tick);
    }, [drawOverlay]);

    // Labels toggle: mirror prop into the render-time ref, then force a
    // redraw so the overlay canvas reflects the new setting on the same
    // frame the prop changes. Running `drawOverlay` is cheap because it
    // just clears and returns when labels are off.
    useEffect(() => {
      const changed = labelsOnRef.current !== labelsOn;
      labelsOnRef.current = labelsOn;
      if (changed) drawOverlay();
    }, [labelsOn, drawOverlay]);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const apply = () => {
        rotationEveryNTicksRef.current = mq.matches ? 90 : 1;
      };
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }, []);

    // -------- Encoding setters (adapter implementations) -----------------

    const uploadColorsAndSizes = useCallback(() => {
      const graph = graphRef.current;
      const pool = poolRef.current;
      if (!graph || !pool) return;
      graph.setPointColors(pool.colors);
      graph.setPointSizes(pool.sizes);
    }, []);

    const uploadLinkStyles = useCallback(() => {
      const graph = graphRef.current;
      const pool = poolRef.current;
      if (!graph || !pool) return;
      graph.setLinkWidths(pool.linkWidths);
      graph.setLinkColors(pool.linkColors);
    }, []);

    // Apply pool.filterMask into the live `colors` buffer by zeroing
    // alpha on filtered points. Also walks valid link pairs and zeros
    // alpha on links whose endpoints are filtered. Call AFTER the
    // encoded buffers (`encodedColors`, `encodedLinkColors`) hold the
    // desired pre-filter state, and after `colors` has been set to the
    // encoded baseline.
    const applyFilterMaskToLive = useCallback(() => {
      const pool = poolRef.current;
      if (!pool) return;
      if (!pool.filterActive) return;
      const mask = pool.filterMask;
      for (let i = 0; i < pool.pointCount; i++) {
        if (mask[i] === 0) {
          pool.colors[i * 4 + 3] = 0;
        }
      }
      if (pool.linkCount === 0) return;
      for (let li = 0; li < pool.linkCount; li++) {
        const src = pool.linkEndpoints[li * 2];
        const dst = pool.linkEndpoints[li * 2 + 1];
        if (mask[src] === 0 || mask[dst] === 0) {
          pool.linkColors[li * 4 + 3] = 0;
        }
      }
    }, []);

    const applySalienceToPool = useCallback((salience: NodeSalience[]) => {
      const pool = poolRef.current;
      if (!pool) return;
      const bySalience = currentSalienceRef.current;
      bySalience.clear();
      for (const s of salience) {
        if (s && typeof s.node_id === 'string') bySalience.set(s.node_id, s);
      }

      const { points: pts } = latestDataRef.current;
      const offAlpha = bySalience.size > 0 ? 0.18 : 1.0;
      const offScale = bySalience.size > 0 ? 0.75 : 1.0;

      for (let i = 0; i < pts.length; i++) {
        const id = pts[i].id;
        const s = bySalience.get(id);
        const baseOff = i * 4;
        const br = pool.baseColors[baseOff];
        const bg = pool.baseColors[baseOff + 1];
        const bb = pool.baseColors[baseOff + 2];

        if (s) {
          const emissive = Math.max(0, Math.min(0.5, s.suggested_emissive ?? 0));
          const opacity = Math.max(0.2, Math.min(1, s.suggested_opacity ?? 1));
          const scale = Math.max(0.3, Math.min(2, s.suggested_scale ?? 1));
          const r = Math.min(1, br + emissive * (1 - br));
          const g = Math.min(1, bg + emissive * (1 - bg));
          const b = Math.min(1, bb + emissive * (1 - bb));
          pool.colors[baseOff] = r;
          pool.colors[baseOff + 1] = g;
          pool.colors[baseOff + 2] = b;
          pool.colors[baseOff + 3] = opacity;
          pool.sizes[i] = pool.baseSizes[i] * scale;
        } else {
          pool.colors[baseOff] = br;
          pool.colors[baseOff + 1] = bg;
          pool.colors[baseOff + 2] = bb;
          pool.colors[baseOff + 3] = offAlpha;
          pool.sizes[i] = pool.baseSizes[i] * offScale;
        }
      }

      // Mirror live -> encoded so subsequent gradient/color-mix calls
      // layer on top without losing the salience baseline. The encoded
      // buffer is the "target" for the filter-mask and tween pipelines.
      pool.encodedColors.set(pool.colors);
      pool.encodedSizes.set(pool.sizes);
      applyFilterMaskToLive();
      encodingActiveRef.current = true;
      uploadColorsAndSizes();
    }, [applyFilterMaskToLive, uploadColorsAndSizes]);

    const applyNeighborhoodToPool = useCallback((evidenceIds: string[], tiers: NeighborhoodTiers) => {
      const pool = poolRef.current;
      if (!pool) return;
      const { points: pts } = latestDataRef.current;
      const adj = adjacencyRef.current;
      if (pts.length === 0 || adj.size === 0) return;

      const evidenceSet = new Set<string>(evidenceIds.filter((id) => idToIndexRef.current.has(id)));
      if (evidenceSet.size === 0) return;

      const hops = bfsHopsFromSeeds(evidenceSet, adj, 2);
      const oneHop = hops.get(1) ?? new Set<string>();
      const twoHop = hops.get(2) ?? new Set<string>();

      for (let i = 0; i < pts.length; i++) {
        const id = pts[i].id;
        const off = i * 4 + 3;
        if (evidenceSet.has(id)) continue;
        const currentAlpha = pool.encodedColors[off];
        let tier = tiers.rest;
        if (oneHop.has(id)) tier = tiers.oneHop;
        else if (twoHop.has(id)) tier = tiers.twoHop;
        const dimmed = Math.min(1, currentAlpha * tier);
        pool.encodedColors[off] = dimmed;
        pool.colors[off] = dimmed;
      }

      applyFilterMaskToLive();
      encodingActiveRef.current = true;
      uploadColorsAndSizes();
    }, [applyFilterMaskToLive, uploadColorsAndSizes]);

    const applyHypothesisMixToPool = useCallback((mixFactor: number) => {
      const pool = poolRef.current;
      if (!pool) return;
      hypothesisMixFactorRef.current = Math.max(0, Math.min(1, mixFactor));
      if (hypothesisMixFactorRef.current === 0) return;
      const { points: pts } = latestDataRef.current;
      const m = hypothesisMixFactorRef.current;
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].epistemic_role !== 'hypothetical') continue;
        const off = i * 4;
        const base: [number, number, number, number] = [
          pool.encodedColors[off],
          pool.encodedColors[off + 1],
          pool.encodedColors[off + 2],
          pool.encodedColors[off + 3],
        ];
        const [r, g, b, a] = mixTowardTokenRgba(base, '--vie-amber', m, themeVersion);
        pool.encodedColors[off] = r;
        pool.encodedColors[off + 1] = g;
        pool.encodedColors[off + 2] = b;
        pool.encodedColors[off + 3] = a;
        pool.colors[off] = r;
        pool.colors[off + 1] = g;
        pool.colors[off + 2] = b;
        pool.colors[off + 3] = a;
      }
      applyFilterMaskToLive();
      encodingActiveRef.current = true;
      uploadColorsAndSizes();
    }, [applyFilterMaskToLive, themeVersion, uploadColorsAndSizes]);

    const applyEdgeStylesToPool = useCallback((
      styles: HypothesisEdgeStyle[],
      globalTentativeFactor = 0,
    ) => {
      const pool = poolRef.current;
      if (!pool) return;
      const { links: lks } = latestDataRef.current;
      const indexMap = idToIndexRef.current;

      // Global tentative nudge: every edge width scales by
      // (1 - global*0.3). Capped between 0 and 1 defensively.
      const gt = Math.max(0, Math.min(1, globalTentativeFactor));
      const baselineScale = 1 - gt * 0.3;

      pool.linkWidths.set(pool.baseLinkWidths);
      pool.linkColors.set(pool.baseLinkColors);

      const styleMap = new Map<string, HypothesisEdgeStyle>();
      for (const s of styles) {
        if (s && typeof s.edge_key === 'string') styleMap.set(s.edge_key, s);
      }

      let li = 0;
      for (const link of lks) {
        if (!indexMap.has(link.source) || !indexMap.has(link.target)) continue;
        const keyForward = `${link.source}->${link.target}`;
        const keyReverse = `${link.target}->${link.source}`;
        const style = styleMap.get(keyForward) ?? styleMap.get(keyReverse);
        if (style) {
          const visibility = Math.max(0, Math.min(1, style.visibility ?? 1));
          pool.linkWidths[li] = pool.baseLinkWidths[li] * Math.max(0.4, visibility);
          if (style.color_override) {
            const varMatch = /var\((--[a-z0-9-]+)/i.exec(style.color_override);
            const cssVar = varMatch?.[1] ?? '--vie-amber';
            const [r, g, b, a] = cssVarToRgba(cssVar, 0.8 * visibility + 0.1);
            const off = li * 4;
            pool.linkColors[off] = r;
            pool.linkColors[off + 1] = g;
            pool.linkColors[off + 2] = b;
            pool.linkColors[off + 3] = a;
          }
        } else if (gt > 0) {
          // Non-hypothesis edges get the global tentative nudge.
          pool.linkWidths[li] = pool.baseLinkWidths[li] * baselineScale;
        }
        li++;
      }

      // Mirror to the encoded snapshots so the filter-mask step reads a
      // pre-filter truth, and the tween controller has a real target.
      pool.encodedLinkColors.set(pool.linkColors);
      pool.encodedLinkWidths.set(pool.linkWidths);
      applyFilterMaskToLive();
      encodingActiveRef.current = true;
      uploadLinkStyles();
    }, [applyFilterMaskToLive, uploadLinkStyles]);

    const restoreBaseline = useCallback(() => {
      const pool = poolRef.current;
      const graph = graphRef.current;
      if (!pool || !graph) return;
      pool.colors.set(pool.baseColors);
      pool.encodedColors.set(pool.baseColors);
      pool.sizes.set(pool.baseSizes);
      pool.encodedSizes.set(pool.baseSizes);
      pool.linkWidths.set(pool.baseLinkWidths);
      pool.encodedLinkWidths.set(pool.baseLinkWidths);
      pool.linkColors.set(pool.baseLinkColors);
      pool.encodedLinkColors.set(pool.baseLinkColors);
      pool.filterMask.fill(1);
      pool.filterActive = false;
      hypothesisMixFactorRef.current = 0;
      currentSalienceRef.current.clear();
      encodingActiveRef.current = false;
      graph.setPointColors(pool.colors);
      graph.setPointSizes(pool.sizes);
      graph.setLinkWidths(pool.linkWidths);
      graph.setLinkColors(pool.linkColors);
    }, []);

    // -------- Construction tween controller ------------------------------
    //
    // Each phase snapshots the pool's current (visible) state into the
    // pre-allocated `tweenStart*` scratch buffers, then runs a rAF loop
    // that lerps from start -> encoded-target over `duration_ms`. All
    // writes go into the live `colors` / `sizes` / `linkWidths` /
    // `linkColors` buffers; the filter mask (if any) is applied on every
    // frame so the effect looks consistent even under cross-filter.

    const cancelConstructionInternal = useCallback((jumpToFinal: boolean) => {
      const state = constructionStateRef.current;
      for (const t of state.phaseTimers) clearTimeout(t);
      state.phaseTimers = [];
      if (state.rafHandle != null) {
        cancelAnimationFrame(state.rafHandle);
        state.rafHandle = null;
      }
      state.active = false;

      if (jumpToFinal) {
        const pool = poolRef.current;
        const graph = graphRef.current;
        if (pool && graph) {
          pool.colors.set(pool.encodedColors);
          pool.sizes.set(pool.encodedSizes);
          pool.linkColors.set(pool.encodedLinkColors);
          pool.linkWidths.set(pool.encodedLinkWidths);
          applyFilterMaskToLive();
          graph.setPointColors(pool.colors);
          graph.setPointSizes(pool.sizes);
          graph.setLinkWidths(pool.linkWidths);
          graph.setLinkColors(pool.linkColors);
        }
      }

      const cb = state.finalCallback;
      state.finalCallback = null;
      if (cb) cb();
    }, [applyFilterMaskToLive]);

    const runPhaseTween = useCallback((
      phase: ConstructionPhase,
      onPhaseDone: () => void,
    ) => {
      const pool = poolRef.current;
      const graph = graphRef.current;
      if (!pool || !graph) { onPhaseDone(); return; }

      // `clusters_coalesce` and `data_builds` remain no-ops: the former
      // is a force-sim concept (cosmos.gl owns cluster positions), and
      // the latter is deferred to the context_shelf surface.
      if (phase.name === 'clusters_coalesce' || phase.name === 'data_builds') {
        onPhaseDone();
        return;
      }

      // The four "epistemic state" phases (agreement_clusters_form,
      // tensions_bridge, blind_spots_reveal, entrenchment_pulse) all
      // use a pulse envelope that returns to the encoded baseline at
      // t=1. Each owns its own rAF loop so the existing lerp-to-encoded
      // pipeline stays untouched. They share the sin(pi*t) pulse shape
      // so theatricality ramps in and out naturally without a snap.
      if (
        phase.name === 'agreement_clusters_form'
        || phase.name === 'tensions_bridge'
        || phase.name === 'blind_spots_reveal'
        || phase.name === 'entrenchment_pulse'
      ) {
        const duration = Math.max(16, phase.duration_ms);
        const startedAt = performance.now();
        const { linkCount } = pool;

        const targetIndices: number[] = [];
        for (const id of phase.target_ids) {
          const idx = idToIndexRef.current.get(id);
          if (typeof idx === 'number') targetIndices.push(idx);
        }

        // tensions_bridge resolves its edge set from link endpoints so
        // we can amber-tint the edges that actually span the tension.
        const targetLinkIndices: number[] = [];
        if (phase.name === 'tensions_bridge' && targetIndices.length > 0) {
          const targetSet = new Set(phase.target_ids);
          const links = latestDataRef.current.links;
          for (let li = 0; li < linkCount && li < links.length; li++) {
            const link = links[li];
            const src = String(link?.source ?? '');
            const dst = String(link?.target ?? '');
            if (targetSet.has(src) && targetSet.has(dst)) targetLinkIndices.push(li);
          }
        }

        const pulseTick = (now: number) => {
          const state = constructionStateRef.current;
          if (!state.active) return;
          const t = Math.min(1, (now - startedAt) / duration);
          // sin(pi * t) returns to 0 at both endpoints and peaks at 0.5.
          const envelope = Math.sin(Math.PI * t);

          if (phase.name === 'agreement_clusters_form') {
            // Scale-up pulse on cluster members; no color change.
            for (const idx of targetIndices) {
              pool.sizes[idx] = pool.encodedSizes[idx] * (1 + 0.35 * envelope);
            }
          } else if (phase.name === 'entrenchment_pulse') {
            // Emissive rim-light: nudge RGB toward white by up to 0.5.
            for (const idx of targetIndices) {
              const off = idx * 4;
              const br = pool.encodedColors[off];
              const bg = pool.encodedColors[off + 1];
              const bb = pool.encodedColors[off + 2];
              const lift = 0.5 * envelope;
              pool.colors[off] = Math.min(1, br + lift * (1 - br));
              pool.colors[off + 1] = Math.min(1, bg + lift * (1 - bg));
              pool.colors[off + 2] = Math.min(1, bb + lift * (1 - bb));
              pool.colors[off + 3] = pool.encodedColors[off + 3];
            }
          } else if (phase.name === 'blind_spots_reveal') {
            // Desaturation halo: mix target RGB toward paper-muted and
            // dim alpha by up to 45% at peak. Returns to baseline at t=1.
            for (const idx of targetIndices) {
              const off = idx * 4;
              const base: [number, number, number, number] = [
                pool.encodedColors[off],
                pool.encodedColors[off + 1],
                pool.encodedColors[off + 2],
                pool.encodedColors[off + 3],
              ];
              const [r, g, b] = mixTowardTokenRgba(base, '--cp-text-muted', envelope * 0.6, themeVersion);
              pool.colors[off] = r;
              pool.colors[off + 1] = g;
              pool.colors[off + 2] = b;
              pool.colors[off + 3] = base[3] * (1 - envelope * 0.45);
            }
          } else if (phase.name === 'tensions_bridge') {
            // Amber glow on tension-spanning edges: mix link color toward
            // the VIE amber token, swell width up to 80% at peak.
            for (const li of targetLinkIndices) {
              const off = li * 4;
              const base: [number, number, number, number] = [
                pool.encodedLinkColors[off],
                pool.encodedLinkColors[off + 1],
                pool.encodedLinkColors[off + 2],
                pool.encodedLinkColors[off + 3],
              ];
              const [r, g, b, a] = mixTowardTokenRgba(base, '--vie-amber', envelope * 0.75, themeVersion);
              pool.linkColors[off] = r;
              pool.linkColors[off + 1] = g;
              pool.linkColors[off + 2] = b;
              pool.linkColors[off + 3] = a;
              pool.linkWidths[li] = pool.encodedLinkWidths[li] * (1 + 0.8 * envelope);
            }
          }

          applyFilterMaskToLive();
          if (phase.name === 'tensions_bridge') {
            graph.setLinkWidths(pool.linkWidths);
            graph.setLinkColors(pool.linkColors);
          } else {
            graph.setPointColors(pool.colors);
            graph.setPointSizes(pool.sizes);
          }

          if (t < 1) {
            state.rafHandle = requestAnimationFrame(pulseTick);
          } else {
            // Snap live buffers back to encoded so the phase is a pure
            // transient that leaves no residue downstream.
            if (phase.name === 'tensions_bridge') {
              pool.linkWidths.set(pool.encodedLinkWidths);
              pool.linkColors.set(pool.encodedLinkColors);
              graph.setLinkWidths(pool.linkWidths);
              graph.setLinkColors(pool.linkColors);
            } else {
              pool.colors.set(pool.encodedColors);
              pool.sizes.set(pool.encodedSizes);
              graph.setPointColors(pool.colors);
              graph.setPointSizes(pool.sizes);
            }
            state.rafHandle = null;
            onPhaseDone();
          }
        };

        if (constructionStateRef.current.rafHandle != null) {
          cancelAnimationFrame(constructionStateRef.current.rafHandle);
        }
        constructionStateRef.current.rafHandle = requestAnimationFrame(pulseTick);
        return;
      }

      // Label phases use the overlay rather than the pool buffers. Fade
      // is handled by the overlay alpha path; here we just mark the
      // phase complete after its duration. Label stamp-in is performed
      // in `applySceneDirective` on completion.
      if (phase.name === 'labels_fade_in') {
        const timer = window.setTimeout(onPhaseDone, Math.max(0, phase.duration_ms));
        constructionStateRef.current.phaseTimers.push(timer);
        return;
      }

      if (phase.name === 'crystallize') {
        // Single snapshot at end: force live buffers to the encoded
        // target, then upload once.
        pool.colors.set(pool.encodedColors);
        pool.sizes.set(pool.encodedSizes);
        pool.linkColors.set(pool.encodedLinkColors);
        pool.linkWidths.set(pool.encodedLinkWidths);
        applyFilterMaskToLive();
        graph.setPointColors(pool.colors);
        graph.setPointSizes(pool.sizes);
        graph.setLinkWidths(pool.linkWidths);
        graph.setLinkColors(pool.linkColors);
        onPhaseDone();
        return;
      }

      // focal_nodes_appear / supporting_nodes_appear / edges_draw all
      // share the same mechanic: tween live buffers toward encoded.
      // Snapshot the current live state into tween-start scratch.
      pool.tweenStartColors.set(pool.colors);
      pool.tweenStartSizes.set(pool.sizes);
      pool.tweenStartLinkWidths.set(pool.linkWidths);
      pool.tweenStartLinkColors.set(pool.linkColors);

      const duration = Math.max(16, phase.duration_ms);
      const easing = getEasing(phase.easing);
      const startedAt = performance.now();
      const { pointCount, linkCount } = pool;
      const animatePoints = phase.name !== 'edges_draw';
      const animateLinks = phase.name === 'edges_draw';

      // Per-target timing: when `phase.targets` is present, each id gets
      // its own `delay_ms` offset. Build an index→offset array so the
      // tight rAF loop can look up staggers in O(1). Falls through to the
      // uniform-lockstep behavior when `targets` is absent.
      let pointDelays: Float32Array | null = null;
      let linkDelays: Float32Array | null = null;
      if (phase.targets && phase.targets.length > 0) {
        if (animatePoints) {
          pointDelays = new Float32Array(pointCount);
          for (const t of phase.targets) {
            const idx = idToIndexRef.current.get(t.id);
            if (typeof idx === 'number') pointDelays[idx] = Math.max(0, t.delay_ms ?? 0);
          }
        }
        if (animateLinks) {
          // For edges_draw, map each target id to its incident edges: a
          // link starts its stagger when EITHER endpoint has "arrived"
          // (minimum delay of the two endpoints). This gives a natural
          // citation-order reveal: as each evidence node lights up, its
          // edges crawl out toward already-revealed neighbors.
          linkDelays = new Float32Array(linkCount);
          const idToDelay = new Map<string, number>();
          for (const t of phase.targets) idToDelay.set(t.id, Math.max(0, t.delay_ms ?? 0));
          const links = latestDataRef.current.links;
          for (let li = 0; li < linkCount && li < links.length; li++) {
            const link = links[li];
            const da = idToDelay.get(String(link?.source ?? ''));
            const db = idToDelay.get(String(link?.target ?? ''));
            if (da === undefined && db === undefined) {
              linkDelays[li] = 0;
            } else if (da === undefined) {
              linkDelays[li] = db!;
            } else if (db === undefined) {
              linkDelays[li] = da;
            } else {
              linkDelays[li] = Math.min(da, db);
            }
          }
        }
      }
      // Edge widths start from zero during edges_draw so they visibly
      // "draw in" (the encoded target is the final per-style width).
      if (phase.name === 'edges_draw') {
        for (let li = 0; li < linkCount; li++) {
          pool.tweenStartLinkWidths[li] = 0;
        }
        // Also zero out link-color alpha at start so the stroke fades
        // up with the width, not a solid line of growing width.
        for (let li = 0; li < linkCount; li++) {
          pool.tweenStartLinkColors[li * 4 + 3] = 0;
        }
      }

      const tick = (now: number) => {
        const state = constructionStateRef.current;
        if (!state.active) return;
        const t = Math.min(1, (now - startedAt) / duration);
        const eased = easing(t);

        if (animatePoints) {
          const elapsed = now - startedAt;
          for (let i = 0; i < pointCount; i++) {
            // Per-target delay: a node stays at its tween-start until its
            // own delay elapses, then ramps over the remaining duration.
            let localT = t;
            if (pointDelays !== null) {
              const offset = pointDelays[i];
              if (offset > 0) {
                const localDuration = Math.max(16, duration - offset);
                const localElapsed = elapsed - offset;
                if (localElapsed <= 0) {
                  localT = 0;
                } else if (localElapsed >= localDuration) {
                  localT = 1;
                } else {
                  localT = localElapsed / localDuration;
                }
              }
            }
            const localEased = localT === t ? eased : easing(localT);
            const o = i * 4;
            pool.colors[o] = pool.tweenStartColors[o]
              + (pool.encodedColors[o] - pool.tweenStartColors[o]) * localEased;
            pool.colors[o + 1] = pool.tweenStartColors[o + 1]
              + (pool.encodedColors[o + 1] - pool.tweenStartColors[o + 1]) * localEased;
            pool.colors[o + 2] = pool.tweenStartColors[o + 2]
              + (pool.encodedColors[o + 2] - pool.tweenStartColors[o + 2]) * localEased;
            pool.colors[o + 3] = pool.tweenStartColors[o + 3]
              + (pool.encodedColors[o + 3] - pool.tweenStartColors[o + 3]) * localEased;
            // Lerp sizes from tween-start snapshot toward encoded target
            // (which includes the salience scale applied by applySalience).
            pool.sizes[i] = pool.tweenStartSizes[i]
              + (pool.encodedSizes[i] - pool.tweenStartSizes[i]) * localEased;
          }
        }

        if (animateLinks) {
          const elapsed = now - startedAt;
          for (let li = 0; li < linkCount; li++) {
            let localT = t;
            if (linkDelays !== null) {
              const offset = linkDelays[li];
              if (offset > 0) {
                const localDuration = Math.max(16, duration - offset);
                const localElapsed = elapsed - offset;
                if (localElapsed <= 0) {
                  localT = 0;
                } else if (localElapsed >= localDuration) {
                  localT = 1;
                } else {
                  localT = localElapsed / localDuration;
                }
              }
            }
            const localEased = localT === t ? eased : easing(localT);
            const encodedW = pool.encodedLinkWidths[li];
            pool.linkWidths[li] = pool.tweenStartLinkWidths[li]
              + (encodedW - pool.tweenStartLinkWidths[li]) * localEased;
            const o = li * 4;
            pool.linkColors[o] = pool.tweenStartLinkColors[o]
              + (pool.encodedLinkColors[o] - pool.tweenStartLinkColors[o]) * localEased;
            pool.linkColors[o + 1] = pool.tweenStartLinkColors[o + 1]
              + (pool.encodedLinkColors[o + 1] - pool.tweenStartLinkColors[o + 1]) * localEased;
            pool.linkColors[o + 2] = pool.tweenStartLinkColors[o + 2]
              + (pool.encodedLinkColors[o + 2] - pool.tweenStartLinkColors[o + 2]) * localEased;
            pool.linkColors[o + 3] = pool.tweenStartLinkColors[o + 3]
              + (pool.encodedLinkColors[o + 3] - pool.tweenStartLinkColors[o + 3]) * localEased;
          }
        }

        applyFilterMaskToLive();
        if (animatePoints) {
          graph.setPointColors(pool.colors);
          graph.setPointSizes(pool.sizes);
        }
        if (animateLinks) {
          graph.setLinkWidths(pool.linkWidths);
          graph.setLinkColors(pool.linkColors);
        }

        if (t < 1) {
          state.rafHandle = requestAnimationFrame(tick);
        } else {
          state.rafHandle = null;
          onPhaseDone();
        }
      };

      // Defensive: cancel any in-flight rAF before scheduling our own.
      // Rule-based SequenceComposer emits non-overlapping phases so this
      // is a no-op today, but a learned director with high theatricality
      // could emit overlapping phases; the cancel prevents an orphan rAF
      // from outliving its phase.
      if (constructionStateRef.current.rafHandle != null) {
        cancelAnimationFrame(constructionStateRef.current.rafHandle);
      }
      constructionStateRef.current.rafHandle = requestAnimationFrame(tick);
    }, [applyFilterMaskToLive]);

    const playConstructionInternal = useCallback((
      seq: ConstructionSequence,
      options?: { onComplete?: () => void },
    ) => {
      const state = constructionStateRef.current;
      // Cancel anything already queued; don't jump-to-final because the
      // new sequence will rewrite the state.
      for (const t of state.phaseTimers) clearTimeout(t);
      state.phaseTimers = [];
      if (state.rafHandle != null) {
        cancelAnimationFrame(state.rafHandle);
        state.rafHandle = null;
      }
      state.active = true;
      state.finalCallback = options?.onComplete ?? null;

      // At sequence start, set the live buffers to a "galaxy dim" state
      // so the first phase has something visible to tween out of. The
      // encoded buffers are preserved as the final target; only the
      // live `colors` / `sizes` / `linkWidths` / `linkColors` move.
      const pool = poolRef.current;
      const graph = graphRef.current;
      if (pool && graph) {
        for (let i = 0; i < pool.pointCount; i++) {
          const o = i * 4;
          pool.colors[o] = pool.baseColors[o];
          pool.colors[o + 1] = pool.baseColors[o + 1];
          pool.colors[o + 2] = pool.baseColors[o + 2];
          pool.colors[o + 3] = pool.baseColors[o + 3] * 0.35;
          // Shrink sizes to 60% of base so focal points pop on appearance.
          pool.sizes[i] = pool.baseSizes[i] * 0.6;
        }
        // Edges: zero width + zero alpha so edges_draw grows them.
        for (let li = 0; li < pool.linkCount; li++) {
          pool.linkWidths[li] = 0;
          pool.linkColors[li * 4 + 3] = 0;
        }
        applyFilterMaskToLive();
        graph.setPointColors(pool.colors);
        graph.setPointSizes(pool.sizes);
        graph.setLinkWidths(pool.linkWidths);
        graph.setLinkColors(pool.linkColors);
      }

      const phases = seq.phases;
      let completedCount = 0;
      const onAllDone = () => {
        state.active = false;
        // Guarantee the final snapshot is exact.
        cancelConstructionInternal(true);
      };

      phases.forEach((phase) => {
        const delayTimer = window.setTimeout(() => {
          if (!constructionStateRef.current.active) return;
          runPhaseTween(phase, () => {
            completedCount++;
            if (completedCount === phases.length) onAllDone();
          });
        }, Math.max(0, phase.delay_ms));
        constructionStateRef.current.phaseTimers.push(delayTimer);
      });
    }, [applyFilterMaskToLive, cancelConstructionInternal, runPhaseTween]);

    // -------- Ambient idle breathing --------------------------------------
    //
    // A slow sin-wave modulation of live-buffer alpha, active only when
    // no ask is running and the user has been still for 10s+. Every
    // interaction (hover, pan, zoom, click, ask submit) resets the
    // lastInteractionAt clock and restores the encoded alpha.

    const AMBIENT_IDLE_MS = 10_000;
    const AMBIENT_AMPLITUDE = 0.03;
    const AMBIENT_PERIOD_MS = 3_000;

    const stopAmbientBreathing = useCallback(() => {
      ambientActiveRef.current = false;
      if (ambientRafRef.current != null) {
        cancelAnimationFrame(ambientRafRef.current);
        ambientRafRef.current = null;
      }
      // Restore the live buffer to the encoded state (modulo filter).
      const pool = poolRef.current;
      const graph = graphRef.current;
      if (pool && graph) {
        pool.colors.set(pool.encodedColors);
        applyFilterMaskToLive();
        graph.setPointColors(pool.colors);
      }
    }, [applyFilterMaskToLive]);

    const ambientTick = useCallback(() => {
      // Bail conditions: any interaction happened, or an ask/encoding is
      // running, or a construction tween is active.
      const idleFor = Date.now() - lastInteractionAtRef.current;
      if (
        idleFor < AMBIENT_IDLE_MS
        || encodingActiveRef.current
        || constructionStateRef.current.active
      ) {
        stopAmbientBreathing();
        return;
      }
      const pool = poolRef.current;
      const graph = graphRef.current;
      if (!pool || !graph || !ambientActiveRef.current) {
        // Either the graph / pool isn't ready, or unmount flipped the
        // active flag while a frame was queued. Exit without rescheduling;
        // maybeStartAmbient will re-arm when the idle watcher decides.
        ambientRafRef.current = null;
        return;
      }
      const t = performance.now();
      const pulse = 1 + AMBIENT_AMPLITUDE * Math.sin((2 * Math.PI * t) / AMBIENT_PERIOD_MS);
      for (let i = 0; i < pool.pointCount; i++) {
        const off = i * 4 + 3;
        pool.colors[off] = Math.min(1, pool.encodedColors[off] * pulse);
      }
      applyFilterMaskToLive();
      graph.setPointColors(pool.colors);
      ambientRafRef.current = requestAnimationFrame(ambientTick);
    }, [applyFilterMaskToLive, stopAmbientBreathing]);

    const maybeStartAmbient = useCallback(() => {
      if (ambientActiveRef.current) return;
      if (encodingActiveRef.current) return;
      if (constructionStateRef.current.active) return;
      // Respect OS-level reduced-motion; the alpha pulse is decorative.
      if (
        typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }
      ambientActiveRef.current = true;
      ambientRafRef.current = requestAnimationFrame(ambientTick);
    }, [ambientTick]);

    const noteInteraction = useCallback(() => {
      lastInteractionAtRef.current = Date.now();
      if (ambientActiveRef.current) stopAmbientBreathing();
    }, [stopAmbientBreathing]);

    // Long-running idle checker: every 2s, ask whether we should start
    // the ambient loop. Cheap; does not touch buffers unless we enter
    // breathing mode.
    useEffect(() => {
      const interval = window.setInterval(() => {
        const idleFor = Date.now() - lastInteractionAtRef.current;
        if (idleFor >= AMBIENT_IDLE_MS) maybeStartAmbient();
      }, 2_000);
      return () => {
        window.clearInterval(interval);
      };
    }, [maybeStartAmbient]);

    // -------- Adapter implementation -------------------------------------

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
        setSalienceEncoding(salience: NodeSalience[]) {
          noteInteraction();
          applySalienceToPool(salience);
        },
        setEdgeStyles(styles: HypothesisEdgeStyle[], globalTentativeFactor = 0) {
          noteInteraction();
          applyEdgeStylesToPool(styles, globalTentativeFactor);
        },
        setNeighborhoodGradient(evidenceIds, tiers) {
          applyNeighborhoodToPool(evidenceIds, tiers);
        },
        applyHypothesisColorMix(mixFactor: number) {
          applyHypothesisMixToPool(mixFactor);
        },
        clearEncoding() {
          cancelConstructionInternal(false);
          restoreBaseline();
          focalLabelsRef.current = [];
          drawOverlay();
        },
        fitViewToNodes(ids, durationMs, padding) {
          const graph = graphRef.current;
          if (!graph) return;
          const indices = ids
            .map((id) => idToIndexRef.current.get(id))
            .filter((i): i is number => typeof i === 'number');
          if (indices.length === 0) return;
          graph.fitViewByPointIndices(indices, durationMs, padding, true);
        },
        getProjectedPosition(nodeId) {
          const graph = graphRef.current;
          const idx = idToIndexRef.current.get(nodeId);
          if (!graph || typeof idx !== 'number') return null;
          const positions = graph.getPointPositions();
          if (!positions || positions.length < (idx + 1) * 2) return null;
          const screen = graph.spaceToScreenPosition([
            positions[idx * 2],
            positions[idx * 2 + 1],
          ]);
          if (!screen) return null;
          return { x: screen[0], y: screen[1] };
        },
        setFocalLabels(labels) {
          focalLabelsRef.current = labels.slice(0, 5);
          sizeOverlayToContainer();
          scheduleOverlayTick();
        },
        clearFocalLabels() {
          focalLabelsRef.current = [];
          drawOverlay();
        },
        playConstructionSequence(seq, playOptions) {
          noteInteraction();
          playConstructionInternal(seq, playOptions);
        },
        cancelConstruction() {
          cancelConstructionInternal(true);
        },
        revealEvidence(nodeIds, revealOptions) {
          noteInteraction();
          if (!nodeIds || nodeIds.length === 0) return;
          const staggerMs = Math.max(0, revealOptions?.staggerMs ?? 120);
          const durationMs = Math.max(200, revealOptions?.durationMs ?? 800);
          const easing = revealOptions?.easing ?? 'ease-out';
          const targets = nodeIds.map((id, i) => ({ id, delay_ms: staggerMs * i }));
          const totalDuration = durationMs + staggerMs * Math.max(0, nodeIds.length - 1);
          playConstructionInternal(
            {
              phases: [
                {
                  name: 'focal_nodes_appear',
                  target_ids: nodeIds,
                  targets,
                  delay_ms: 0,
                  duration_ms: totalDuration,
                  easing,
                },
              ],
              total_duration_ms: totalDuration,
              theatricality: 0.5,
            },
            undefined,
          );
        },
        queueCameraWaypoints(waypoints) {
          noteInteraction();
          const graph = graphRef.current;
          if (!graph || !waypoints || waypoints.length === 0) return () => {};
          let cancelled = false;
          let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
          const step = (i: number) => {
            if (cancelled || i >= waypoints.length) return;
            const wp = waypoints[i];
            const idx = idToIndexRef.current.get(wp.nodeId);
            const transitionMs = Math.max(100, wp.transitionMs ?? 700);
            if (typeof idx === 'number') {
              graph.zoomToPointByIndex(idx, transitionMs, wp.distanceFactor ?? 2.5);
            }
            const next = transitionMs + Math.max(0, wp.dwellMs);
            timeoutHandle = setTimeout(() => step(i + 1), next);
          };
          step(0);
          return () => {
            cancelled = true;
            if (timeoutHandle !== null) clearTimeout(timeoutHandle);
          };
        },
        setVisibleIds(ids) {
          const pool = poolRef.current;
          const graph = graphRef.current;
          if (!pool || !graph) return;
          if (ids === null) {
            pool.filterMask.fill(1);
            pool.filterActive = false;
            pool.colors.set(pool.encodedColors);
            pool.linkColors.set(pool.encodedLinkColors);
            graph.setPointColors(pool.colors);
            graph.setLinkColors(pool.linkColors);
            return;
          }
          const visible = new Set(ids);
          pool.filterActive = true;
          for (let i = 0; i < pool.pointCount; i++) {
            pool.filterMask[i] = visible.has(indexToIdRef.current[i]) ? 1 : 0;
          }
          // Reapply encoded baseline, then punch through with mask.
          pool.colors.set(pool.encodedColors);
          pool.linkColors.set(pool.encodedLinkColors);
          applyFilterMaskToLive();
          graph.setPointColors(pool.colors);
          graph.setLinkColors(pool.linkColors);
          noteInteraction();
        },
        replaceScene(nextPoints, nextLinks) {
          latestDataRef.current = {
            points: nextPoints as unknown as CosmoPoint[],
            links: nextLinks as unknown as CosmoLink[],
            pinnedPositions: latestDataRef.current.pinnedPositions,
          };
          const nextIndexToId = nextPoints.map((point) => point.id);
          const nextIdToIndex = new Map(nextIndexToId.map((id, index) => [id, index]));
          indexToIdRef.current = nextIndexToId;
          idToIndexRef.current = nextIdToIndex;
          cancelConstructionInternal(false);
          focalLabelsRef.current = [];
          pushDataToGraphRef.current?.();
          drawOverlay();
          noteInteraction();
        },
        applyPrimitiveMetadata(entries) {
          const next = new Map<string, {
            metadata: Record<string, number | string | boolean>;
            displayKeys?: string[];
          }>();
          for (const entry of entries) {
            next.set(entry.id, {
              metadata: entry.metadata,
              displayKeys: entry.displayKeys,
            });
          }
          primitiveMetadataRef.current = next;
        },

        // --- Atlas chrome hooks --------------------------------------

        getZoom() {
          return graphRef.current?.getZoomLevel() ?? 1;
        },
        onZoomChange(cb) {
          zoomListenersRef.current.add(cb);
          return () => {
            zoomListenersRef.current.delete(cb);
          };
        },
        setLens(lens: LensId) {
          const graph = graphRef.current;
          const pool = poolRef.current;
          if (!graph || !pool) {
            lensRef.current = lens;
            return;
          }
          const prev = lensRef.current;
          if (prev === lens) return;

          // Leaving Flow: snapshot the rotated colors so we can restore
          // them on return.
          if (prev === 'flow') {
            if (!flowColorsSnapshotRef.current
              || flowColorsSnapshotRef.current.length !== pool.colors.length) {
              flowColorsSnapshotRef.current = new Float32Array(pool.colors.length);
            }
            flowColorsSnapshotRef.current.set(pool.colors);
          }

          // Entering Atlas or Clusters: reset colors to the semantic
          // per-type baseline so points read their object_type_color.
          // Atlas is the map; Clusters is the navigation view. Both
          // need stable type-identity coloring, not rotated flow.
          if (lens === 'atlas' || lens === 'clusters') {
            pool.colors.set(pool.baseColors);
            graph.setPointColors(pool.colors);
            // Reset tween counter so re-enter animations are clean.
            tickCounterRef.current = 0;
            // Freeze physics so the map reads as static. cosmos.gl 3.0
            // exposes pause()/unpause(); graceful no-op if missing.
            graph.pause?.();
          }

          // Clusters-specific: compute convex hulls per Leiden
          // community against the current (frozen) positions. Cached
          // in space coordinates and reprojected to screen each draw.
          if (lens === 'clusters') {
            const positions = graph.getPointPositions();
            if (positions && positions.length > 0) {
              clusterHullsRef.current = computeClusterHulls(
                pointsRef.current,
                positions,
                pool.clusterIds,
                /* minMembers */ 10,
              );
            } else {
              clusterHullsRef.current = [];
            }
          } else {
            clusterHullsRef.current = [];
          }

          // Returning to Flow: always paint the warm angular gradient
          // fresh so the rotation produces a visible pinwheel (the
          // type-color baseline only has ~7 distinct hues, which
          // disappear under rotation). Unpause so the worm moves.
          if (lens === 'flow') {
            const positions = graph.getPointPositions();
            if (positions && positions.length > 0) {
              assignFlowGradient(positions, pool.colors);
            } else if (flowColorsSnapshotRef.current
              && flowColorsSnapshotRef.current.length === pool.colors.length) {
              pool.colors.set(flowColorsSnapshotRef.current);
            } else {
              pool.colors.set(pool.baseColors);
            }
            graph.setPointColors(pool.colors);
            graph.unpause?.();
          }

          // Orbit lens: each Leiden community becomes its own little
          // solar system. Importance (PageRank, with degree fallback)
          // determines orbital radius — the heaviest node sits near
          // the centroid as the "sun", fringe nodes orbit far out.
          // Angular velocity drops with radius (Kepler-ish) so outer
          // orbits drift slowly while inner orbits whip around.
          if (lens === 'orbit') {
            pool.colors.set(pool.baseColors);
            graph.setPointColors(pool.colors);
            graph.unpause?.();

            const pts = pointsRef.current;
            const positions = graph.getPointPositions();
            if (pts.length > 0 && positions && positions.length >= pts.length * 2) {
              type Entry = { idx: number; importance: number };
              const byCluster = new Map<number, Entry[]>();
              const nPts = pts.length;
              for (let i = 0; i < nPts; i++) {
                const cid = pool.clusterIds[i];
                if (cid < 0) continue;
                const p = pts[i];
                const importance = typeof p.pagerank === 'number' && p.pagerank > 0
                  ? p.pagerank
                  : p.degree;
                const list = byCluster.get(cid);
                if (list) list.push({ idx: i, importance });
                else byCluster.set(cid, [{ idx: i, importance }]);
              }

              // Compute cluster centroids from current graph positions.
              const centroids = new Map<number, { x: number; y: number }>();
              for (const [cid, members] of byCluster) {
                let sx = 0;
                let sy = 0;
                for (const m of members) {
                  sx += positions[m.idx * 2];
                  sy += positions[m.idx * 2 + 1];
                }
                centroids.set(cid, { x: sx / members.length, y: sy / members.length });
              }

              // Assign orbital parameters per point, ordered by
              // importance within each cluster. Alternate rotation
              // direction per cluster so the view reads as multiple
              // independent systems rather than one big turntable.
              let clusterNum = 0;
              for (const [cid, members] of byCluster) {
                members.sort((a, b) => b.importance - a.importance);
                const centroid = centroids.get(cid);
                if (!centroid) continue;
                // Max radius scales with the cluster's natural spread
                // in the pre-orbit layout. Measure existing spread:
                let maxExisting = 0;
                for (const m of members) {
                  const dx = positions[m.idx * 2] - centroid.x;
                  const dy = positions[m.idx * 2 + 1] - centroid.y;
                  const r = Math.sqrt(dx * dx + dy * dy);
                  if (r > maxExisting) maxExisting = r;
                }
                const maxRadius = Math.max(60, maxExisting);
                const direction = clusterNum % 2 === 0 ? 1 : -1;
                clusterNum++;

                for (let rank = 0; rank < members.length; rank++) {
                  const { idx } = members[rank];
                  const t = members.length <= 1 ? 0 : rank / (members.length - 1);
                  // Sqrt spacing so the innermost handful sits tight
                  // near the centroid and outer ones spread out more.
                  // Add a small per-point radial offset so points on
                  // the same rank tier don't trace identical circles.
                  const baseRadius = Math.sqrt(t) * maxRadius;
                  const radius = baseRadius * (0.85 + Math.random() * 0.30);
                  // Random initial angular phase so points are
                  // scattered around the ring rather than evenly
                  // spaced spokes. (Even spacing read as a wheel.)
                  const phase = Math.random() * Math.PI * 2;
                  // Kepler-ish base omega plus per-point jitter (±50%)
                  // so neighbouring points drift in and out of phase
                  // rather than locking into rigid bands. Inner
                  // orbits ~0.8 rad/sec (8s revolution), outer
                  // ~0.3 rad/sec (21s). rad/sec keeps motion smooth.
                  const omegaBase = 0.8 / Math.sqrt(1 + radius * 0.008);
                  const omegaJitter = 0.5 + Math.random() * 1.0;
                  const omega = omegaBase * omegaJitter * direction;
                  // Per-point ellipse: eccentricity 0..0.55 so some
                  // orbits are nearly circular and others are
                  // dramatically elongated. Initial tilt is random,
                  // and precession (the orbit's major axis rotation)
                  // runs at 0.02-0.12 rad/sec so the ellipse itself
                  // turns over 50-300 seconds.
                  const eccentricity = Math.random() * 0.55;
                  const tilt = Math.random() * Math.PI * 2;
                  const precession = (0.02 + Math.random() * 0.10)
                    * (Math.random() < 0.5 ? -1 : 1);
                  pool.orbitCenters[idx * 2] = centroid.x;
                  pool.orbitCenters[idx * 2 + 1] = centroid.y;
                  pool.orbitRadii[idx] = radius;
                  pool.orbitPhases[idx] = phase;
                  pool.orbitOmegas[idx] = omega;
                  pool.orbitEccentricities[idx] = eccentricity;
                  pool.orbitTilts[idx] = tilt;
                  pool.orbitPrecessions[idx] = precession;
                }
              }

              // Orphan points (clusterId < 0) stay where they are by
              // getting radius 0 + zero motion params.
              for (let i = 0; i < nPts; i++) {
                if (pool.clusterIds[i] >= 0) continue;
                pool.orbitCenters[i * 2] = positions[i * 2];
                pool.orbitCenters[i * 2 + 1] = positions[i * 2 + 1];
                pool.orbitRadii[i] = 0;
                pool.orbitPhases[i] = 0;
                pool.orbitOmegas[i] = 0;
                pool.orbitEccentricities[i] = 0;
                pool.orbitTilts[i] = 0;
                pool.orbitPrecessions[i] = 0;
              }

              pool.orbitT0 = performance.now();
            }
          }

          lensRef.current = lens;

          // Cancel any in-flight orbit rAF before deciding whether to
          // start a new one. This guarantees clean lens transitions
          // and stops the loop on every leave path.
          if (orbitRafRef.current !== null) {
            cancelAnimationFrame(orbitRafRef.current);
            orbitRafRef.current = null;
          }

          // Drive the Orbit lens from a dedicated requestAnimationFrame
          // loop rather than cosmos.gl's onSimulationTick. rAF gives
          // us guaranteed vsync (60fps) frame timing and decouples
          // the visual smoothness from the sim's tick cadence.
          if (lens === 'orbit') {
            const tickOrbit = () => {
              const g = graphRef.current;
              const p = poolRef.current;
              if (!g || !p || lensRef.current !== 'orbit') {
                orbitRafRef.current = null;
                return;
              }
              if (p.rotationPositionScratch.length < p.orbitRadii.length * 2) {
                orbitRafRef.current = requestAnimationFrame(tickOrbit);
                return;
              }
              const dt = (performance.now() - p.orbitT0) / 1000;
              const nPts = p.orbitRadii.length;
              const out = p.rotationPositionScratch;
              for (let i = 0; i < nPts; i++) {
                const a = p.orbitRadii[i]; // semi-major axis
                if (a <= 0) {
                  out[i * 2] = p.orbitCenters[i * 2];
                  out[i * 2 + 1] = p.orbitCenters[i * 2 + 1];
                  continue;
                }
                // Each point traces an ellipse rotated by its tilt.
                // The tilt itself precesses over time, so the orbit
                // shape never sits still: speed varies along the
                // path (slower at apohelion, faster at perihelion)
                // and the major axis sweeps around the centroid.
                const ecc = p.orbitEccentricities[i];
                const b = a * (1 - ecc); // semi-minor axis
                const theta = p.orbitPhases[i] + p.orbitOmegas[i] * dt;
                const tilt = p.orbitTilts[i] + p.orbitPrecessions[i] * dt;
                const cosT = Math.cos(theta);
                const sinT = Math.sin(theta);
                const cosTilt = Math.cos(tilt);
                const sinTilt = Math.sin(tilt);
                // Local ellipse coords -> rotated -> centered.
                const ex = a * cosT;
                const ey = b * sinT;
                out[i * 2] = p.orbitCenters[i * 2] + ex * cosTilt - ey * sinTilt;
                out[i * 2 + 1] = p.orbitCenters[i * 2 + 1] + ex * sinTilt + ey * cosTilt;
              }
              g.setPointPositions(out, true);
              g.render?.();
              orbitRafRef.current = requestAnimationFrame(tickOrbit);
            };
            orbitRafRef.current = requestAnimationFrame(tickOrbit);
          }

          // Redraw the overlay so any pretext focal labels reposition
          // against the new lens state. Atlas positions are frozen, so
          // this single redraw is the truth until the next zoom / resize.
          drawOverlay();
        },
      }),
      [
        applyEdgeStylesToPool,
        applyFilterMaskToLive,
        applyHypothesisMixToPool,
        applyNeighborhoodToPool,
        applySalienceToPool,
        cancelConstructionInternal,
        drawOverlay,
        noteInteraction,
        playConstructionInternal,
        restoreBaseline,
        scheduleOverlayTick,
        sizeOverlayToContainer,
      ],
    );

    // -------- Data push ---------------------------------------------------

    const pushDataToGraph = useCallback(() => {
      const graph = graphRef.current;
      const { points: pts, links: lks, pinnedPositions: pinned } = latestDataRef.current;
      if (!graph || pts.length === 0) return;

      const pointCount = pts.length;
      const indexMap = idToIndexRef.current;
      let validLinkCount = 0;
      for (const link of lks) {
        if (indexMap.has(link.source) && indexMap.has(link.target)) validLinkCount++;
      }

      if (
        !poolRef.current
        || poolRef.current.pointCount !== pointCount
        || poolRef.current.linkCount !== validLinkCount
      ) {
        poolRef.current = makeBufferPool(pointCount, validLinkCount);
      }
      const pool = poolRef.current;

      // Hybrid cluster context: leiden_community where present, k_core_number
      // as a structural fallback. Both tiers share one ordinal domain so
      // the warm ramp and the position-seed spiral both read from the same
      // source of truth (clusterContextRef).
      const clusterContext = buildClusterContext(pts);
      clusterContextRef.current = clusterContext;
      const totalOrdinals = clusterContext.totalOrdinals;

      // spaceSize drives simulation extents; read the library default so
      // we stay consistent with cosmos.gl's internal coord system. Fall
      // back to the GraphConfig literal below if the export disappears.
      const spaceSize = defaultConfigValues.spaceSize;
      const centerXY = spaceSize * 0.5;

      // Cluster centers: one per distinct ordinal (leiden first, then
      // k-core). Distribute on a staggered spiral from 10% to 45% of
      // spaceSize; angle uses the worm demo's 15*PI factor.
      const centersByOrdinal = new Map<number, [number, number]>();
      if (totalOrdinals > 0) {
        const rMin = spaceSize * 0.1;
        const rMax = spaceSize * 0.45;
        const denom = Math.max(1, totalOrdinals - 1);
        for (let ord = 0; ord < totalOrdinals; ord++) {
          const t = ord / denom;
          const radius = rMin + (rMax - rMin) * t;
          const angle = 15 * Math.PI * (ord / totalOrdinals);
          const cx = centerXY + radius * Math.cos(angle);
          const cy = centerXY + radius * Math.sin(angle);
          centersByOrdinal.set(ord, [cx, cy]);
        }
      }

      const positions = new Float32Array(pointCount * 2);
      const pinnedIndices: number[] = [];
      // Jitter scale: small enough that neighbors stay clustered but big
      // enough to give the force sim something to refine (not zero).
      const jitter = 40;
      const fallbackSpread = Math.max(2200, Math.sqrt(pointCount) * 90);
      for (let i = 0; i < pointCount; i++) {
        const id = pts[i].id;
        const fixed = pinned?.[id];
        if (fixed) {
          positions[i * 2] = fixed[0];
          positions[i * 2 + 1] = fixed[1];
          pinnedIndices.push(i);
          continue;
        }
        const ordinal = resolveClusterOrdinal(pts[i], clusterContext);
        const center = ordinal != null ? centersByOrdinal.get(ordinal) : undefined;
        if (center) {
          positions[i * 2] = center[0] + (Math.random() - 0.5) * jitter;
          positions[i * 2 + 1] = center[1] + (Math.random() - 0.5) * jitter;
        } else {
          // Truly uncovered (no leiden AND no k_core) node: drop into a
          // small random cloud at canvas center. Honest M7 pending visual.
          positions[i * 2] = centerXY + (Math.random() - 0.5) * (fallbackSpread * 0.1);
          positions[i * 2 + 1] = centerXY + (Math.random() - 0.5) * (fallbackSpread * 0.1);
        }
      }

      writeBaselineColors(pool, pts);
      writeBaselineSizes(pool, pts);

      const linksArray = new Float32Array(validLinkCount * 2);
      let li = 0;
      for (const link of lks) {
        const src = indexMap.get(link.source);
        const tgt = indexMap.get(link.target);
        if (src === undefined || tgt === undefined) continue;
        pool.linkEndpoints[li * 2] = src;
        pool.linkEndpoints[li * 2 + 1] = tgt;
        linksArray[li * 2] = src;
        linksArray[li * 2 + 1] = tgt;
        li++;
      }
      writeBaselineLinkStyles(pool, lks, indexMap);

      // Seed encoded snapshots to baseline so pre-encoding reads/renders
      // use a sane canvas state. The first `applySceneDirective` call
      // overwrites them.
      pool.encodedColors.set(pool.baseColors);
      pool.encodedSizes.set(pool.baseSizes);
      pool.encodedLinkColors.set(pool.baseLinkColors);
      pool.encodedLinkWidths.set(pool.baseLinkWidths);
      pool.filterMask.fill(1);
      pool.filterActive = false;

      adjacencyRef.current = buildAdjacencyFromLinks(
        pts.map((p) => p.id),
        lks,
      );

      graph.setPointPositions(positions);
      // If we're loading directly into the Flow lens (the default),
      // paint the warm angular gradient so chromatic rotation is
      // visible immediately. Other lenses will reset colors on
      // entry via setLens.
      if (lensRef.current === 'flow') {
        assignFlowGradient(positions, pool.colors);
      }
      graph.setPointColors(pool.colors);
      graph.setPointSizes(pool.sizes);
      graph.setLinks(linksArray);
      graph.setLinkWidths(pool.linkWidths);
      graph.setLinkColors(pool.linkColors);
      graph.setPinnedPoints(pinnedIndices.length > 0 ? pinnedIndices : null);

      // Native cluster forces: each point is assigned a cluster ordinal
      // (hybrid leiden + k-core) and cosmos.gl pulls it toward that
      // cluster's pre-computed center. simulationCluster in GraphConfig
      // governs the global force strength; setPointClusterStrength
      // scales the pull per point. Together they keep clusters spatially
      // distinct instead of collapsing into the link-spring dense ball.
      if (totalOrdinals > 0) {
        const pointClusters: (number | undefined)[] = new Array(pointCount);
        for (let i = 0; i < pointCount; i++) {
          const ord = resolveClusterOrdinal(pts[i], clusterContext);
          pointClusters[i] = ord ?? undefined;
          pool.clusterIds[i] = typeof ord === 'number' ? ord : -1;
        }
        const clusterPositions: (number | undefined)[] = new Array(totalOrdinals * 2);
        for (let ord = 0; ord < totalOrdinals; ord++) {
          const c = centersByOrdinal.get(ord);
          if (c) {
            clusterPositions[ord * 2] = c[0];
            clusterPositions[ord * 2 + 1] = c[1];
          }
        }
        graph.setPointClusters(pointClusters);
        graph.setClusterPositions(clusterPositions);
        // Per-point cluster pull coefficient. Uniform 0.7 is the
        // worm-look default from cosmos-pro recipes/clustering-force.md;
        // points without an ordinal stay at 0 (they ignore cluster
        // forces, as specified by setPointClusters `undefined` above).
        const pointClusterStrengths = new Float32Array(pointCount);
        for (let i = 0; i < pointCount; i++) {
          pointClusterStrengths[i] = pointClusters[i] === undefined ? 0 : 0.7;
        }
        graph.setPointClusterStrength(pointClusterStrengths);
      } else {
        pool.clusterIds.fill(-1);
        graph.setPointClusters([]);
        graph.setClusterPositions([]);
        graph.setPointClusterStrength(new Float32Array(pointCount));
      }

      encodingActiveRef.current = false;
      hypothesisMixFactorRef.current = 0;
      currentSalienceRef.current.clear();
      focalLabelsRef.current = [];

      const allPinned = pinnedIndices.length === pointCount;
      if (allPinned) {
        graph.render(0);
      } else {
        graph.render(1);
        graph.start?.(1);
      }
    }, [writeBaselineColors, writeBaselineLinkStyles, writeBaselineSizes]);

    pushDataToGraphRef.current = pushDataToGraph;

    // -------- Graph lifecycle --------------------------------------------

    // luma.gl's autoResize captures the canvas's initial clientWidth at
    // construction time; instantiating Graph during the React commit before
    // the grid layout resolves locks autoResize onto 0 and never recovers.
    // Observe the container and delay Graph construction until it has real
    // pixels.
    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let cancelled = false;
      let graph: Graph | null = null;
      let resizeObserver: ResizeObserver | null = null;

      const config: GraphConfig = {
        backgroundColor: [0, 0, 0, 0],
        spaceSize: 4096,
        // Resolved default via the VIE token pipeline. Overwritten by the
        // per-point setPointColors call in pushDataToGraph almost
        // immediately; this only shows during the single-frame gap
        // between Graph construction and the first data push.
        pointDefaultColor: cssVarToRgba('--vie-type-note', 1),
        pointDefaultSize: 10,
        pointSizeScale: 1.6,
        linkDefaultColor: cssVarToRgba('--vie-text-dim', 0.08),
        linkDefaultWidth: 0.8,
        linkOpacity: 1.0,
        renderLinks: true,
        renderHoveredPointRing: true,
        hoveredPointRingColor: cssVarToRgba('--vie-terra-hover', 1),
        hoveredPointCursor: 'pointer',
        enableDrag: true,
        enableZoom: true,
        fitViewOnInit: true,
        fitViewDelay: 1400,
        fitViewPadding: 0.2,
        // Flow-lens tuning. Strong repulsion + gentle cluster force
        // so communities have plenty of room to breathe. Infinite
        // decay keeps the sim alive; the per-tick onSimulationTick
        // handler layers rotation + wobble on top.
        simulationRepulsion: 3.8,
        simulationGravity: 0.18,
        simulationCenter: 0.04,
        simulationLinkSpring: 0.28,
        simulationLinkDistance: 70,
        simulationFriction: 0.85,
        // Cluster force kept light so communities are visible groups
        // without collapsing into dense balls.
        simulationCluster: 0.3,
        simulationDecay: Number.POSITIVE_INFINITY,
        scalePointsOnZoom: true,
        onSimulationTick: () => {
          const graph = graphRef.current;
          const pool = poolRef.current;
          if (!graph || !pool) return;
          const lens = lensRef.current;
          // Flow is the living worm. Orbit runs on its own rAF loop
          // (started from setLens) so we exit early there. Atlas and
          // Clusters are static, so skip too.
          if (lens !== 'flow') return;
          tickCounterRef.current += 1;

          const positions = graph.getPointPositions();
          if (!positions || positions.length < 2) return;
          const n = positions.length / 2;
          if (pool.rotationPositionScratch.length < positions.length) return;
          const out = pool.rotationPositionScratch;

          // Flow: rotate the whole graph around its centroid, then
          // add a per-point wobble so each node drifts on its own
          // phase. Macro spin + organic micro-drift.
          let cx = 0;
          let cy = 0;
          for (let i = 0; i < n; i++) {
            cx += positions[i * 2];
            cy += positions[i * 2 + 1];
          }
          cx /= n;
          cy /= n;

          // Macro rotation: ~22 degrees per second at 60fps. Under
          // prefers-reduced-motion the rate drops proportionally.
          const baseTheta = 0.0065;
          const theta = rotationEveryNTicksRef.current > 1
            ? baseTheta / rotationEveryNTicksRef.current
            : baseTheta;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);

          // Per-point wobble: unique phase based on golden-ratio
          // increments so adjacent indices drift out of sync. Larger
          // amplitude = more organic / worm-like feel.
          const time = tickCounterRef.current * (0.045 / rotationEveryNTicksRef.current);
          const wobbleAmp = rotationEveryNTicksRef.current > 1 ? 6 : 22;
          for (let i = 0; i < n; i++) {
            const dx = positions[i * 2] - cx;
            const dy = positions[i * 2 + 1] - cy;
            const rx = cx + dx * cosT - dy * sinT;
            const ry = cy + dx * sinT + dy * cosT;
            const phase = i * 0.618;
            const wobX = Math.sin(time + phase) * wobbleAmp;
            const wobY = Math.cos(time + phase * 1.3) * wobbleAmp;
            out[i * 2] = rx + wobX;
            out[i * 2 + 1] = ry + wobY;
          }
          // `dontRescale = true`: cosmos.gl re-fits the view on every
          // setPointPositions by default. Without this flag the
          // camera jumps every tick and the graph vanishes.
          graph.setPointPositions(out, true);
          graph.render?.();
        },
        onSimulationEnd: () => {
          graphRef.current?.fitView?.(600, 0.18, false);
          drawOverlay();
        },
        onZoom: () => {
          noteInteraction();
          drawOverlay();
          const listeners = zoomListenersRef.current;
          if (listeners.size > 0) {
            const graph = graphRef.current;
            if (graph) {
              const level = graph.getZoomLevel();
              for (const cb of listeners) {
                try {
                  cb(level);
                } catch {
                  // Listener misbehaviour must not break zoom event dispatch.
                }
              }
            }
          }
        },
        onMouseMove: () => {
          noteInteraction();
        },
        onPointMouseOver: (index) => {
          if (typeof index !== 'number') return;
          const pointId = indexToIdRef.current[index];
          if (!pointId) return;
          const tooltip = formatPrimitiveTooltip(
            primitiveMetadataRef.current.get(pointId),
          );
          if (containerRef.current) {
            containerRef.current.title = tooltip;
          }
        },
        onPointMouseOut: () => {
          if (containerRef.current) {
            containerRef.current.title = '';
          }
        },
        onDragStart: (event) => {
          noteInteraction();
          const index = event?.subject?.index;
          if (typeof index !== 'number') return;
          const pointId = indexToIdRef.current[index];
          if (!pointId) return;
          dragStateRef.current = {
            pointId,
            startedAt: [event.x, event.y],
          };
          onPointDragStartRef.current?.(pointId);
        },
        onDragEnd: (event) => {
          noteInteraction();
          const drag = dragStateRef.current;
          dragStateRef.current = null;
          if (!drag) return;
          const finalPosition: [number, number] | null =
            typeof event?.x === 'number' && typeof event?.y === 'number'
              ? [event.x, event.y]
              : null;
          onPointDragEndRef.current?.(drag.pointId, finalPosition);
          if (!finalPosition) return;
          const dx = finalPosition[0] - drag.startedAt[0];
          const dy = finalPosition[1] - drag.startedAt[1];
          if (Math.hypot(dx, dy) >= DRAG_REMOVE_THRESHOLD_PX) {
            onPointRemoveRequestedRef.current?.(drag.pointId);
          }
        },
        onClick: (index) => {
          noteInteraction();
          const cb = onPointClickRef.current;
          if (typeof index !== 'number') {
            lastClickRef.current = null;
            if (encodingActiveRef.current) {
              cancelConstructionInternal(false);
              restoreBaseline();
              focalLabelsRef.current = [];
              drawOverlay();
            }
            if (containerRef.current) {
              containerRef.current.title = '';
            }
            cb?.(null);
            return;
          }
          const pointId = indexToIdRef.current[index] ?? null;
          if (!pointId) {
            cb?.(null);
            return;
          }
          const now = performance.now();
          const last = lastClickRef.current;
          if (last && last.id === pointId && now - last.at <= DOUBLE_CLICK_MS) {
            lastClickRef.current = null;
            onPointDoubleClickRef.current?.(pointId);
            return;
          }
          lastClickRef.current = { id: pointId, at: now };
          cb?.(pointId);
        },
      };

      const construct = () => {
        if (cancelled || graph) return;
        graph = new Graph(container, config);
        graphRef.current = graph;
        if (process.env.NODE_ENV !== 'production') {
          (window as unknown as { __theseusGraph?: Graph }).__theseusGraph = graph;
        }
        sizeOverlayToContainer();
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
          }
          sizeOverlayToContainer();
          drawOverlay();
        });
        resizeObserver.observe(container);
      }

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && encodingActiveRef.current) {
          cancelConstructionInternal(false);
          restoreBaseline();
          focalLabelsRef.current = [];
          drawOverlay();
        }
        noteInteraction();
      };
      window.addEventListener('keydown', onKey);

      return () => {
        cancelled = true;
        graphRef.current = null;
        window.removeEventListener('keydown', onKey);
        resizeObserver?.disconnect();
        if (overlayAnimRef.current != null) {
          cancelAnimationFrame(overlayAnimRef.current);
          overlayAnimRef.current = null;
        }
        // Construction timers + raf: drop without invoking the final
        // callback to avoid running React state updates from a destroyed
        // component.
        const cstate = constructionStateRef.current;
        for (const t of cstate.phaseTimers) clearTimeout(t);
        cstate.phaseTimers = [];
        if (cstate.rafHandle != null) {
          cancelAnimationFrame(cstate.rafHandle);
          cstate.rafHandle = null;
        }
        cstate.active = false;
        cstate.finalCallback = null;
        // Ambient rAF cleanup.
        if (ambientRafRef.current != null) {
          cancelAnimationFrame(ambientRafRef.current);
          ambientRafRef.current = null;
        }
        ambientActiveRef.current = false;
        // Orbit rAF cleanup.
        if (orbitRafRef.current != null) {
          cancelAnimationFrame(orbitRafRef.current);
          orbitRafRef.current = null;
        }
        graph?.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-push when data identity changes.
    useLayoutEffect(() => {
      if (graphRef.current) pushDataToGraph();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [points, links, pinnedPositions]);

    // Theme flips invalidate the color cache; re-upload baseline and
    // any active encoding.
    useEffect(() => {
      resetTypeColorCache();
      resetClusterColorCache();
      const pool = poolRef.current;
      const graph = graphRef.current;
      const { points: pts, links: lks } = latestDataRef.current;
      if (!pool || !graph || pts.length === 0) return;
      writeBaselineColors(pool, pts);
      writeBaselineLinkStyles(pool, lks, idToIndexRef.current);
      if (encodingActiveRef.current) {
        const salienceArr = Array.from(currentSalienceRef.current.values());
        applySalienceToPool(salienceArr);
        if (hypothesisMixFactorRef.current > 0) {
          applyHypothesisMixToPool(hypothesisMixFactorRef.current);
        }
      } else {
        pool.encodedColors.set(pool.baseColors);
        pool.encodedLinkColors.set(pool.baseLinkColors);
        pool.colors.set(pool.baseColors);
        pool.linkColors.set(pool.baseLinkColors);
        applyFilterMaskToLive();
        graph.setPointColors(pool.colors);
        graph.setLinkColors(pool.linkColors);
      }
      drawOverlay();
    }, [
      applyFilterMaskToLive,
      applyHypothesisMixToPool,
      applySalienceToPool,
      drawOverlay,
      themeVersion,
      writeBaselineColors,
      writeBaselineLinkStyles,
    ]);

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', position: 'relative' }}
      >
        <canvas
          ref={overlayCanvasRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      </div>
    );
  },
);

export default CosmosGraphCanvas;
