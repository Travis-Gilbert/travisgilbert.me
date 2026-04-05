'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { mulberry32 } from '@/lib/prng';
import { renderPretextLabels, clearLabelCache } from '@/lib/galaxy/pretextLabels';

const DEFAULT_DOT_COLOR: [number, number, number] = [74, 138, 150];

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
  /** Set target rest position for a dot (spring physics pulls toward it) */
  setDotTarget(index: number, tx: number, ty: number): void;
  /** Reset dot target back to its original grid position */
  resetDotTarget(index: number): void;
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
}

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
}, ref) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const visibleRef = useRef(true);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const trailRef = useRef<{ x: number; y: number; age: number }[]>([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const startAnimationRef = useRef<(() => void) | null>(null);
  const drawStaticRef = useRef<(() => void) | null>(null);

  const dotsRef = useRef<{
    gx: Float32Array; gy: Float32Array;
    ox: Float32Array; oy: Float32Array;
    vx: Float32Array; vy: Float32Array;
    fade: Float32Array;
    kind: Uint8Array;
    count: number;
    // Galaxy layer: per-dot extended state
    galaxyClusterId: Int32Array;    // -1 = no cluster
    galaxyObjectType: Uint8Array;   // 0=none, 1=source, 2=concept, 3=person, 4=hunch, 5=note
    galaxyRelevant: Uint8Array;     // 0 or 1
    galaxyOpacity: Float32Array;    // NaN = use default
    galaxyColorR: Float32Array;     // NaN = use default
    galaxyColorG: Float32Array;
    galaxyColorB: Float32Array;
    // Target positions for answer construction
    targetGx: Float32Array;         // target grid x (spring pulls toward this)
    targetGy: Float32Array;         // target grid y
    hasTarget: Uint8Array;          // 0 = use original gx/gy, 1 = use targetGx/targetGy
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
    const targetGx = new Float32Array(count);
    const targetGy = new Float32Array(count);
    const hasTarget = new Uint8Array(count);

    dotsRef.current = {
      gx, gy,
      ox: new Float32Array(count),
      oy: new Float32Array(count),
      vx: new Float32Array(count),
      vy: new Float32Array(count),
      fade,
      kind,
      count,
      galaxyClusterId,
      galaxyObjectType,
      galaxyRelevant,
      galaxyOpacity,
      galaxyColorR,
      galaxyColorG,
      galaxyColorB,
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
      dots.hasTarget.fill(0);
      edgesRef.current = [];
      labelsRef.current = [];
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
      let bestDist = Infinity;
      let bestIndex = -1;
      for (let i = 0; i < dots.count; i++) {
        if (dots.galaxyClusterId[i] === -1) continue;
        const dx = (dots.gx[i] + dots.ox[i]) - x;
        const dy = (dots.gy[i] + dots.oy[i]) - y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
      if (bestIndex === -1 || bestDist > 2500) return null; // 50px radius
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
  }), []);

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
      r?: number, g?: number, b?: number,
    ) {
      const cr = r !== undefined && !Number.isNaN(r) ? r : rgb[0];
      const cg = g !== undefined && !Number.isNaN(g) ? g : rgb[1];
      const cb = b !== undefined && !Number.isNaN(b) ? b : rgb[2];
      ctx!.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;

      if (dotKind === 0) {
        ctx!.beginPath();
        ctx!.arc(x, y, dotRadius, 0, Math.PI * 2);
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

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;
        const opaOverride = dots.galaxyOpacity[i];
        const alpha = (Number.isNaN(opaOverride) ? dotOpacity : opaOverride) * dots.fade[i];
        drawDot(
          dots.gx[i], dots.gy[i], alpha, dots.kind[i],
          dots.galaxyColorR[i], dots.galaxyColorG[i], dots.galaxyColorB[i],
        );
      }
    }

    function drawEdgesAndLabels() {
      const dots = dotsRef.current;
      if (!dots) return;

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

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const isActive = mouseRef.current.active;
      const ir2 = influenceRadius * influenceRadius;
      let anyDisplaced = false;

      for (let i = 0; i < dots.count; i++) {
        if (dots.fade[i] < 0.01) continue;

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

        // Spring toward rest position (target or grid)
        dots.vx[i] += -restOffX * stiffness;
        dots.vy[i] += -restOffY * stiffness;
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
        );
      }

      // Draw edges and labels after dots (only wake loop when data changes)
      if (edgesRef.current.length > 0 || labelsRef.current.length > 0) {
        drawEdgesAndLabels();
        if (overlayDirtyRef.current) {
          anyDisplaced = true;
          overlayDirtyRef.current = false;
        }
      }

      if (!anyDisplaced) {
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

      startAnimation();
    }

    function onMouseLeave() {
      mouseRef.current.active = false;
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

    return () => {
      cancelAnimationFrame(animRef.current);
      cancelAnimationFrame(resizeRaf);
      observer.disconnect();
      if (!isTouchOnly) {
        window.removeEventListener('mousemove', onMouseMove);
      }
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('mouseleave', onMouseLeave);
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
