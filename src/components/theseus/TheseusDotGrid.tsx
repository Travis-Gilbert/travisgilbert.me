'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { mulberry32 } from '@/lib/prng';
import {
  renderPretextLabels,
  renderClickCard,
  renderInlineResponse,
  renderNavButtons,
  clearLabelCache,
  type ClickCardData,
  type NavButtonRenderData,
} from '@/lib/galaxy/pretextLabels';
import {
  layoutAttractors,
  recruitDotsForAttractor,
  tickAttractorPhysics,
  hitTestAttractor,
  type NavAttractor,
} from '@/lib/galaxy/navAttractors';

const DEFAULT_DOT_COLOR: [number, number, number] = [74, 138, 150];

// Shared empty set for the adaptive-nav recruited-dot lookup so the hot
// path doesn't allocate when no buttons are forming.
const EMPTY_RECRUITED: ReadonlySet<number> = new Set<number>();

// Type color tints (RGB) for subtle cluster coloring
const TYPE_TINTS: Record<string, [number, number, number]> = {
  source:  [45, 95, 107],   // bluer teal
  concept: [123, 94, 167],  // purple
  person:  [196, 80, 60],   // warm
  hunch:   [196, 154, 74],  // amber
  note:    [232, 229, 224], // cream
};

// Object type enum for typed array storage
const OBJECT_TYPE_MAP: Record<string, number> = {
  source: 1, concept: 2, person: 3, hunch: 4, note: 5,
};
const OBJECT_TYPE_REVERSE = ['none', 'source', 'concept', 'person', 'hunch', 'note'];

// Full-screen galaxy: uniform opacity with soft fade at the very edge
function computeFade(
  gx: Float32Array, gy: Float32Array, fade: Float32Array,
  count: number, w: number, h: number,
) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  for (let i = 0; i < count; i++) {
    const ddx = gx[i] - cx;
    const ddy = gy[i] - cy;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    const norm = dist / maxR;
    // Full opacity everywhere except a gentle fade at the outermost 8%
    fade[i] = norm > 0.92 ? 1.0 - ((norm - 0.92) / 0.08) * 0.6 : 1.0;
  }
}

export interface GalaxyDotState {
  /** Cluster ID mapped to this dot index, or null for ambient */
  clusterId: number | null;
  /** Dominant object type in the cluster */
  objectType: string | null;
  /** Whether this dot is relevant to the current query */
  isRelevant: boolean;
  /** Target position for answer construction (canvas coords) */
  targetX: number | null;
  targetY: number | null;
  /** Override opacity (0 to 1), null = use default */
  opacityOverride: number | null;
  /** Override RGB color, null = use default teal */
  colorOverride: [number, number, number] | null;
  /** Override dot radius multiplier (1.0 = normal), null = use default */
  scaleOverride: number | null;
}

export interface ClickCardInput {
  canvasX: number;
  canvasY: number;
  title: string;
  snippet: string;
  objectType: string;
  score: number;
  alpha: number;
  targetAlpha: number;
}

export interface InlineResponseInput {
  canvasX: number;
  canvasY: number;
  text: string;
  alpha: number;
  targetAlpha: number;
  visibleChars?: number;
}

export interface DotGridHandle {
  /** Total number of dots in the current grid */
  getDotCount(): number;
  /** Get grid position of dot at index */
  getDotPosition(index: number): { x: number; y: number } | null;
  /** Set galaxy state for a single dot */
  setDotGalaxyState(index: number, state: Partial<GalaxyDotState>): void;
  /** Batch set galaxy state for multiple dots */
  batchSetGalaxyState(updates: Array<{ index: number; state: Partial<GalaxyDotState> }>): void;
  /**
   * Override the rendered shape of a single dot. shapeId 0 = use the
   * existing kind logic (circle or binary glyph). shapeId 1 = render as
   * a square regardless of kind. Used by Pass 1a to mark web-source
   * dots so they read as a different category from the circular field.
   */
  setDotShape(index: number, shapeId: number): void;
  /** Reset all shape overrides back to 0 (use kind). */
  clearDotShapes(): void;
  /**
   * Toggle whether dots with kind=1 (the '0' glyph) and kind=2 (the
   * '1' glyph) actually render their glyph. When set to false, all
   * dots draw as plain circles regardless of kind. Used by Pass 1b
   * to clear binary glyphs during the THINKING state because they
   * read as the universal AI cliche and obscure the algorithmic
   * visualizations Phase B will add.
   */
  setBinaryGlyphsEnabled(enabled: boolean): void;
  /** Set target rest position for a dot (spring physics pulls toward it) */
  setDotTarget(index: number, tx: number, ty: number): void;
  /** Reset dot target back to its original grid position */
  resetDotTarget(index: number): void;
  /** Get the original grid rest position for a dot (before any target drift) */
  getOriginalGridPosition(index: number): { x: number; y: number } | null;
  /** Reset all dots to grid positions and clear galaxy state */
  resetAll(): void;
  /** Enable or disable pointer-events on the canvas */
  setPointerEvents(enabled: boolean): void;
  /** Force animation to start (wake from idle) */
  wakeAnimation(): void;
  /** Draw edges between dot pairs on the canvas */
  setEdges(edges: Array<{ fromIndex: number; toIndex: number; progress: number; color: string }>): void;
  /** Draw labels at positions on the canvas */
  setLabels(labels: Array<{ x: number; y: number; text: string; alpha: number }>): void;
  /** Find nearest dot with a cluster mapping to a screen position */
  findNearestClusterDot(x: number, y: number): { index: number; clusterId: number; x: number; y: number } | null;
  /** Find the N nearest dots to a given dot index, sorted by distance */
  findNearestDots(dotIndex: number, count: number): number[];
  /** Get canvas dimensions */
  getSize(): { width: number; height: number };
  /** Set click-card data for canvas rendering (null to dismiss) */
  setClickCard(card: ClickCardInput | null): void;
  /** Set inline response bubble data for canvas rendering (null to dismiss) */
  setInlineResponse(response: InlineResponseInput | null): void;
  /** Set zoom/pan transform for canvas-native rendering */
  setZoomTransform(scale: number, panX: number, panY: number): void;
  /** Get current zoom transform */
  getZoomTransform(): { scale: number; panX: number; panY: number };
  /** Convert screen coordinates to canvas space (accounts for zoom/pan) */
  screenToCanvas(sx: number, sy: number): { x: number; y: number };
  /**
   * Adaptive nav: set the active list of nav buttons. The grid recruits
   * background dots into button shapes at the bottom of the viewport using
   * navAttractors. Pass an empty array to dissolve all buttons.
   */
  setNavButtons(buttons: Array<{ id: string; label: string }>): void;
}

export type EngineState = 'IDLE' | 'THINKING' | 'MODEL' | 'CONSTRUCTING' | 'EXPLORING';

interface TheseusDotGridProps {
  dotRadius?: number;
  spacing?: number;
  dotColor?: [number, number, number];
  dotOpacity?: number;
  stiffness?: number;
  damping?: number;
  influenceRadius?: number;
  repulsionStrength?: number;
  binaryDensity?: number;
  engineState?: EngineState;
  /** Adaptive nav: fired when a fully-formed nav attractor is clicked. */
  onNavButtonClick?: (id: string) => void;
}

const TheseusDotGrid = forwardRef<DotGridHandle, TheseusDotGridProps>(function TheseusDotGrid({
  dotRadius = 0.85,
  spacing = 20,
  dotColor = DEFAULT_DOT_COLOR,
  dotOpacity = 0.18,
  stiffness = 0.35,
  damping = 0.48,
  influenceRadius = 100,
  repulsionStrength = 5,
  binaryDensity = 0.20,
  engineState = 'IDLE',
  onNavButtonClick,
}, ref) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const onNavButtonClickRef = useRef(onNavButtonClick);
  useEffect(() => {
    onNavButtonClickRef.current = onNavButtonClick;
  }, [onNavButtonClick]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const visibleRef = useRef(true);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const trailRef = useRef<{ x: number; y: number; age: number }[]>([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const startAnimationRef = useRef<(() => void) | null>(null);
  const drawStaticRef = useRef<(() => void) | null>(null);

  // Engine state animation: focal points and timing
  const engineStateRef = useRef<EngineState>('IDLE');
  const stateStartTimeRef = useRef<number>(0);
  const focalPointsRef = useRef<Array<{ x: number; y: number; orbitAngle: number }>>([]);

  // Canvas-native zoom/pan state (set by GalaxyController)
  const zoomRef = useRef({ scale: 1, panX: 0, panY: 0 });
  // Click card data for canvas rendering
  const clickCardRef = useRef<ClickCardInput | null>(null);
  // Inline response bubble data for canvas rendering
  const inlineResponseRef = useRef<InlineResponseInput | null>(null);

  const dotsRef = useRef<{
    gx: Float32Array; gy: Float32Array;
    ox: Float32Array; oy: Float32Array;
    vx: Float32Array; vy: Float32Array;
    fade: Float32Array;
    kind: Uint8Array;
    /**
     * Per-dot shape override. 0 = use the kind field (circle or binary
     * glyph). 1 = render as a square regardless of kind. Future shape
     * primitives (triangle, star, polygon) get higher numeric IDs.
     */
    shape: Uint8Array;
    count: number;
    // Galaxy layer: per-dot extended state
    galaxyClusterId: Int32Array;    // -1 = no cluster
    galaxyObjectType: Uint8Array;   // 0=none, 1=source, 2=concept, 3=person, 4=hunch, 5=note
    galaxyRelevant: Uint8Array;     // 0 or 1
    galaxyOpacity: Float32Array;    // NaN = use default
    galaxyColorR: Float32Array;     // NaN = use default
    galaxyColorG: Float32Array;
    galaxyColorB: Float32Array;
    galaxyScale: Float32Array;      // NaN = use default (1.0)
    // Target positions for answer construction
    targetGx: Float32Array;         // target grid x (spring pulls toward this)
    targetGy: Float32Array;         // target grid y
    hasTarget: Uint8Array;          // 0 = use original gx/gy, 1 = use targetGx/targetGy
  } | null>(null);

  /**
   * Renderer-wide flag for whether dots with kind=1 or kind=2 should
   * actually render their binary glyph. Default true. Set to false via
   * setBinaryGlyphsEnabled() during the THINKING state so the dot
   * field reads as a pure dot grid instead of the binary-1s-and-0s
   * "AI thinking" cliche. Held in a ref so the renderer's hot loop
   * doesn't pay a React re-render cost when toggled.
   */
  const binaryGlyphsEnabledRef = useRef(true);

  // Adaptive nav: attractor state and scratch buffers shared with the
  // navAttractors physics module. Scratch buffers hold the displayed
  // position (gx + ox) for recruited dots so navAttractors can read/write
  // a single coordinate, then we project the result back into ox.
  const attractorsRef = useRef<NavAttractor[]>([]);
  // Adaptive nav: id of the attractor currently under the cursor (or null).
  // Written by the mousemove handler in sync with the body cursor change;
  // read each frame by the render loop to drive label/border hover styling.
  const hoveredAttractorIdRef = useRef<string | null>(null);
  const attractorScratchRef = useRef<{
    posX: Float32Array;
    posY: Float32Array;
    homeX: Float32Array;
    homeY: Float32Array;
  } | null>(null);

  // Overlay drawing state (edges and labels set by controller)
  const edgesRef = useRef<Array<{ fromIndex: number; toIndex: number; progress: number; color: string }>>([]);
  const labelsRef = useRef<Array<{ x: number; y: number; text: string; alpha: number }>>([]);
  const overlayDirtyRef = useRef(false);

  const initDots = useCallback((w: number, h: number) => {
    const cols = Math.ceil(w / spacing) + 1;
    const rows = Math.ceil(h / spacing) + 1;
    const count = cols * rows;

    const gx = new Float32Array(count);
    const gy = new Float32Array(count);
    const kind = new Uint8Array(count);

    let idx = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        gx[idx] = col * spacing;
        gy[idx] = row * spacing;

        const rng = mulberry32(row * 1000 + col + 7919);
        if (rng() < binaryDensity) {
          kind[idx] = rng() < 0.5 ? 1 : 2; // 1 = '0', 2 = '1'
        } else {
          kind[idx] = 0; // circle
        }

        idx++;
      }
    }

    const fade = new Float32Array(count);
    computeFade(gx, gy, fade, count, w, h);

    // Galaxy arrays
    const galaxyClusterId = new Int32Array(count).fill(-1);
    const galaxyObjectType = new Uint8Array(count);
    const galaxyRelevant = new Uint8Array(count);
    const galaxyOpacity = new Float32Array(count).fill(NaN);
    const galaxyColorR = new Float32Array(count).fill(NaN);
    const galaxyColorG = new Float32Array(count).fill(NaN);
    const galaxyColorB = new Float32Array(count).fill(NaN);
    const galaxyScale = new Float32Array(count).fill(NaN);
    const targetGx = new Float32Array(count);
    const targetGy = new Float32Array(count);
    const hasTarget = new Uint8Array(count);
    // Pass 1a: per-dot shape override. Defaults to 0 (use kind).
    const shape = new Uint8Array(count);

    dotsRef.current = {
      gx, gy,
      ox: new Float32Array(count),
      oy: new Float32Array(count),
      vx: new Float32Array(count),
      vy: new Float32Array(count),
      fade,
      kind,
      shape,
      count,
      galaxyClusterId,
      galaxyObjectType,
      galaxyRelevant,
      galaxyOpacity,
      galaxyColorR,
      galaxyColorG,
      galaxyColorB,
      galaxyScale,
      targetGx,
      targetGy,
      hasTarget,
    };
  }, [spacing, binaryDensity]);

  // Shared setter used by both single and batch galaxy state updates
  function applyGalaxyState(index: number, state: Partial<GalaxyDotState>) {
    const dots = dotsRef.current;
    if (!dots || index < 0 || index >= dots.count) return;
    if (state.clusterId !== undefined) {
      dots.galaxyClusterId[index] = state.clusterId ?? -1;
    }
    if (state.objectType !== undefined) {
      dots.galaxyObjectType[index] = OBJECT_TYPE_MAP[state.objectType ?? ''] ?? 0;
    }
    if (state.isRelevant !== undefined) {
      dots.galaxyRelevant[index] = state.isRelevant ? 1 : 0;
    }
    if (state.opacityOverride !== undefined) {
      dots.galaxyOpacity[index] = state.opacityOverride ?? NaN;
    }
    if (state.colorOverride !== undefined) {
      if (state.colorOverride) {
        dots.galaxyColorR[index] = state.colorOverride[0];
        dots.galaxyColorG[index] = state.colorOverride[1];
        dots.galaxyColorB[index] = state.colorOverride[2];
      } else {
        dots.galaxyColorR[index] = NaN;
        dots.galaxyColorG[index] = NaN;
        dots.galaxyColorB[index] = NaN;
      }
    }
    if (state.scaleOverride !== undefined) {
      dots.galaxyScale[index] = state.scaleOverride ?? NaN;
    }
  }

  // Imperative handle for GalaxyController
  useImperativeHandle(ref, () => ({
    getDotCount() {
      return dotsRef.current?.count ?? 0;
    },
    getDotPosition(index: number) {
      const dots = dotsRef.current;
      if (!dots || index < 0 || index >= dots.count) return null;
      return { x: dots.gx[index] + dots.ox[index], y: dots.gy[index] + dots.oy[index] };
    },
    setDotGalaxyState(index: number, state: Partial<GalaxyDotState>) {
      applyGalaxyState(index, state);
    },
    batchSetGalaxyState(updates) {
      for (const { index, state } of updates) {
        applyGalaxyState(index, state);
      }
    },
    setDotShape(index: number, shapeId: number) {
      const dots = dotsRef.current;
      if (!dots || index < 0 || index >= dots.count) return;
      dots.shape[index] = shapeId;
    },
    clearDotShapes() {
      const dots = dotsRef.current;
      if (!dots) return;
      dots.shape.fill(0);
    },
    setBinaryGlyphsEnabled(enabled: boolean) {
      binaryGlyphsEnabledRef.current = enabled;
    },
    setDotTarget(index: number, tx: number, ty: number) {
      const dots = dotsRef.current;
      if (!dots || index < 0 || index >= dots.count) return;
      dots.targetGx[index] = tx;
      dots.targetGy[index] = ty;
      dots.hasTarget[index] = 1;
    },
    resetDotTarget(index: number) {
      const dots = dotsRef.current;
      if (!dots || index < 0 || index >= dots.count) return;
      dots.hasTarget[index] = 0;
    },
    getOriginalGridPosition(index: number) {
      const dots = dotsRef.current;
      if (!dots || index < 0 || index >= dots.count) return null;
      const { w } = sizeRef.current;
      const cols = Math.ceil(w / spacing) + 1;
      const col = index % cols;
      const row = Math.floor(index / cols);
      return { x: col * spacing, y: row * spacing };
    },
    resetAll() {
      const dots = dotsRef.current;
      if (!dots) return;
      dots.galaxyClusterId.fill(-1);
      dots.galaxyObjectType.fill(0);
      dots.galaxyRelevant.fill(0);
      dots.galaxyOpacity.fill(NaN);
      dots.galaxyColorR.fill(NaN);
      dots.galaxyColorG.fill(NaN);
      dots.galaxyColorB.fill(NaN);
      dots.galaxyScale.fill(NaN);
      dots.hasTarget.fill(0);
      edgesRef.current = [];
      labelsRef.current = [];
      inlineResponseRef.current = null;
    },
    setPointerEvents(enabled: boolean) {
      if (canvasRef.current) {
        canvasRef.current.style.pointerEvents = enabled ? 'auto' : 'none';
      }
    },
    wakeAnimation() {
      if (prefersReducedMotion) {
        drawStaticRef.current?.();
        return;
      }
      startAnimationRef.current?.();
    },
    setEdges(edges) {
      edgesRef.current = edges;
      overlayDirtyRef.current = true;
    },
    setLabels(labels) {
      labelsRef.current = labels;
      overlayDirtyRef.current = true;
    },
    findNearestClusterDot(x: number, y: number) {
      const dots = dotsRef.current;
      if (!dots) return null;
      // Convert screen coords to canvas space for zoom-aware hit testing
      const { x: cx, y: cy } = this.screenToCanvas(x, y);
      const { scale } = zoomRef.current;
      // Adjust hit radius: 50px at scale 1, shrinks at higher zoom
      const hitRadius2 = (50 / scale) * (50 / scale);
      let bestDist = Infinity;
      let bestIndex = -1;
      for (let i = 0; i < dots.count; i++) {
        if (dots.galaxyClusterId[i] === -1) continue;
        const dx = (dots.gx[i] + dots.ox[i]) - cx;
        const dy = (dots.gy[i] + dots.oy[i]) - cy;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
      if (bestIndex === -1 || bestDist > hitRadius2) return null;
      return {
        index: bestIndex,
        clusterId: dots.galaxyClusterId[bestIndex],
        x: dots.gx[bestIndex] + dots.ox[bestIndex],
        y: dots.gy[bestIndex] + dots.oy[bestIndex],
      };
    },
    findNearestDots(dotIndex: number, count: number): number[] {
      const pos = this.getDotPosition(dotIndex);
      if (!pos) return [];
      const distances: Array<{ index: number; dist: number }> = [];
      const total = this.getDotCount();
      for (let i = 0; i < total; i++) {
        if (i === dotIndex) continue;
        const other = this.getDotPosition(i);
        if (!other) continue;
        const dx = other.x - pos.x;
        const dy = other.y - pos.y;
        distances.push({ index: i, dist: dx * dx + dy * dy });
      }
      distances.sort((a, b) => a.dist - b.dist);
      return distances.slice(0, count).map((d) => d.index);
    },
    getSize() {
      return { width: sizeRef.current.w, height: sizeRef.current.h };
    },
    setClickCard(card: ClickCardInput | null) {
      clickCardRef.current = card;
      overlayDirtyRef.current = true;
      startAnimationRef.current?.();
    },
    setInlineResponse(response: InlineResponseInput | null) {
      inlineResponseRef.current = response;
      overlayDirtyRef.current = true;
      startAnimationRef.current?.();
    },
    setZoomTransform(scale: number, panX: number, panY: number) {
      zoomRef.current = { scale, panX, panY };
      overlayDirtyRef.current = true;
      startAnimationRef.current?.();
    },
    getZoomTransform() {
      return { ...zoomRef.current };
    },
    screenToCanvas(sx: number, sy: number) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: sx, y: sy };
      const { scale, panX, panY } = zoomRef.current;
      return {
        x: (sx - rect.left - panX) / scale,
        y: (sy - rect.top - panY) / scale,
      };
    },
    setNavButtons(buttons: Array<{ id: string; label: string }>) {
      const { w, h } = sizeRef.current;
      if (w < 1 || h < 1) return;
      attractorsRef.current = layoutAttractors(buttons, w, h, attractorsRef.current);
      startAnimationRef.current?.();
    },
  }), []);

  // Recompute focal points and restart animation when engine state changes
  useEffect(() => {
    const prevState = engineStateRef.current;
    engineStateRef.current = engineState;

    if (engineState === prevState) return;
    stateStartTimeRef.current = Date.now();

    const { w, h } = sizeRef.current;
    if (w < 1 || h < 1) return;

    if (engineState === 'IDLE' || engineState === 'EXPLORING') {
      focalPointsRef.current = [];
      // Clear engine-applied opacity overrides so dots return to default
      const dots = dotsRef.current;
      if (dots) {
        for (let i = 0; i < dots.count; i++) {
          if (!Number.isNaN(dots.galaxyOpacity[i]) && dots.galaxyClusterId[i] === -1) {
            dots.galaxyOpacity[i] = NaN;
          }
        }
      }
    } else {
      // Deterministic focal points distributed across viewport
      const count = engineState === 'MODEL' ? 3 : engineState === 'CONSTRUCTING' ? 2 : 4;
      const seed = Math.floor(stateStartTimeRef.current / 10000); // stable within 10s
      const rng = mulberry32(seed + 42);
      const points: Array<{ x: number; y: number; orbitAngle: number }> = [];
      for (let i = 0; i < count; i++) {
        points.push({
          x: w * 0.15 + rng() * w * 0.7,
          y: h * 0.15 + rng() * h * 0.7,
          orbitAngle: rng() * Math.PI * 2,
        });
      }
      focalPointsRef.current = points;
    }

    // For reduced motion: apply teal density instantly without drift
    if (prefersReducedMotion && engineState !== 'IDLE' && engineState !== 'EXPLORING') {
      const dots = dotsRef.current;
      if (dots) {
        const targetDensity = engineState === 'THINKING' ? 0.25
          : engineState === 'MODEL' ? 0.35
            : engineState === 'CONSTRUCTING' ? 0.50 : 0.18;
        for (let i = 0; i < dots.count; i++) {
          if (dots.galaxyClusterId[i] === -1 && Number.isNaN(dots.galaxyOpacity[i])) {
            // Apply density boost to a proportion of dots using deterministic selection
            const rng = mulberry32(i + 777);
            if (rng() < targetDensity) {
              dots.galaxyOpacity[i] = targetDensity;
            }
          }
        }
        drawStaticRef.current?.();
      }
    }

    // Wake animation for the state transition
    if (engineState !== 'IDLE') {
      startAnimationRef.current?.();
    }
  }, [engineState, prefersReducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let idleFrames = 0;
    let animating = false;

    const isTouchOnly =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none)').matches;

    const binaryFont = '7px "JetBrains Mono", monospace';
    const rgb = dotColor;

    let resizeRaf = 0;

    function resize() {
      clearLabelCache();
      const dpr = window.devicePixelRatio || 1;
      w = window.innerWidth;
      h = window.innerHeight;
      sizeRef.current = { w, h };
      if (w < 1 || h < 1) return;
      canvas!.width = Math.min(w * dpr, 8192);
      canvas!.height = Math.min(h * dpr, 8192);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initDots(w, h);
      drawStatic();
    }

    function debouncedResize() {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    }

    function drawDot(
      x: number, y: number, alpha: number, dotKind: number,
      r?: number, g?: number, b?: number, scale?: number,
      shapeId: number = 0,
    ) {
      const cr = r !== undefined && !Number.isNaN(r) ? r : rgb[0];
      const cg = g !== undefined && !Number.isNaN(g) ? g : rgb[1];
      const cb = b !== undefined && !Number.isNaN(b) ? b : rgb[2];
      const s = scale !== undefined && !Number.isNaN(scale) ? scale : 1;
      ctx!.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;

      // Pass 1a: shape override wins over kind. shapeId 1 = square,
      // matching the visual area of the default circle (side ≈ 2r).
      if (shapeId === 1) {
        const half = dotRadius * s;
        ctx!.fillRect(x - half, y - half, half * 2, half * 2);
        return;
      }

      // Pass 1b: when binary glyphs are gated off (THINKING state),
      // dots with kind=1 or kind=2 fall back to the circle render.
      const renderAsGlyph = (dotKind === 1 || dotKind === 2) && binaryGlyphsEnabledRef.current;

      if (!renderAsGlyph) {
        ctx!.beginPath();
        ctx!.arc(x, y, dotRadius * s, 0, Math.PI * 2);
        ctx!.fill();
      } else {
        ctx!.font = binaryFont;
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(dotKind === 1 ? '0' : '1', x, y);
      }
    }

    function drawStatic() {
      const dots = dotsRef.current;
      if (!dots) return;
      ctx!.clearRect(0, 0, w, h);

      const { scale: zs, panX: zpx, panY: zpy } = zoomRef.current;
      ctx!.save();
      ctx!.translate(zpx, zpy);
      ctx!.scale(zs, zs);

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        const opaOverride = dots.galaxyOpacity[i];
        const alpha = (Number.isNaN(opaOverride) ? dotOpacity : opaOverride) * dots.fade[i];
        drawDot(
          dots.gx[i], dots.gy[i], alpha, dots.kind[i],
          dots.galaxyColorR[i], dots.galaxyColorG[i], dots.galaxyColorB[i],
          dots.galaxyScale[i],
          dots.shape[i],
        );
      }

      ctx!.restore();
    }

    function drawEdgesAndLabels() {
      const dots = dotsRef.current;
      if (!dots) return;

      // Note: called within tick()'s save/translate/scale context

      // Draw edges
      const edges = edgesRef.current;
      for (const edge of edges) {
        if (edge.fromIndex < 0 || edge.fromIndex >= dots.count) continue;
        if (edge.toIndex < 0 || edge.toIndex >= dots.count) continue;
        const fx = dots.gx[edge.fromIndex] + dots.ox[edge.fromIndex];
        const fy = dots.gy[edge.fromIndex] + dots.oy[edge.fromIndex];
        const tx = dots.gx[edge.toIndex] + dots.ox[edge.toIndex];
        const ty = dots.gy[edge.toIndex] + dots.oy[edge.toIndex];
        const endX = fx + (tx - fx) * edge.progress;
        const endY = fy + (ty - fy) * edge.progress;

        ctx!.beginPath();
        ctx!.moveTo(fx, fy);
        ctx!.lineTo(endX, endY);
        ctx!.strokeStyle = edge.color;
        ctx!.lineWidth = 0.7;
        ctx!.globalAlpha = 0.30;
        ctx!.stroke();
        ctx!.globalAlpha = 1;
      }

      // Draw labels using Pretext for proper text measurement and wrapping
      renderPretextLabels(ctx!, labelsRef.current);
    }

    function tick() {
      const dots = dotsRef.current;
      if (!dots || !visibleRef.current) { animating = false; return; }

      ctx!.clearRect(0, 0, w, h);

      const { scale: zs, panX: zpx, panY: zpy } = zoomRef.current;
      ctx!.save();
      ctx!.translate(zpx, zpy);
      ctx!.scale(zs, zs);

      const trail = trailRef.current;
      for (let t = trail.length - 1; t >= 0; t--) {
        trail[t].age++;
        if (trail[t].age > 60) {
          trail.splice(t, 1);
          continue;
        }
        const opacity = (1 - trail[t].age / 60) * 0.12;
        const radius = 1.2 + (trail[t].age / 60) * 0.5;
        ctx!.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
        ctx!.beginPath();
        ctx!.arc(trail[t].x, trail[t].y, radius, 0, Math.PI * 2);
        ctx!.fill();
      }
      if (trail.length > 0) idleFrames = 0;

      // Transform mouse to canvas space so repulsion works at any zoom
      const mx = (mouseRef.current.x - zpx) / zs;
      const my = (mouseRef.current.y - zpy) / zs;
      const isActive = mouseRef.current.active;
      const ir2 = influenceRadius * influenceRadius;
      let anyDisplaced = false;

      // Hoist engine state computations above the per-dot loop
      const eState = engineStateRef.current;
      const focalPts = focalPointsRef.current;
      const driftActive = focalPts.length > 0 && eState !== 'IDLE' && eState !== 'EXPLORING';
      let driftElapsed = 0;
      let driftSpeed = 0;
      let driftRadius2 = 0;
      let targetDensity = 0;
      let rampedOpacity = 0;
      let dimFactor = 1.0;
      const DRIFT_RADIUS = 200;

      if (driftActive) {
        driftElapsed = (Date.now() - stateStartTimeRef.current) / 1000;
        driftSpeed = eState === 'MODEL' ? 0.5
          : eState === 'CONSTRUCTING' ? 0.2 : 0.3;
        driftRadius2 = DRIFT_RADIUS * DRIFT_RADIUS;
        targetDensity = eState === 'THINKING' ? 0.25
          : eState === 'MODEL' ? 0.35
            : eState === 'CONSTRUCTING' ? 0.50 : 0.18;
        const rampProgress = Math.min(driftElapsed / 6, 1);
        rampedOpacity = dotOpacity + (targetDensity - dotOpacity) * rampProgress;
        dimFactor = eState === 'CONSTRUCTING' ? 0.3
          : eState === 'MODEL' ? 0.6 : 1.0;
      }

      // Adaptive nav: build a fast lookup of currently-recruited dots so
      // they bypass home-spring and mouse-repulsion (their motion is owned
      // by tickAttractorPhysics below). Phase B color/opacity overrides
      // still apply to these dots when we draw them.
      const navAttractors = attractorsRef.current;
      let recruitedSet: ReadonlySet<number> = EMPTY_RECRUITED;
      if (navAttractors.length > 0) {
        const built = new Set<number>();
        for (const a of navAttractors) {
          for (const di of a.recruitedDots) built.add(di);
        }
        recruitedSet = built;
      }

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        if (recruitedSet.has(i)) continue;

        // If dot has a target, spring toward target instead of grid
        const baseX = dots.hasTarget[i] ? dots.targetGx[i] : dots.gx[i];
        const baseY = dots.hasTarget[i] ? dots.targetGy[i] : dots.gy[i];

        // Compute offset relative to current rest position
        const currentX = dots.gx[i] + dots.ox[i];
        const currentY = dots.gy[i] + dots.oy[i];
        const restOffX = currentX - baseX;
        const restOffY = currentY - baseY;

        if (isActive) {
          const ddx = currentX - mx;
          const ddy = currentY - my;
          const d2 = ddx * ddx + ddy * ddy;

          if (d2 < ir2 && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const force = (1 - d / influenceRadius) * repulsionStrength;
            dots.vx[i] += (ddx / d) * force * 0.1;
            dots.vy[i] += (ddy / d) * force * 0.1;
          }
        }

        // Engine state orbital drift (non-IDLE states)
        let springMul = 1.0;

        if (driftActive) {
          // Find nearest focal point
          let nearestFocal = focalPts[0];
          let nearestDist2 = Infinity;
          for (const fp of focalPts) {
            const fdx = currentX - fp.x;
            const fdy = currentY - fp.y;
            const fd2 = fdx * fdx + fdy * fdy;
            if (fd2 < nearestDist2) {
              nearestDist2 = fd2;
              nearestFocal = fp;
            }
          }

          if (nearestDist2 < driftRadius2) {
            const nearestDist = Math.sqrt(nearestDist2);
            const proximity = 1 - nearestDist / DRIFT_RADIUS;

            // Tangential velocity (perpendicular to vector from focal point)
            if (nearestDist > 1) {
              const nx = (currentX - nearestFocal.x) / nearestDist;
              const ny = (currentY - nearestFocal.y) / nearestDist;
              const tx = -ny;
              const ty = nx;
              const orbitalSpeed = driftSpeed * proximity * 0.1;
              dots.vx[i] += tx * orbitalSpeed;
              dots.vy[i] += ty * orbitalSpeed;
            }

            springMul = 0.3 + (1 - proximity) * 0.7;
            anyDisplaced = true;
          }

          // Teal density ramp for dots not already colored by galaxy state
          if (Number.isNaN(dots.galaxyOpacity[i]) && nearestDist2 < driftRadius2) {
            const proximity = 1 - Math.sqrt(nearestDist2) / DRIFT_RADIUS;
            const finalOpacity = dotOpacity * dimFactor + (rampedOpacity - dotOpacity * dimFactor) * proximity;
            dots.galaxyOpacity[i] = finalOpacity;
          }
        }

        // Spring toward rest position (target or grid)
        dots.vx[i] += -restOffX * stiffness * springMul;
        dots.vy[i] += -restOffY * stiffness * springMul;
        dots.vx[i] *= damping;
        dots.vy[i] *= damping;
        dots.ox[i] += dots.vx[i];
        dots.oy[i] += dots.vy[i];

        // For target dots, also move the grid origin toward target
        if (dots.hasTarget[i]) {
          const driftX = (dots.targetGx[i] - dots.gx[i]) * 0.02;
          const driftY = (dots.targetGy[i] - dots.gy[i]) * 0.02;
          if (Math.abs(driftX) > 0.01 || Math.abs(driftY) > 0.01) {
            dots.gx[i] += driftX;
            dots.gy[i] += driftY;
            anyDisplaced = true;
          }
        }

        if (dots.ox[i] * dots.ox[i] + dots.oy[i] * dots.oy[i] > 0.01) {
          anyDisplaced = true;
        }

        // Galaxy color: use override, or subtle type tint, or default teal
        const opaOverride = dots.galaxyOpacity[i];
        const alpha = (Number.isNaN(opaOverride) ? dotOpacity : opaOverride) * dots.fade[i];

        let dotR = dots.galaxyColorR[i];
        let dotG = dots.galaxyColorG[i];
        let dotB = dots.galaxyColorB[i];

        // If no explicit color override, apply subtle type tint for cluster dots
        if (Number.isNaN(dotR) && dots.galaxyClusterId[i] !== -1 && dots.galaxyObjectType[i] > 0) {
          const typeName = OBJECT_TYPE_REVERSE[dots.galaxyObjectType[i]];
          const tint = TYPE_TINTS[typeName];
          if (tint) {
            // Blend 20% toward type color for very subtle tinting at idle
            const blend = dots.galaxyRelevant[i] ? 0.8 : 0.2;
            dotR = rgb[0] + (tint[0] - rgb[0]) * blend;
            dotG = rgb[1] + (tint[1] - rgb[1]) * blend;
            dotB = rgb[2] + (tint[2] - rgb[2]) * blend;
          } else {
            dotR = NaN;
            dotG = NaN;
            dotB = NaN;
          }
        }

        drawDot(
          dots.gx[i] + dots.ox[i], dots.gy[i] + dots.oy[i],
          alpha, dots.kind[i],
          dotR, dotG, dotB,
          dots.galaxyScale[i],
          dots.shape[i],
        );
      }

      // Advance focal point orbit angles once per frame (not per dot)
      if (driftActive) {
        for (const fp of focalPts) {
          fp.orbitAngle += 0.0003;
        }
      }

      // ----- Adaptive nav: attractor physics + render -----
      if (navAttractors.length > 0) {
        // Lazy-allocate scratch buffers sized to the current dot count.
        let scratch = attractorScratchRef.current;
        if (!scratch || scratch.posX.length !== dots.count) {
          scratch = {
            posX: new Float32Array(dots.count),
            posY: new Float32Array(dots.count),
            homeX: new Float32Array(dots.count),
            homeY: new Float32Array(dots.count),
          };
          attractorScratchRef.current = scratch;
        }

        // Snapshot current displayed positions and home positions for all
        // dots that are (or are about to be) recruited. We only need the
        // entries we will touch, but reading the full array is cheap.
        for (let i = 0; i < dots.count; i++) {
          scratch.posX[i] = dots.gx[i] + dots.ox[i];
          scratch.posY[i] = dots.gy[i] + dots.oy[i];
          scratch.homeX[i] = dots.gx[i];
          scratch.homeY[i] = dots.gy[i];
        }

        // Recruit dots for any attractor that is forming but has not
        // claimed dots yet. Tracks the union so dots are never assigned
        // to two attractors.
        const claimed = new Set<number>();
        for (const a of navAttractors) {
          for (const di of a.recruitedDots) claimed.add(di);
        }
        for (const a of navAttractors) {
          if (a.targetFormation === 1 && a.recruitedDots.size === 0) {
            recruitDotsForAttractor(a, scratch.posX, scratch.posY, claimed);
          }
        }

        tickAttractorPhysics(
          navAttractors,
          scratch.posX,
          scratch.posY,
          scratch.homeX,
          scratch.homeY,
          dots.vx,
          dots.vy,
        );

        // Project new positions back into the host's gx/ox split and draw
        // the recruited dots (they were skipped by the main loop above).
        for (const a of navAttractors) {
          for (const di of a.recruitedDots) {
            if (di < 0 || di >= dots.count) continue;
            dots.ox[di] = scratch.posX[di] - dots.gx[di];
            dots.oy[di] = scratch.posY[di] - dots.gy[di];

            const opaOverride = dots.galaxyOpacity[di];
            const baseAlpha = (Number.isNaN(opaOverride) ? dotOpacity : opaOverride) * dots.fade[di];
            drawDot(
              scratch.posX[di], scratch.posY[di],
              baseAlpha, dots.kind[di],
              dots.galaxyColorR[di], dots.galaxyColorG[di], dots.galaxyColorB[di],
              dots.galaxyScale[di],
              dots.shape[di],
            );
          }
          // Keep animating while any attractor is in flight.
          if (Math.abs(a.formation - a.targetFormation) > 0.001) {
            anyDisplaced = true;
          }
        }

        // Prune fully-dissolved attractors.
        const keep: NavAttractor[] = [];
        for (const a of navAttractors) {
          if (a.formation < 0.005 && a.targetFormation === 0) continue;
          keep.push(a);
        }
        if (keep.length !== navAttractors.length) {
          attractorsRef.current = keep;
        }
      }

      // Adaptive nav: render labels (and high-formation pill borders) on top
      // of the recruited dot clusters every frame, since alpha/formation
      // animate continuously.
      if (attractorsRef.current.length > 0) {
        const hoveredId = hoveredAttractorIdRef.current;
        const navButtonData: NavButtonRenderData[] = attractorsRef.current.map((attractor) => ({
          cx: attractor.cx,
          cy: attractor.cy,
          width: attractor.width,
          height: attractor.height,
          label: attractor.label,
          alpha: attractor.alpha,
          isHovered: hoveredId === attractor.id,
          prominence: 1.0, // Batch 4 will plumb prediction probability through
        }));
        renderNavButtons(ctx!, navButtonData);
      }
      // ----- /Adaptive nav -----

      // Draw edges and labels after dots (only wake loop when data changes)
      if (edgesRef.current.length > 0 || labelsRef.current.length > 0) {
        drawEdgesAndLabels();
        if (overlayDirtyRef.current) {
          anyDisplaced = true;
          overlayDirtyRef.current = false;
        }
      }

      // Click card rendering (inside zoom transform so it scales with the scene)
      const card = clickCardRef.current;
      if (card) {
        const alphaSpeed = card.targetAlpha > card.alpha ? 0.12 : 0.08;
        card.alpha += (card.targetAlpha - card.alpha) * alphaSpeed;
        if (Math.abs(card.alpha - card.targetAlpha) < 0.01) card.alpha = card.targetAlpha;
        if (card.alpha > 0.01) {
          renderClickCard(ctx!, card, w / zs, h / zs);
        }
        // Only keep animating while alpha is still transitioning
        if (Math.abs(card.alpha - card.targetAlpha) > 0.01) {
          anyDisplaced = true;
        }
      }

      ctx!.restore(); // End zoom/pan transform

      // Inline response rendering (outside zoom transform; fixed to viewport)
      const inlineResponse = inlineResponseRef.current;
      if (inlineResponse) {
        const alphaSpeed = inlineResponse.targetAlpha > inlineResponse.alpha ? 0.12 : 0.08;
        inlineResponse.alpha += (inlineResponse.targetAlpha - inlineResponse.alpha) * alphaSpeed;
        if (Math.abs(inlineResponse.alpha - inlineResponse.targetAlpha) < 0.01) {
          inlineResponse.alpha = inlineResponse.targetAlpha;
        }

        if (inlineResponse.alpha > 0.01 && inlineResponse.text.trim().length > 0) {
          renderInlineResponse(ctx!, inlineResponse, w, h);
        }

        if (Math.abs(inlineResponse.alpha - inlineResponse.targetAlpha) > 0.01) {
          anyDisplaced = true;
        }
      }

      // Keep animating during non-IDLE engine states
      const activeEngine = engineStateRef.current !== 'IDLE' && engineStateRef.current !== 'EXPLORING';
      if (!anyDisplaced && !activeEngine) {
        idleFrames++;
        if (idleFrames > 60) { animating = false; return; }
      } else {
        idleFrames = 0;
      }

      animRef.current = requestAnimationFrame(tick);
    }

    function startAnimation() {
      if (animating) return;
      animating = true;
      idleFrames = 0;
      animRef.current = requestAnimationFrame(tick);
    }

    startAnimationRef.current = startAnimation;
    drawStaticRef.current = drawStatic;

    function onMouseMove(e: MouseEvent) {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;

      const trail = trailRef.current;
      trail.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (trail.length > 40) trail.shift();

      // Adaptive nav: pointer cursor when over a fully-formed button.
      // Apply directly to body since the canvas uses pointer-events: none.
      const navAttractors = attractorsRef.current;
      if (navAttractors.length > 0) {
        const hit = hitTestAttractor(navAttractors, e.clientX, e.clientY);
        const wantsPointer = hit !== null && hit.formation > 0.8;
        if (wantsPointer && document.body.style.cursor !== 'pointer') {
          document.body.style.cursor = 'pointer';
        } else if (!wantsPointer && document.body.style.cursor === 'pointer') {
          document.body.style.cursor = '';
        }
        hoveredAttractorIdRef.current = wantsPointer && hit ? hit.id : null;
      } else {
        hoveredAttractorIdRef.current = null;
      }

      startAnimation();
    }

    function onMouseLeave() {
      mouseRef.current.active = false;
    }

    function onWindowClick(e: MouseEvent) {
      const navAttractors = attractorsRef.current;
      if (navAttractors.length === 0) return;
      const hit = hitTestAttractor(navAttractors, e.clientX, e.clientY);
      if (!hit) return;
      onNavButtonClickRef.current?.(hit.id);
      e.stopPropagation();
    }

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(canvas);

    resize();

    if (prefersReducedMotion) {
      window.addEventListener('resize', debouncedResize);

      return () => {
        cancelAnimationFrame(resizeRaf);
        observer.disconnect();
        window.removeEventListener('resize', debouncedResize);
        startAnimationRef.current = null;
      };
    }

    if (!isTouchOnly) {
      window.addEventListener('mousemove', onMouseMove, { passive: true });
    }
    window.addEventListener('resize', debouncedResize);
    document.addEventListener('mouseleave', onMouseLeave);
    // Adaptive nav: capture-phase so the hit-test fires before downstream
    // page handlers.
    window.addEventListener('click', onWindowClick, true);

    return () => {
      cancelAnimationFrame(animRef.current);
      cancelAnimationFrame(resizeRaf);
      observer.disconnect();
      if (!isTouchOnly) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('click', onWindowClick, true);
      if (document.body.style.cursor === 'pointer') {
        document.body.style.cursor = '';
      }
      startAnimationRef.current = null;
    };
  }, [dotRadius, spacing, dotColor, dotOpacity, stiffness, damping, influenceRadius, repulsionStrength, initDots, prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
});

export default TheseusDotGrid;
