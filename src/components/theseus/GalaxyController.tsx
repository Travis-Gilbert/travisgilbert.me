'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DotGridHandle } from './TheseusDotGrid';
import type { ClusterSummary, EvidenceEdge, EvidenceNode, TheseusResponse, WhatIfResult } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import type { VizPrediction, VizType } from '@/lib/theseus-viz/vizPlanner';
import { getClusters } from '@/lib/theseus-api';
import { mulberry32 } from '@/lib/prng';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { TYPE_COLORS } from './renderers/rendering';
import { computeGraphLayout, computeClusterLayout } from './galaxyLayout';
import { generateTargets, generateTruthMapTargets } from '@/lib/galaxy/TargetGenerator';
import { resolveCollisions, clearLabelCache } from '@/lib/galaxy/pretextLabels';
import type { MapSection, GeographicRegionsSection } from '@/lib/theseus-types';
import type { TruthMapTopologyDirective } from '@/lib/theseus-viz/SceneDirective';
import {
  runStippleConstruction,
  animateStippleConstruction,
  runArgumentTransition,
  type StippleConstructionResult,
} from '@/lib/galaxy/stippleConstruction';
import GalaxyDrawer from './GalaxyDrawer';
import type { SourceTrailItem } from './SourceTrail';
import { getColorStrategy } from '@/lib/galaxy/e4bVision';
import type { AnswerType } from '@/lib/theseus-types';
import type { AskState } from '@/app/theseus/ask/page';
import { stippleFace } from '@/lib/galaxy/StipplingDirector';
import {
  tagFaceDots,
  animateFaceDots,
  tickIdleAnimation,
  type TaggedDot,
  type FaceAnimationState,
  type BlinkTimer,
} from '@/lib/galaxy/FaceAnimator';

const DRAG_THRESHOLD_PX = 4;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.15;

const GEO_SCORE_TIERS = [
  { min: 0.85, rgb: [45, 95, 107] as [number, number, number], hex: '#2d5f6b', label: 'Highly Recommended' },
  { min: 0.75, rgb: [74, 138, 150] as [number, number, number], hex: '#4a8a96', label: 'Recommended' },
  { min: 0.65, rgb: [196, 154, 74] as [number, number, number], hex: '#c49a4a', label: 'Worth Considering' },
] as const;

const GEO_SCORE_DEFAULT_RGB: [number, number, number] = [156, 149, 141];

function geoScoreToRgb(score: number): [number, number, number] {
  for (const tier of GEO_SCORE_TIERS) {
    if (score >= tier.min) return [...tier.rgb];
  }
  return [...GEO_SCORE_DEFAULT_RGB];
}

export function geoScoreToHex(score: number): string {
  for (const tier of GEO_SCORE_TIERS) {
    if (score >= tier.min) return tier.hex;
  }
  return '#9c958d';
}

const GEO_PAD_RATIO = 0.1;

function geoMapLayout(width: number, height: number) {
  const padX = width * GEO_PAD_RATIO;
  const padY = height * GEO_PAD_RATIO;
  return { padX, padY, usableW: width - padX * 2, usableH: height - padY * 2 };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface ClusterDotMapping {
  clusterId: number;
  dotIndex: number;
  label: string;
  memberCount: number;
  topObjects: string[];
  objectType: string;
}

type ConstructionPhase = 'idle' | 'searching' | 'filtering' | 'construction' | 'crystallize' | 'explore';

interface GalaxyControllerProps {
  gridRef: React.RefObject<DotGridHandle | null>;
  state: AskState;
  response: TheseusResponse | null;
  directive: SceneDirective | null;
  dataStatus?: DataProcessingStatus | null;
  vizPrediction?: VizPrediction | null;
  argumentView?: boolean;
  onSourceExplored?: (item: SourceTrailItem) => void;
  mouthOpenRef?: React.RefObject<number>;
}

export default function GalaxyController({
  gridRef,
  state,
  response,
  directive,
  dataStatus,
  vizPrediction,
  argumentView,
  onSourceExplored,
  mouthOpenRef,
}: GalaxyControllerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  // Canvas-native zoom/pan (driven by wheel, double-click, pinch)
  const zoomScaleRef = useRef(1);
  const zoomPanRef = useRef({ x: 0, y: 0 });
  const zoomAnimRef = useRef<number>(0);
  const [infoCard, setInfoCard] = useState<{
    cluster: ClusterDotMapping;
    screenX: number;
    screenY: number;
  } | null>(null);

  const mappingsRef = useRef<ClusterDotMapping[]>([]);
  const prevStateRef = useRef<AskState>('IDLE');
  const phaseRef = useRef<ConstructionPhase>('idle');
  const phaseTimerRef = useRef<number>(0);
  const visionTimerIdsRef = useRef<number[]>([]);
  const edgeProgressRef = useRef<number>(0);
  const labelAlphaRef = useRef<number>(0);
  // Map from object_id to dot index for answer construction
  const objectDotMapRef = useRef<Map<string, number>>(new Map());
  // Recruited neighborhood dots (for constellation cleanup)
  const recruitedDotsRef = useRef<Set<number>>(new Set());
  // Original grid positions for reset
  const originalPositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Data acquisition pulsing
  const pulseIntervalRef = useRef<number>(0);
  const [isAcquiring, setIsAcquiring] = useState(false);
  // Drawer for cluster detail exploration
  const [drawerObjectId, setDrawerObjectId] = useState<string | null>(null);
  const [showGeoLegend, setShowGeoLegend] = useState(false);
  // Track which evidence dot is hovered for visual feedback
  const hoveredDotRef = useRef<number | null>(null);
  // Click-card: tracked via the grid's own clickCardRef
  const clickCardTimerRef = useRef<number>(0);
  const geoSectionRef = useRef<GeographicRegionsSection | null>(null);
  // Track previous query for follow-up transitions
  const prevQueryRef = useRef<string | null>(null);
  // Cached response objects for click-card content lookup
  const responseObjectsRef = useRef<Array<{
    id: string; title: string; snippet: string; object_type: string; score: number;
  }>>([]);
  // Track predicted viz type without triggering effect re-runs
  const predTypeRef = useRef<VizType>('graph-native');
  // Stipple construction cleanup and result
  const stippleCleanupRef = useRef<(() => void) | null>(null);
  const stippleResultRef = useRef<StippleConstructionResult | null>(null);
  // Face idle state
  const faceTaggedRef = useRef<TaggedDot[]>([]);
  const faceAnimStateRef = useRef<FaceAnimationState>({ mouthOpen: 0, blinkAmount: 0, breathPhase: 0 });
  const faceBlinkTimerRef = useRef<BlinkTimer>({ nextBlink: performance.now() + 5000, blinking: false, blinkStart: 0 });
  const faceAnimFrameRef = useRef<number>(0);
  const faceActiveRef = useRef(false);
  const faceWasActiveRef = useRef(false);
  const faceDotCountRef = useRef(0);
  const faceLastTickRef = useRef(0);

  // Keep predTypeRef current without triggering the main animation effect
  useEffect(() => {
    predTypeRef.current = vizPrediction?.type ?? 'graph-native';
  }, [vizPrediction]);

  // "Show me why" toggle: switch between answer view and argument structure
  const prevArgumentViewRef = useRef<{ view: boolean; responseQuery: string | null }>({ view: false, responseQuery: null });
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !response || state !== 'EXPLORING') return;
    const currentView = argumentView ?? false;
    const currentQuery = response.query ?? null;
    const prev = prevArgumentViewRef.current;
    // Skip if nothing changed (both view and response are the same)
    if (currentView === prev.view && currentQuery === prev.responseQuery) return;
    prevArgumentViewRef.current = { view: currentView, responseQuery: currentQuery };

    const evidencePath = response.sections.find((s) => s.type === 'evidence_path');
    const nodes: EvidenceNode[] = evidencePath && 'nodes' in evidencePath ? evidencePath.nodes : [];
    const edges: EvidenceEdge[] = evidencePath && 'edges' in evidencePath ? evidencePath.edges : [];

    if (nodes.length === 0) return;

    // Clean up previous stipple animation
    stippleCleanupRef.current?.();

    if (argumentView) {
      // Transition to argument structure view
      runArgumentTransition(nodes, edges, directive, grid).then((result) => {
        if (!result) return;
        stippleResultRef.current = result;
        for (const idx of result.recruitedDotIndices) {
          recruitedDotsRef.current.add(idx);
        }
        const cleanup = animateStippleConstruction(
          grid, result, result.stippleResult.targets, nodes, prefersReducedMotion,
        );
        stippleCleanupRef.current = cleanup;
      });
    } else {
      // Return to answer view: re-stipple with the original renderer
      const vizType = predTypeRef.current;
      runStippleConstruction(vizType, nodes, edges, directive, grid, {
        theatricality: 0.1,
        instant: prefersReducedMotion,
      }).then((result) => {
        if (!result) return;
        stippleResultRef.current = result;
        for (const idx of result.recruitedDotIndices) {
          recruitedDotsRef.current.add(idx);
        }
        const cleanup = animateStippleConstruction(
          grid, result, result.stippleResult.targets, nodes, prefersReducedMotion,
        );
        stippleCleanupRef.current = cleanup;
      });
    }
  }, [argumentView, response, directive, state, gridRef, prefersReducedMotion]);

  // Fetch clusters on mount
  useEffect(() => {
    let cancelled = false;
    getClusters().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        console.warn('[Galaxy] Cluster fetch failed:', result.status, result.message);
        return;
      }
      console.log('[Galaxy] Loaded', result.clusters.length, 'clusters');
      setClusters(result.clusters);
    });
    return () => { cancelled = true; };
  }, []);

  // Map clusters to dot positions
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || clusters.length === 0) return;

    const dotCount = grid.getDotCount();
    if (dotCount === 0) return;

    const newMappings: ClusterDotMapping[] = [];
    const usedIndices = new Set<number>();

    for (const cluster of clusters) {
      const rng = mulberry32(cluster.id + 4219);
      let dotIndex = Math.floor(rng() * dotCount);

      let attempts = 0;
      while (usedIndices.has(dotIndex) && attempts < 100) {
        dotIndex = (dotIndex + 1) % dotCount;
        attempts++;
      }
      if (usedIndices.has(dotIndex)) continue;
      usedIndices.add(dotIndex);

      const labelLower = cluster.label.toLowerCase();
      let objectType = 'note';
      if (labelLower.includes('source') || labelLower.includes('paper') || labelLower.includes('book')) {
        objectType = 'source';
      } else if (labelLower.includes('concept') || labelLower.includes('idea') || labelLower.includes('theory')) {
        objectType = 'concept';
      } else if (labelLower.includes('person') || labelLower.includes('people') || labelLower.includes('author')) {
        objectType = 'person';
      } else if (labelLower.includes('hunch') || labelLower.includes('hypothesis')) {
        objectType = 'hunch';
      }

      newMappings.push({
        clusterId: cluster.id,
        dotIndex,
        label: cluster.label,
        memberCount: cluster.member_count,
        topObjects: cluster.top_objects,
        objectType,
      });

      // Save original grid position for reset
      const pos = grid.getDotPosition(dotIndex);
      if (pos) {
        originalPositionsRef.current.set(dotIndex, { x: pos.x, y: pos.y });
      }

      grid.setDotGalaxyState(dotIndex, {
        clusterId: cluster.id,
        objectType,
        isRelevant: false,
        opacityOverride: null,
        colorOverride: null,
      });
    }

    mappingsRef.current = newMappings;

    // Cluster dot fade-in: ramp opacity from ambient to type-tinted over 500ms
    if (!prefersReducedMotion && newMappings.length > 0) {
      let fadeStep = 0;
      const fadeSteps = 10;
      const fadeInterval = window.setInterval(() => {
        fadeStep++;
        const t = fadeStep / fadeSteps;
        for (const m of newMappings) {
          grid.setDotGalaxyState(m.dotIndex, { opacityOverride: 0.06 + t * 0.08 });
        }
        grid.wakeAnimation();
        if (fadeStep >= fadeSteps) {
          clearInterval(fadeInterval);
          // Clear override so dots return to normal rendering
          for (const m of newMappings) {
            grid.setDotGalaxyState(m.dotIndex, { opacityOverride: null });
          }
          grid.wakeAnimation();
        }
      }, 50);
    } else {
      grid.wakeAnimation();
    }
  }, [clusters, gridRef, prefersReducedMotion]);

  // Answer construction: phased animation driven by AskState
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const prev = prevStateRef.current;
    prevStateRef.current = state;

    // Reset on return to idle
    if (state === 'IDLE' && prev !== 'IDLE') {
      phaseRef.current = 'idle';
      window.clearTimeout(phaseTimerRef.current);
      for (const id of visionTimerIdsRef.current) window.clearTimeout(id);
      visionTimerIdsRef.current = [];
      edgeProgressRef.current = 0;
      labelAlphaRef.current = 0;
      objectDotMapRef.current.clear();
      stippleCleanupRef.current?.();
      stippleCleanupRef.current = null;
      stippleResultRef.current = null;

      // Reset previously recruited neighborhood dots
      // (grid.resetAll below handles position and state; clear the tracking ref)
      recruitedDotsRef.current.clear();

      // Reset all dots to grid positions
      grid.resetAll();
      for (const m of mappingsRef.current) {
        grid.resetDotTarget(m.dotIndex);
        grid.setDotGalaxyState(m.dotIndex, {
          clusterId: m.clusterId,
          objectType: m.objectType,
          isRelevant: false,
          opacityOverride: null,
          colorOverride: null,
        });
      }
      grid.setEdges([]);
      grid.setLabels([]);
      clearLabelCache();
      grid.wakeAnimation();
      return;
    }

    // Phase 1: Searching (THINKING state) with radial pulse wave
    if (state === 'THINKING') {
      phaseRef.current = 'searching';

      // Smooth face dissolve: if the face was showing, gradually release
      // face dots back to their grid positions over 800ms instead of snapping.
      const hadFace = faceWasActiveRef.current;
      const faceDots = faceDotCountRef.current;
      let dissolveFrameId = 0;

      if (hadFace && faceDots > 0 && !prefersReducedMotion) {
        const DISSOLVE_MS = 800;
        const dissolveStart = performance.now();
        const dotCount = grid.getDotCount();
        const count = Math.min(faceDots, dotCount);

        // Capture current face positions before releasing targets
        const startX = new Float32Array(count);
        const startY = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const p = grid.getDotPosition(i);
          if (p) { startX[i] = p.x; startY[i] = p.y; }
        }

        // Get the original grid rest positions (before any target drift)
        const gridX = new Float32Array(count);
        const gridY = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const p = grid.getOriginalGridPosition(i);
          if (p) { gridX[i] = p.x; gridY[i] = p.y; }
        }

        const dissolveTick = () => {
          const elapsed = performance.now() - dissolveStart;
          const rawT = Math.min(elapsed / DISSOLVE_MS, 1);
          // Ease out quadratic for a gentle deceleration
          const t = 1 - (1 - rawT) * (1 - rawT);

          for (let i = 0; i < count; i++) {
            const x = startX[i] + (gridX[i] - startX[i]) * t;
            const y = startY[i] + (gridY[i] - startY[i]) * t;
            grid.setDotTarget(i, x, y);
          }
          grid.wakeAnimation();

          if (rawT < 1) {
            dissolveFrameId = requestAnimationFrame(dissolveTick);
          } else {
            // Fully dissolved: release targets so dots rest at grid positions
            for (let i = 0; i < count; i++) {
              grid.resetDotTarget(i);
            }
            grid.wakeAnimation();
          }
        };

        dissolveFrameId = requestAnimationFrame(dissolveTick);
      } else if (hadFace && faceDots > 0) {
        // Reduced motion: reset face dots immediately
        const dotCount = grid.getDotCount();
        for (let i = 0; i < Math.min(faceDots, dotCount); i++) {
          grid.resetDotTarget(i);
        }
        grid.wakeAnimation();
      }
      faceWasActiveRef.current = false;

      if (prefersReducedMotion) {
        // Static elevated opacity: no wave, just a subtle brightness bump
        for (const m of mappingsRef.current) {
          grid.setDotGalaxyState(m.dotIndex, { opacityOverride: 0.12 });
        }
        grid.wakeAnimation();
        return;
      }

      const { width, height } = grid.getSize();
      let pulsePhase = 0;

      const pulseInterval = window.setInterval(() => {
        pulsePhase += 0.04;

        // Read predTypeRef each tick so animation updates when prediction arrives
        const predType = predTypeRef.current;

        for (const m of mappingsRef.current) {
          const pos = grid.getDotPosition(m.dotIndex);
          if (!pos) continue;

          let wave = 0;

          if (predType === 'timeline') {
            // Left-to-right flow: wave travels horizontally
            const normX = pos.x / Math.max(1, width);
            wave = Math.sin((normX * 8) - pulsePhase * 3);
          } else if (predType === 'bar-chart' || predType === 'line-chart' || predType === 'comparison') {
            // Grid-like: horizontal bands
            const normY = pos.y / Math.max(1, height);
            wave = Math.sin((normY * 6) - pulsePhase * 2);
          } else if (predType === 'portrait') {
            // Concentrate toward center: tighter radial pulse
            const cx = width / 2;
            const cy = height / 2;
            const dx = pos.x - cx;
            const dy = pos.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = Math.sqrt(cx * cx + cy * cy) * 0.6;
            const norm = Math.min(dist / maxDist, 1);
            wave = Math.sin((norm * 8) - pulsePhase * 4) * (1 - norm * 0.5);
          } else {
            // Default: radial outward from upper-center (graph-native, truth-map, heatmap, unknown)
            const cx = width / 2;
            const cy = height * 0.4;
            const dx = pos.x - cx;
            const dy = pos.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = Math.sqrt(cx * cx + cy * cy);
            const norm = dist / maxDist;
            wave = Math.sin((norm * 6) - pulsePhase * 3);
          }

          const pulse = Math.max(0, wave) * 0.18;
          grid.setDotGalaxyState(m.dotIndex, {
            opacityOverride: 0.06 + pulse,
            colorOverride: pulse > 0.05 ? [74, 138, 150] : null,
          });
        }

        grid.wakeAnimation();
      }, 50);

      window.clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = pulseInterval;
      return () => {
        window.clearInterval(pulseInterval);
        cancelAnimationFrame(dissolveFrameId);
      };
    }

    // Phase 2 + 3 + 4: Filtering, Construction, Crystallize
    if ((state === 'CONSTRUCTING' || state === 'MODEL') && response) {
      // Clear search pulse if still running
      window.clearInterval(pulseIntervalRef.current);
      runAnswerConstruction(grid, response);
      return;
    }

    // Phase 5: Explore (EXPLORING state, answer already constructed)
    if (state === 'EXPLORING' && prev === 'CONSTRUCTING') {
      phaseRef.current = 'explore';
      // Labels fully visible
      const labels = grid.getSize();
      if (labels) {
        labelAlphaRef.current = 1;
      }
      grid.wakeAnimation();
    }
  }, [state, response, gridRef]);

  // Face idle state: stipple the face and run breathing/blink animation loop
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || state !== 'IDLE') {
      // Clean up face animation when leaving idle
      if (faceActiveRef.current) {
        cancelAnimationFrame(faceAnimFrameRef.current);
        faceActiveRef.current = false;
        faceTaggedRef.current = [];
      }
      return;
    }

    const { width, height } = grid.getSize();
    if (width < 1 || height < 1) return;

    // Run the stipple engine to get face dot positions
    const result = stippleFace({ viewportWidth: width, viewportHeight: height });
    const targets = result.targets;
    const snapshots = result.snapshots;
    const dotCount = grid.getDotCount();

    // Set opacity and color for all face dots upfront
    for (let i = 0; i < targets.length && i < dotCount; i++) {
      // weight is 0 in dark regions (face features), 1 in bright regions (background)
      // Invert: dark regions (eyes, mouth) get high opacity, light regions get low
      const featureOpacity = targets[i].weight < 0.5
        ? 0.35 + (1 - targets[i].weight) * 0.45  // face features: 0.35 to 0.80
        : 0.04 + targets[i].weight * 0.04;         // filler dots: very dim
      grid.setDotGalaxyState(i, {
        opacityOverride: featureOpacity,
        colorOverride: targets[i].weight < 0.5 ? [74, 138, 150] : null,
      });
    }

    // Dim non-face dots
    for (let i = targets.length; i < dotCount; i++) {
      grid.setDotGalaxyState(i, { opacityOverride: 0.015 });
    }

    // Construction animation: interpolate through stipple snapshots over 2000ms
    // If snapshots exist and motion is not reduced, run the construction phase
    // before handing off to the breathing/blink loop.
    const CONSTRUCTION_DURATION = 2000;
    const hasConstruction = snapshots.length >= 2 && !prefersReducedMotion;
    let constructionFrameId = 0;

    if (hasConstruction) {
      // Dots start at snapshot[0] (early scattered positions)
      const first = snapshots[0];
      const limit = Math.min(targets.length, dotCount, first.length / 2);
      for (let i = 0; i < limit; i++) {
        grid.setDotTarget(i, first[i * 2], first[i * 2 + 1]);
      }
      grid.wakeAnimation();

      const constructionStart = performance.now();
      const totalSnapshots = snapshots.length;

      const constructionTick = () => {
        const elapsed = performance.now() - constructionStart;
        const rawT = Math.min(elapsed / CONSTRUCTION_DURATION, 1);
        // Ease out cubic: 1 - (1 - t)^3
        const t = 1 - Math.pow(1 - rawT, 3);

        // Map t to a position in the snapshot array
        const snapshotPos = t * (totalSnapshots - 1);
        const snapA = Math.floor(snapshotPos);
        const snapB = Math.min(snapA + 1, totalSnapshots - 1);
        const frac = snapshotPos - snapA;

        const arrA = snapshots[snapA];
        const arrB = snapshots[snapB];
        const count = Math.min(targets.length, dotCount, arrA.length / 2, arrB.length / 2);

        for (let i = 0; i < count; i++) {
          const ix = i * 2;
          const iy = ix + 1;
          const x = arrA[ix] + (arrB[ix] - arrA[ix]) * frac;
          const y = arrA[iy] + (arrB[iy] - arrA[iy]) * frac;
          grid.setDotTarget(i, x, y);
        }
        grid.wakeAnimation();

        if (rawT < 1) {
          constructionFrameId = requestAnimationFrame(constructionTick);
        } else {
          // Construction complete: set final target positions from result
          for (let i = 0; i < targets.length && i < dotCount; i++) {
            grid.setDotTarget(i, targets[i].x, targets[i].y);
          }
          grid.wakeAnimation();
          // Hand off to the breathing/blink loop
          startBreathingLoop();
        }
      };

      constructionFrameId = requestAnimationFrame(constructionTick);
    } else {
      // No construction phase: jump directly to final positions
      for (let i = 0; i < targets.length && i < dotCount; i++) {
        grid.setDotTarget(i, targets[i].x, targets[i].y);
      }
      grid.wakeAnimation();
    }

    // Tag face dots for animation (needs canvas-space targets)
    // Build a StippleTarget-like array from the stipple result for tagging
    faceTaggedRef.current = tagFaceDots(targets, width, height);
    faceAnimStateRef.current = { mouthOpen: 0, blinkAmount: 0, breathPhase: 0 };
    faceBlinkTimerRef.current = { nextBlink: performance.now() + 3000 + Math.random() * 2000, blinking: false, blinkStart: 0 };
    faceLastTickRef.current = performance.now();
    faceActiveRef.current = true;
    faceWasActiveRef.current = true;
    faceDotCountRef.current = targets.length;

    // Animation loop for breathing and blinking
    const tick = () => {
      if (!faceActiveRef.current) return;

      const now = performance.now();
      const delta = Math.min(now - faceLastTickRef.current, 100); // cap to avoid jumps
      faceLastTickRef.current = now;

      // Advance idle animation state, incorporating voice amplitude for mouth
      if (mouthOpenRef) faceAnimStateRef.current.mouthOpen = mouthOpenRef.current;
      faceAnimStateRef.current = tickIdleAnimation(
        faceAnimStateRef.current,
        delta,
        faceBlinkTimerRef.current,
      );

      // Apply displacement to stipple targets (mutates targets in place)
      animateFaceDots(targets, faceTaggedRef.current, faceAnimStateRef.current);

      // Only push positions for dots that were actually displaced (tagged face dots)
      for (const dot of faceTaggedRef.current) {
        const t = targets[dot.index];
        if (t && dot.index < dotCount) {
          grid.setDotTarget(dot.index, t.x, t.y);
        }
      }
      grid.wakeAnimation();

      faceAnimFrameRef.current = requestAnimationFrame(tick);
    };

    // Start the breathing/blink loop (called after construction finishes, or immediately)
    let breathDelayId = 0;
    function startBreathingLoop() {
      faceLastTickRef.current = performance.now();
      breathDelayId = window.setTimeout(() => {
        faceAnimFrameRef.current = requestAnimationFrame(tick);
      }, prefersReducedMotion ? 0 : 200);
    }

    if (!hasConstruction) {
      // No construction phase: start breathing after a short settle delay
      breathDelayId = window.setTimeout(() => {
        faceAnimFrameRef.current = requestAnimationFrame(tick);
      }, prefersReducedMotion ? 0 : 800);
    }

    return () => {
      cancelAnimationFrame(constructionFrameId);
      window.clearTimeout(breathDelayId);
      cancelAnimationFrame(faceAnimFrameRef.current);
      faceActiveRef.current = false;
      faceTaggedRef.current = [];
    };
  }, [state, gridRef, prefersReducedMotion]);

  // Track all map construction timers for cleanup
  const mapTimersRef = useRef<number[]>([]);

  function clearMapTimers() {
    for (const id of mapTimersRef.current) window.clearTimeout(id);
    mapTimersRef.current = [];
  }

  function scheduleMapTimer(fn: () => void, delayMs: number) {
    const id = window.setTimeout(fn, delayMs);
    mapTimersRef.current.push(id);
    return id;
  }

  function runTruthMapConstruction(
    grid: DotGridHandle,
    _mapSection: MapSection,
    topology: TruthMapTopologyDirective,
  ) {
    clearMapTimers();
    phaseRef.current = 'filtering';

    const dotCount = grid.getDotCount();
    const { width, height } = grid.getSize();
    if (width === 0 || height === 0) return;

    // Dim all dots
    for (let i = 0; i < dotCount; i++) {
      grid.setDotGalaxyState(i, { opacityOverride: 0.003 });
    }
    grid.wakeAnimation();

    // Generate and pre-bucket targets by region type
    const result = generateTruthMapTargets(topology, width, height, dotCount);
    const targets = result.targets;
    const regionTypes = result.regionType ?? [];

    const agreementDots: Array<{ idx: number; t: typeof targets[0] }> = [];
    const tensionDots: Array<{ idx: number; t: typeof targets[0] }> = [];
    const blindSpotDots: Array<{ idx: number; t: typeof targets[0] }> = [];

    for (let i = 0; i < targets.length && i < dotCount; i++) {
      const bucket = { idx: i, t: targets[i] };
      switch (regionTypes[i]) {
        case 'agreement': agreementDots.push(bucket); break;
        case 'tension': tensionDots.push(bucket); break;
        case 'blind_spot': blindSpotDots.push(bucket); break;
      }
    }

    // Pre-compute labels once
    const labelData: Array<{ x: number; y: number; text: string; alpha: number }> = [];
    for (const region of topology.agreement_regions) {
      const regionX = (region.center_hint[0] || 0) * width * 0.3 + width / 2;
      const regionY = (region.center_hint[1] || 0) * height * 0.3 + height / 2;
      const label = region.label.length > 25 ? region.label.slice(0, 25) + '\u2026' : region.label;
      labelData.push({ x: regionX, y: regionY, text: label, alpha: 0.7 });
    }
    for (const bsVoid of topology.blind_spot_voids) {
      const vx = width / 2 + (bsVoid.position_hint[0] || 0) * width * 0.1;
      const vy = height / 2 + (bsVoid.position_hint[1] || 0) * height * 0.1;
      const desc = bsVoid.description.length > 20 ? bsVoid.description.slice(0, 20) + '\u2026' : bsVoid.description;
      labelData.push({ x: vx, y: vy, text: `? ${desc}`, alpha: 0.35 });
    }

    const rng = mulberry32(55);

    // Phase 1: Agreement clusters (after 800ms)
    scheduleMapTimer(() => {
      phaseRef.current = 'construction';
      for (const { idx, t } of agreementDots) {
        if (!prefersReducedMotion) {
          grid.setDotTarget(idx, t.x + (rng() - 0.5) * 3, t.y + (rng() - 0.5) * 3);
        }
        grid.setDotGalaxyState(idx, {
          opacityOverride: 0.15 + t.weight * 0.25,
          colorOverride: [45, 95, 107],
        });
      }
      grid.wakeAnimation();
    }, 800);

    // Phase 2: Tension bridges (after 1.6s)
    scheduleMapTimer(() => {
      for (const { idx, t } of tensionDots) {
        if (!prefersReducedMotion) grid.setDotTarget(idx, t.x, t.y);
        grid.setDotGalaxyState(idx, {
          opacityOverride: 0.12,
          colorOverride: [196, 80, 60],
        });
      }
      grid.wakeAnimation();
    }, 1600);

    // Phase 3: Blind spots (after 2.2s)
    scheduleMapTimer(() => {
      for (const { idx, t } of blindSpotDots) {
        if (!prefersReducedMotion) grid.setDotTarget(idx, t.x, t.y);
        grid.setDotGalaxyState(idx, {
          opacityOverride: 0.03,
          colorOverride: [100, 95, 90],
        });
      }
      grid.wakeAnimation();
    }, 2200);

    // Phase 4: Crystallize with labels (after 3s)
    scheduleMapTimer(() => {
      phaseRef.current = 'crystallize';

      if (prefersReducedMotion) {
        grid.setLabels(labelData);
      } else {
        let step = 0;
        const steps = 6;
        const interval = window.setInterval(() => {
          step++;
          const t = step / steps;
          grid.setLabels(labelData.map((l) => ({ ...l, alpha: l.alpha * t })));
          grid.wakeAnimation();
          if (step >= steps) clearInterval(interval);
        }, 50);
        mapTimersRef.current.push(interval);
      }

      grid.wakeAnimation();
      labelAlphaRef.current = 1;
    }, 3000);
  }

  function runAnswerConstruction(grid: DotGridHandle, resp: TheseusResponse) {
    // Check for truth map section: if present and directive has topology, use truth map path
    const mapSection = resp.sections.find(
      (s): s is MapSection => s.type === 'truth_map',
    );
    if (mapSection && directive?.truth_map_topology) {
      runTruthMapConstruction(grid, mapSection, directive.truth_map_topology);
      return;
    }

    // Clear any previously recruited dots from a prior query (follow-ups skip IDLE)
    for (const idx of recruitedDotsRef.current) {
      grid.resetDotTarget(idx);
      grid.setDotGalaxyState(idx, {
        opacityOverride: null,
        colorOverride: null,
        isRelevant: false,
      });
    }
    recruitedDotsRef.current.clear();

    const evidencePath = resp.sections.find((s) => s.type === 'evidence_path');
    const nodes: EvidenceNode[] = evidencePath && 'nodes' in evidencePath ? evidencePath.nodes : [];
    const edges: EvidenceEdge[] = evidencePath && 'edges' in evidencePath ? evidencePath.edges : [];

    const objectSection = resp.sections.find((s) => s.type === 'objects');
    const objects = objectSection && 'objects' in objectSection ? objectSection.objects : [];

    responseObjectsRef.current = objects.map((o) => ({
      id: o.id,
      title: o.title,
      snippet: o.summary ?? '',
      object_type: o.object_type,
      score: o.score ?? 0,
    }));

    // Build set of relevant object IDs
    const relevantIds = new Set([
      ...nodes.map((n) => n.object_id),
      ...objects.map((o) => o.id),
    ]);

    // Map relevant objects to nearest cluster dots or use cluster dots directly
    const clusterSection = resp.sections.filter((s) => s.type === 'cluster_context');
    const relevantClusterIds = new Set<number>();
    for (const section of clusterSection) {
      if ('cluster_id' in section) {
        relevantClusterIds.add(section.cluster_id as number);
      }
    }

    // Find dots for each relevant object
    const objDotMap = new Map<string, number>();
    const usedDots = new Set<number>();

    // First pass: assign objects to their cluster's dot
    for (const obj of objects) {
      for (const m of mappingsRef.current) {
        if (relevantClusterIds.has(m.clusterId) && !usedDots.has(m.dotIndex)) {
          objDotMap.set(obj.id, m.dotIndex);
          usedDots.add(m.dotIndex);
          break;
        }
      }
    }

    // Second pass: assign remaining objects to available cluster dots by type match
    for (const node of nodes) {
      if (objDotMap.has(node.object_id)) continue;
      for (const m of mappingsRef.current) {
        if (!usedDots.has(m.dotIndex) && m.objectType === node.object_type) {
          objDotMap.set(node.object_id, m.dotIndex);
          usedDots.add(m.dotIndex);
          break;
        }
      }
    }

    // Third pass: assign any remaining to any available cluster dot
    for (const node of nodes) {
      if (objDotMap.has(node.object_id)) continue;
      for (const m of mappingsRef.current) {
        if (!usedDots.has(m.dotIndex)) {
          objDotMap.set(node.object_id, m.dotIndex);
          usedDots.add(m.dotIndex);
          break;
        }
      }
    }

    objectDotMapRef.current = objDotMap;

    // Recruit neighborhood dots to form visible constellations per evidence node
    const NEIGHBORS_PER_NODE = 50;
    const recruitedDots = new Set<number>();
    for (const [objectId, dotIndex] of objDotMap) {
      const neighbors = grid.findNearestDots(dotIndex, NEIGHBORS_PER_NODE);
      const node = nodes.find((n) => n.object_id === objectId);
      const objectType = node?.object_type ?? 'note';
      const typeColor = TYPE_COLORS[objectType];
      const rgb = typeColor ? hexToRgb(typeColor) : null;
      const pos = grid.getDotPosition(dotIndex);
      if (!pos) continue;

      for (const neighborIdx of neighbors) {
        if (usedDots.has(neighborIdx) || recruitedDots.has(neighborIdx)) continue;
        recruitedDots.add(neighborIdx);

        // Move neighbor toward the evidence dot with jitter
        const jitter = 15;
        const rng = mulberry32(neighborIdx + dotIndex);
        grid.setDotTarget(neighborIdx,
          pos.x + (rng() - 0.5) * jitter,
          pos.y + (rng() - 0.5) * jitter,
        );
        grid.setDotGalaxyState(neighborIdx, {
          opacityOverride: 0.08 + rng() * 0.12,
          colorOverride: rgb,
          isRelevant: true,
        });
      }
    }
    recruitedDotsRef.current = recruitedDots;

    const relevantDotIndices = new Set([...objDotMap.values(), ...recruitedDots]);

    // === PHASE 2: FILTERING (500ms opacity ramp) ===
    phaseRef.current = 'filtering';

    // Target opacities for the ramp
    const filterTargets = new Map<number, { opacity: number; color: [number, number, number] | null }>();
    for (const m of mappingsRef.current) {
      const isRelevant = relevantDotIndices.has(m.dotIndex);
      const typeColor = TYPE_COLORS[m.objectType];
      const rgb = typeColor ? hexToRgb(typeColor) : null;
      filterTargets.set(m.dotIndex, {
        opacity: isRelevant ? 0.25 : 0.06,
        color: isRelevant && rgb ? rgb : null,
      });
      grid.setDotGalaxyState(m.dotIndex, { isRelevant });
    }

    if (prefersReducedMotion) {
      // Instant cut for reduced motion
      for (const [dotIndex, target] of filterTargets) {
        grid.setDotGalaxyState(dotIndex, {
          opacityOverride: target.opacity,
          colorOverride: target.color,
        });
      }
      grid.wakeAnimation();
    } else {
      // 500ms animated ramp (10 steps at 50ms)
      let filterStep = 0;
      const filterSteps = 10;
      const filterInterval = window.setInterval(() => {
        filterStep++;
        const t = filterStep / filterSteps;
        for (const [dotIndex, target] of filterTargets) {
          const currentOpa = 0.06 + (target.opacity - 0.06) * t;
          grid.setDotGalaxyState(dotIndex, {
            opacityOverride: currentOpa,
            colorOverride: t > 0.3 ? target.color : null,
          });
        }
        grid.wakeAnimation();
        if (filterStep >= filterSteps) clearInterval(filterInterval);
      }, 50);
    }

    // === PHASE 3: CONSTRUCTION (after 1s delay) ===
    phaseTimerRef.current = window.setTimeout(() => {
      phaseRef.current = 'construction';

      const { width, height } = grid.getSize();
      if (width === 0 || height === 0) return;

      // Try stippling pipeline for non-image answers
      const imageUrl = resp.reference_image_url;
      const dotCount = grid.getDotCount();
      const vizType = predTypeRef.current;
      const geoSection = resp.geographic_regions;
      const answerType = resp.answer_type;
      geoSectionRef.current = geoSection ?? null;
      setShowGeoLegend(false);

      // Geographic answers with regions: route through stipple + GeographicRenderer
      const isGeographicStipple = answerType === 'geographic' && geoSection;
      const shouldStipple = isGeographicStipple || (!imageUrl && vizType !== 'portrait' && vizType !== 'object-scene');

      // Debug: trace answer flow
      if (imageUrl || geoSection || answerType) {
        console.log('[Galaxy] Answer construction:', {
          imageUrl,
          hasGeoSection: !!geoSection,
          answerType,
          vizType,
          shouldStipple,
          isGeographicStipple,
        });
      }

      if (shouldStipple) {
        // Clean up previous stipple if any (follow-up queries)
        stippleCleanupRef.current?.();

        runStippleConstruction(vizType, nodes, edges, directive, grid, {
          instant: prefersReducedMotion,
          answerType: answerType as AnswerType | undefined,
          referenceImageUrl: isGeographicStipple ? imageUrl : undefined,
          geoSection: isGeographicStipple ? geoSection : undefined,
        }).then((stippleResult) => {
          if (!stippleResult) {
            legacyConstruction(grid, nodes, edges, objDotMap, relevantDotIndices, imageUrl, dotCount, geoSection);
            return;
          }

          stippleResultRef.current = stippleResult;

          // Track recruited dots for cleanup on next query
          for (const idx of stippleResult.recruitedDotIndices) {
            recruitedDotsRef.current.add(idx);
          }

          // Animate the stippled construction with per-type coloring
          const cleanup = animateStippleConstruction(
            grid,
            stippleResult,
            stippleResult.stippleResult.targets,
            nodes,
            prefersReducedMotion,
            answerType as AnswerType | undefined,
          );
          stippleCleanupRef.current = cleanup;
        }).catch((err: unknown) => {
          console.warn('[Galaxy] Stipple construction failed, using legacy path:', err);
          legacyConstruction(grid, nodes, edges, objDotMap, relevantDotIndices, imageUrl, dotCount, geoSection);
        });
        return;
      }

      legacyConstruction(grid, nodes, edges, objDotMap, relevantDotIndices, imageUrl, dotCount, geoSection);
    }, 1000);
  }

  function runCrystallizePhase(
    grid: DotGridHandle,
    objDotMap: Map<string, number>,
    nodes: EvidenceNode[],
    relevantDotIndices: Set<number>,
  ) {
    // === PHASE 4: CRYSTALLIZE (after 2s, with 300ms label fade) ===
    window.setTimeout(() => {
      phaseRef.current = 'crystallize';

      const rawLabels: Array<{ x: number; y: number; text: string; alpha: number }> = [];
      for (const [objectId, dotIndex] of objDotMap) {
        const node = nodes.find((n) => n.object_id === objectId);
        if (!node) continue;
        const pos = grid.getDotPosition(dotIndex);
        if (!pos) continue;
        rawLabels.push({
          x: pos.x, y: pos.y, alpha: 0.7,
          text: node.title.length > 20 ? node.title.slice(0, 20) + '...' : node.title,
        });
      }

      // Resolve overlapping labels before rendering
      const labelData = resolveCollisions(rawLabels);

      if (prefersReducedMotion) {
        grid.setLabels(labelData);
        for (const dotIndex of relevantDotIndices) {
          grid.setDotGalaxyState(dotIndex, { opacityOverride: 0.45 });
        }
        grid.wakeAnimation();
      } else {
        let labelStep = 0;
        const labelSteps = 6;
        const labelInterval = window.setInterval(() => {
          labelStep++;
          const t = labelStep / labelSteps;
          grid.setLabels(labelData.map((l) => ({ ...l, alpha: l.alpha * t })));
          grid.wakeAnimation();
          if (labelStep >= labelSteps) clearInterval(labelInterval);
        }, 50);
      }

      for (const dotIndex of relevantDotIndices) {
        grid.setDotGalaxyState(dotIndex, { opacityOverride: 0.45 });
      }

      grid.wakeAnimation();
      labelAlphaRef.current = 1;
    }, 2000);
  }

  /**
   * Legacy construction path: image tracing / graph layout / cluster layout.
   * Called when stippling is not applicable (portrait queries) or as fallback.
   */
  function legacyConstruction(
    grid: DotGridHandle,
    nodes: EvidenceNode[],
    edges: EvidenceEdge[],
    objDotMap: Map<string, number>,
    relevantDotIndices: Set<number>,
    imageUrl: string | null | undefined,
    dotCount: number,
    geoSection?: GeographicRegionsSection,
  ) {
    const { width, height } = grid.getSize();
    const imageOptions = geoSection ? { contrastBoost: 'map' as const } : {};
    console.log('[Galaxy] legacyConstruction called:', { imageUrl, hasGeoSection: !!geoSection, contrastBoost: imageOptions.contrastBoost });
    generateTargets(imageUrl, nodes, edges, width, height, dotCount, imageOptions).then((result) => {
      console.log('[Galaxy] generateTargets result:', { method: result.method, targetCount: result.targets.length, visionMode: result.visionMode });
      if (result.method === 'image-trace') {
        const targets = result.targets;
        const isVisionPerson = result.visionMode === 'person';
        const visionTimerIds: number[] = [];

        if (prefersReducedMotion || !isVisionPerson) {
          const instantRng = mulberry32(targets.length * 6173);
          for (let i = 0; i < dotCount && i < targets.length; i++) {
            const target = targets[i];
            const jitterX = (instantRng() - 0.5) * 4;
            const jitterY = (instantRng() - 0.5) * 4;

            if (prefersReducedMotion) {
              grid.setDotGalaxyState(i, { opacityOverride: 0.25 + target.weight * 0.25 });
            } else {
              grid.setDotTarget(i, target.x + jitterX, target.y + jitterY);
              grid.setDotGalaxyState(i, { opacityOverride: 0.25 + target.weight * 0.25 });
            }
          }

          for (let i = targets.length; i < dotCount; i++) {
            grid.setDotGalaxyState(i, { opacityOverride: 0.01 });
          }
          grid.wakeAnimation();
        } else {
          const phases = [
            { min: 0.00, max: 0.25, delay: 0,    label: 'silhouette' },
            { min: 0.25, max: 0.50, delay: 2000, label: 'structure' },
            { min: 0.50, max: 0.75, delay: 4000, label: 'fill' },
            { min: 0.75, max: 1.01, delay: 6000, label: 'detail' },
          ];

          for (let i = 0; i < dotCount; i++) {
            grid.setDotGalaxyState(i, { opacityOverride: 0.01 });
          }
          grid.wakeAnimation();

          const phaseBuckets = phases.map((phase) => {
            const bucket: Array<{ target: typeof targets[0]; index: number }> = [];
            for (let i = 0; i < targets.length; i++) {
              const w = targets[i].weight;
              if (w >= phase.min && w < phase.max) {
                bucket.push({ target: targets[i], index: i });
              }
            }
            return bucket;
          });

          const phaseRng = mulberry32(targets.length * 4219);

          for (let p = 0; p < phases.length; p++) {
            const bucket = phaseBuckets[p];
            const delay = phases[p].delay;

            const timerId = window.setTimeout(() => {
              for (const { target, index } of bucket) {
                if (index >= dotCount) continue;
                const jitterX = (phaseRng() - 0.5) * 3;
                const jitterY = (phaseRng() - 0.5) * 3;
                grid.setDotTarget(index, target.x + jitterX, target.y + jitterY);
                grid.setDotGalaxyState(index, {
                  opacityOverride: 0.15 + target.weight * 0.35,
                });
              }
              grid.wakeAnimation();
            }, delay);
            visionTimerIds.push(timerId);
          }
        }

        // Geographic region coloring: color dots by nearest region
        if (geoSection && result.method === 'image-trace') {
          const { width: cw, height: ch } = grid.getSize();
          const { padX: gPadX, padY: gPadY, usableW: gUsableW, usableH: gUsableH } = geoMapLayout(cw, ch);

          const regionDelay = isVisionPerson && !prefersReducedMotion ? 7000 : 1000;
          const regionTimer = window.setTimeout(() => {
            for (let i = 0; i < targets.length && i < dotCount; i++) {
              const pos = grid.getDotPosition(i);
              if (!pos) continue;

              let bestRegion: typeof geoSection.regions[0] | null = null;
              let bestDist = Infinity;

              for (const region of geoSection.regions) {
                const rx = gPadX + region.center_x * gUsableW;
                const ry = gPadY + region.center_y * gUsableH;
                const regionR = region.radius * gUsableW;
                const dist = Math.sqrt((pos.x - rx) ** 2 + (pos.y - ry) ** 2);

                if (dist < regionR && dist < bestDist) {
                  bestDist = dist;
                  bestRegion = region;
                }
              }

              if (bestRegion) {
                const rgb = geoScoreToRgb(bestRegion.score);
                grid.setDotGalaxyState(i, {
                  colorOverride: rgb,
                  opacityOverride: 0.4 + bestRegion.score * 0.4,
                  scaleOverride: 1.8 + bestRegion.score * 0.6,
                });
              }
            }
            grid.wakeAnimation();

            // Region labels with score percentages
            const regionLabels: Array<{ x: number; y: number; text: string; alpha: number }> = [];
            for (const region of geoSection.regions) {
              const rx = gPadX + region.center_x * gUsableW;
              const ry = gPadY + region.center_y * gUsableH;
              const scorePct = Math.round(region.score * 100);
              regionLabels.push({
                x: rx,
                y: ry,
                text: `${region.name}  ${scorePct}%`,
                alpha: 0.85,
              });
            }

            const resolvedLabels = resolveCollisions(regionLabels);
            let labelStep = 0;
            const labelSteps = 10;
            const labelFadeInterval = window.setInterval(() => {
              labelStep++;
              const t = labelStep / labelSteps;
              grid.setLabels(resolvedLabels.map((l) => ({ ...l, alpha: l.alpha * t })));
              grid.wakeAnimation();
              if (labelStep >= labelSteps) clearInterval(labelFadeInterval);
            }, 60);
            // Push to ref directly so cleanup catches it even if this
            // callback fires after the outer visionTimerIds assignment
            visionTimerIdsRef.current.push(labelFadeInterval);

            // Show legend after labels appear
            setShowGeoLegend(true);
          }, regionDelay);
          visionTimerIds.push(regionTimer);
        }

        const crystallizeDelay = isVisionPerson && !prefersReducedMotion ? 7000 : 0;
        const crystallizeTimerId = window.setTimeout(() => {
          runCrystallizePhase(grid, objDotMap, nodes, relevantDotIndices);
        }, crystallizeDelay);
        visionTimerIds.push(crystallizeTimerId);
        visionTimerIdsRef.current = visionTimerIds;

      } else {
        const layout = result.layout ?? { positions: new Map(), edges: [] };

        for (const [objectId, dotIndex] of objDotMap) {
          const pos = layout.positions.get(objectId);
          if (pos) {
            if (prefersReducedMotion) {
              grid.setDotGalaxyState(dotIndex, { opacityOverride: 0.35 });
            } else {
              grid.setDotTarget(dotIndex, pos.x, pos.y);
              grid.setDotGalaxyState(dotIndex, { opacityOverride: 0.35 });
            }
          }
        }

        grid.wakeAnimation();

        if (layout.edges.length > 0) {
          const buildEdgeList = (p: number) => layout.edges
            .map((e) => {
              const fromDot = objDotMap.get(e.fromId);
              const toDot = objDotMap.get(e.toId);
              if (fromDot === undefined || toDot === undefined) return null;
              return { fromIndex: fromDot, toIndex: toDot, progress: p, color: `rgba(74,138,150,1)` };
            })
            .filter(Boolean) as Array<{ fromIndex: number; toIndex: number; progress: number; color: string }>;

          if (prefersReducedMotion) {
            grid.setEdges(buildEdgeList(1));
            grid.wakeAnimation();
          } else {
            let progress = 0;
            const edgeInterval = window.setInterval(() => {
              progress += 0.04;
              if (progress > 1) { clearInterval(edgeInterval); progress = 1; }
              edgeProgressRef.current = progress;
              grid.setEdges(buildEdgeList(progress));
              grid.wakeAnimation();
            }, 50);

            const cleanupTimer = window.setTimeout(() => clearInterval(edgeInterval), 2000);
            phaseTimerRef.current = cleanupTimer;
          }
        }

        runCrystallizePhase(grid, objDotMap, nodes, relevantDotIndices);
      }
    });
  }

  // Canvas-native zoom: push scale+pan to the dot grid
  const isZoomedRef = useRef(false);

  const applyZoomToGrid = useCallback((scale: number, panX: number, panY: number) => {
    zoomScaleRef.current = scale;
    zoomPanRef.current = { x: panX, y: panY };
    isZoomedRef.current = scale !== 1 || panX !== 0 || panY !== 0;
    gridRef.current?.setZoomTransform(scale, panX, panY);
  }, [gridRef]);

  // Animate zoom smoothly toward a target
  const animateZoom = useCallback((
    targetScale: number, targetPanX: number, targetPanY: number, durationMs: number,
  ) => {
    cancelAnimationFrame(zoomAnimRef.current);
    const startScale = zoomScaleRef.current;
    const startPanX = zoomPanRef.current.x;
    const startPanY = zoomPanRef.current.y;
    const startTime = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - startTime) / durationMs);
      const ease = 1 - (1 - t) * (1 - t); // ease-out quad
      const s = startScale + (targetScale - startScale) * ease;
      const px = startPanX + (targetPanX - startPanX) * ease;
      const py = startPanY + (targetPanY - startPanY) * ease;
      applyZoomToGrid(s, px, py);
      if (t < 1) zoomAnimRef.current = requestAnimationFrame(step);
    }

    if (prefersReducedMotion || durationMs <= 0) {
      applyZoomToGrid(targetScale, targetPanX, targetPanY);
    } else {
      zoomAnimRef.current = requestAnimationFrame(step);
    }
  }, [applyZoomToGrid, prefersReducedMotion]);

  // Scroll wheel zoom: zoom centered on cursor position
  useEffect(() => {
    const el = interactionLayerRef.current;
    if (!el) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const grid = gridRef.current;
      if (!grid) return;

      const rect = el!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const oldScale = zoomScaleRef.current;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldScale + delta));

      // Zoom centered on cursor: adjust pan so cursor position stays fixed
      const ratio = newScale / oldScale;
      const newPanX = cursorX - ratio * (cursorX - zoomPanRef.current.x);
      const newPanY = cursorY - ratio * (cursorY - zoomPanRef.current.y);

      applyZoomToGrid(newScale, newPanX, newPanY);
    }

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [gridRef, applyZoomToGrid]);

  // Double-click handler: toggle 2x zoom centered on click
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    if (!grid) return;

    const currentScale = zoomScaleRef.current;

    if (currentScale >= 2) {
      // Already zoomed: reset to 1x
      animateZoom(1, 0, 0, 300);
      setInfoCard(null);
      grid.setLabels([]);
      for (const m of mappingsRef.current) {
        grid.setDotGalaxyState(m.dotIndex, { opacityOverride: null });
      }
      grid.wakeAnimation();
      return;
    }

    // Zoom to 2x centered on click position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const targetScale = 2;
    const ratio = targetScale / currentScale;
    const newPanX = cursorX - ratio * (cursorX - zoomPanRef.current.x);
    const newPanY = cursorY - ratio * (cursorY - zoomPanRef.current.y);

    animateZoom(targetScale, newPanX, newPanY, 300);

    // Show labels on nearby cluster dots
    const nearest = grid.findNearestClusterDot(e.clientX, e.clientY);
    if (!nearest) return;

    const mapping = mappingsRef.current.find((m) => m.clusterId === nearest.clusterId);
    if (!mapping) return;

    grid.setDotGalaxyState(nearest.index, { opacityOverride: 0.5 });

    const { width, height } = grid.getSize();
    const viewRadius = Math.max(width, height) / 6;
    const neighborLabels: Array<{ x: number; y: number; text: string; alpha: number }> = [];

    for (const m of mappingsRef.current) {
      const pos = grid.getDotPosition(m.dotIndex);
      if (!pos) continue;
      const dx = pos.x - nearest.x;
      const dy = pos.y - nearest.y;
      if (dx * dx + dy * dy < viewRadius * viewRadius) {
        neighborLabels.push({
          x: pos.x,
          y: pos.y,
          text: m.label,
          alpha: m.clusterId === nearest.clusterId ? 0.9 : 0.4,
        });
        if (m.clusterId !== nearest.clusterId) {
          grid.setDotGalaxyState(m.dotIndex, { opacityOverride: 0.2 });
        }
      }
    }

    grid.setLabels(neighborLabels);
    grid.wakeAnimation();

    setInfoCard({
      cluster: mapping,
      screenX: Math.min(e.clientX + 20, window.innerWidth - 280),
      screenY: Math.min(e.clientY - 40, window.innerHeight - 200),
    });
  }, [gridRef, animateZoom]);

  // Show/dismiss click card helper
  const showClickCard = useCallback((
    canvasX: number, canvasY: number, objectId: string,
  ) => {
    const obj = responseObjectsRef.current.find((o) => o.id === objectId);
    if (!obj) return;

    window.clearTimeout(clickCardTimerRef.current);
    gridRef.current?.setClickCard({
      canvasX,
      canvasY,
      title: obj.title,
      snippet: obj.snippet,
      objectType: obj.object_type,
      score: obj.score,
      alpha: 0,
      targetAlpha: 1,
    });
    gridRef.current?.wakeAnimation();

    // Add to source trail
    onSourceExplored?.({
      objectId,
      title: obj.title,
      objectType: obj.object_type,
      score: obj.score,
      snippet: obj.snippet,
    });
  }, [gridRef, onSourceExplored]);

  const dismissClickCard = useCallback(() => {
    // Fade out then remove
    gridRef.current?.setClickCard(null);
    gridRef.current?.wakeAnimation();
  }, [gridRef]);

  // Single click on a dot: show click-card (desktop) or open drawer (mobile)
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return; // Drag, not click
    if (phaseRef.current !== 'explore' && phaseRef.current !== 'crystallize') {
      // Click on empty space dismisses card in any phase
      dismissClickCard();
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;

    // Detect mobile: use drawer for touch devices
    const isMobile = 'ontouchstart' in window && window.innerWidth < 768;

    // Geographic region hit test
    const geoSection = geoSectionRef.current;
    if (geoSection) {
      const { x: clickX, y: clickY } = grid.screenToCanvas(e.clientX, e.clientY);
      const { width, height } = grid.getSize();
      const { padX: gPadX, padY: gPadY, usableW: gUsableW, usableH: gUsableH } = geoMapLayout(width, height);

      for (const region of geoSection.regions) {
        const rx = gPadX + region.center_x * gUsableW;
        const ry = gPadY + region.center_y * gUsableH;
        const regionR = region.radius * gUsableW;
        const dist = Math.sqrt((clickX - rx) ** 2 + (clickY - ry) ** 2);

        if (dist < regionR) {
          setDrawerObjectId(`geo:${region.id}`);
          return;
        }
      }
    }

    const nearest = grid.findNearestClusterDot(e.clientX, e.clientY);
    if (!nearest) {
      // Clicked empty space: dismiss card
      dismissClickCard();
      return;
    }

    // Find the object ID mapped to this dot
    let foundObjectId: string | null = null;
    for (const [objectId, dotIndex] of objectDotMapRef.current) {
      if (dotIndex === nearest.index) {
        foundObjectId = objectId;
        break;
      }
    }

    // Fallback: try the cluster's top objects
    if (!foundObjectId) {
      const mapping = mappingsRef.current.find((m) => m.clusterId === nearest.clusterId);
      if (mapping && mapping.topObjects.length > 0) {
        foundObjectId = mapping.topObjects[0];
      }
    }

    if (!foundObjectId) return;

    if (isMobile) {
      setDrawerObjectId(foundObjectId);
    } else {
      // Desktop: show click-card at the dot position (offset right+up by 16px)
      showClickCard(nearest.x + 16, nearest.y - 16, foundObjectId);
    }
  }, [gridRef, showClickCard, dismissClickCard]);

  // Interaction layer ref and drag state for cursor management
  const interactionLayerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const handlePointerDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    if (interactionLayerRef.current) {
      interactionLayerRef.current.style.cursor = zoomScaleRef.current > 1 ? 'grabbing' : 'default';
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    dragStartRef.current = null;
    isDraggingRef.current = false;
    if (interactionLayerRef.current) {
      interactionLayerRef.current.style.cursor = 'grab';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragStartRef.current = null;
    isDraggingRef.current = false;
  }, []);

  // Touch interaction: distinguish tap from drag with 4px threshold
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
      touchStartRef.current = null; // Cancel tap, this is a drag/pan
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current) return;
    const elapsed = Date.now() - touchStartRef.current.time;
    if (elapsed > 500) { touchStartRef.current = null; return; } // Too slow for tap

    // This was a tap: find nearest cluster dot and open drawer
    const grid = gridRef.current;
    if (!grid || (phaseRef.current !== 'explore' && phaseRef.current !== 'crystallize')) {
      touchStartRef.current = null;
      return;
    }

    const { x, y } = touchStartRef.current;
    touchStartRef.current = null;

    const nearest = grid.findNearestClusterDot(x, y);
    if (!nearest) return;

    for (const [objectId, dotIndex] of objectDotMapRef.current) {
      if (dotIndex === nearest.index) {
        setDrawerObjectId(objectId);
        return;
      }
    }

    const mapping = mappingsRef.current.find((m) => m.clusterId === nearest.clusterId);
    if (mapping && mapping.topObjects.length > 0) {
      setDrawerObjectId(mapping.topObjects[0]);
    }
  }, [gridRef]);

  // Hover feedback: brighten nearest evidence dot within 30px
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Pan when zoomed in and dragging
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        isDraggingRef.current = true;
      }
      if (isDraggingRef.current && zoomScaleRef.current > 1) {
        applyZoomToGrid(
          zoomScaleRef.current,
          zoomPanRef.current.x + e.movementX,
          zoomPanRef.current.y + e.movementY,
        );
        return; // Skip hover logic during pan
      }
    }
    if (phaseRef.current !== 'explore' && phaseRef.current !== 'crystallize') return;
    const grid = gridRef.current;
    if (!grid) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let bestDist = 900; // 30px squared
    let bestDotIndex: number | null = null;

    for (const [, dotIndex] of objectDotMapRef.current) {
      const pos = grid.getDotPosition(dotIndex);
      if (!pos) continue;
      const dx = pos.x - mx;
      const dy = pos.y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestDotIndex = dotIndex;
      }
    }

    const prev = hoveredDotRef.current;
    if (prev === bestDotIndex) return;

    // Restore previous hovered dot
    if (prev !== null) {
      grid.setDotGalaxyState(prev, { opacityOverride: 0.45 });
    }

    // Brighten new hovered dot
    if (bestDotIndex !== null) {
      grid.setDotGalaxyState(bestDotIndex, { opacityOverride: 0.8 });
    }

    hoveredDotRef.current = bestDotIndex;
    if (!isDraggingRef.current) {
      (e.currentTarget as HTMLDivElement).style.cursor = bestDotIndex !== null ? 'pointer' : 'grab';
    }
    grid.wakeAnimation();
  }, [gridRef, applyZoomToGrid]);

  // What-if removal: fade and scatter the removed dot
  const handleWhatIfRemove = useCallback((objectId: string, result: WhatIfResult) => {
    const grid = gridRef.current;
    if (!grid) return;

    const dotIndex = objectDotMapRef.current.get(objectId);
    if (dotIndex === undefined) return;

    // Fade the removed dot (skip red flash for reduced motion)
    grid.setDotGalaxyState(dotIndex, {
      opacityOverride: prefersReducedMotion ? 0.005 : 0.01,
      colorOverride: prefersReducedMotion ? null : [196, 80, 60],
    });

    for (const [otherId, otherIndex] of objectDotMapRef.current) {
      if (otherId === objectId) continue;
      if (result.orphaned_objects.includes(otherId)) {
        grid.setDotGalaxyState(otherIndex, { opacityOverride: 0.03 });
      }
    }

    grid.wakeAnimation();

    if (!prefersReducedMotion) {
      window.setTimeout(() => {
        grid.setDotGalaxyState(dotIndex, {
          opacityOverride: 0.005,
          colorOverride: null,
        });
        grid.wakeAnimation();
      }, 1000);
    }
  }, [gridRef]);

  // Follow-up query transition: detect query change
  useEffect(() => {
    const currentQuery = response?.query ?? null;
    const prevQuery = prevQueryRef.current;
    prevQueryRef.current = currentQuery;

    if (!currentQuery || !prevQuery || currentQuery === prevQuery) return;

    // Check if the new query shares objects with the previous one
    // If the GalaxyController sees a new CONSTRUCTING state, it will
    // automatically re-run the construction animation. The dot targets
    // change via setDotTarget, and spring physics handles the smooth
    // transition from old positions to new positions.
    // No extra code needed: the existing construction flow handles it.
  }, [response]);

  // Escape key to exit zoom
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isZoomedRef.current) {
        animateZoom(1, 0, 0, 300);
        setInfoCard(null);
        const grid = gridRef.current;
        if (grid) {
          grid.setPointerEvents(false);
          grid.setLabels([]);
          for (const m of mappingsRef.current) {
            grid.setDotGalaxyState(m.dotIndex, { opacityOverride: null });
          }
          grid.wakeAnimation();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridRef, animateZoom]);

  // Data acquisition: pulsing edge dots + streaming new dots
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const hasDataAcq = response?.sections.some((s) => s.type === 'data_acquisition');
    const isLoading = dataStatus?.phase === 'loading' || dataStatus?.phase === 'processing';
    const acquiring = !!(hasDataAcq && isLoading);
    setIsAcquiring(acquiring);

    if (!acquiring) {
      window.clearInterval(pulseIntervalRef.current);
      return;
    }

    // Find edge dots (dots with high fade value, i.e. near viewport edges)
    const dotCount = grid.getDotCount();
    const edgeDotIndices: number[] = [];
    const { width, height } = grid.getSize();
    const centerX = width / 2;
    const centerY = height / 2;
    const edgeThreshold = Math.max(width, height) * 0.35;

    for (const m of mappingsRef.current) {
      const pos = grid.getDotPosition(m.dotIndex);
      if (!pos) continue;
      const dx = pos.x - centerX;
      const dy = pos.y - centerY;
      if (Math.sqrt(dx * dx + dy * dy) > edgeThreshold) {
        edgeDotIndices.push(m.dotIndex);
      }
    }

    if (prefersReducedMotion) {
      // Static brightness boost for reduced motion
      for (const dotIndex of edgeDotIndices) {
        grid.setDotGalaxyState(dotIndex, { opacityOverride: 0.10 });
      }
      grid.wakeAnimation();
      return;
    }

    let pulsePhase = 0;
    pulseIntervalRef.current = window.setInterval(() => {
      pulsePhase += 0.05;
      const pulseOpacity = 0.08 + Math.sin(pulsePhase) * 0.035;

      for (const dotIndex of edgeDotIndices) {
        grid.setDotGalaxyState(dotIndex, { opacityOverride: pulseOpacity });
      }

      if (Math.random() < 0.15) {
        const randomEdge = edgeDotIndices[Math.floor(Math.random() * edgeDotIndices.length)];
        if (randomEdge !== undefined) {
          grid.setDotGalaxyState(randomEdge, {
            opacityOverride: 0.3,
            colorOverride: [74, 138, 150],
          });
          window.setTimeout(() => {
            grid.setDotGalaxyState(randomEdge, {
              opacityOverride: pulseOpacity,
              colorOverride: null,
            });
          }, 300);
        }
      }

      grid.wakeAnimation();
    }, 50);

    return () => {
      window.clearInterval(pulseIntervalRef.current);
    };
  }, [response, dataStatus, gridRef]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      window.clearTimeout(phaseTimerRef.current);
      window.clearTimeout(clickCardTimerRef.current);
      for (const id of visionTimerIdsRef.current) window.clearTimeout(id);
      window.clearInterval(pulseIntervalRef.current);
      cancelAnimationFrame(zoomAnimRef.current);
    };
  }, []);

  const typeColor = infoCard ? (TYPE_COLORS[infoCard.cluster.objectType] ?? '#9A958D') : '#9A958D';

  return (
    <>
      {/* Zoom and click interaction layer */}
      <div
        ref={interactionLayerRef}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: isZoomedRef.current ? 2 : (state === 'IDLE' || state === 'EXPLORING') ? 1 : 0,
          pointerEvents: isZoomedRef.current || state === 'IDLE' || state === 'EXPLORING' ? 'auto' : 'none',
          cursor: 'grab',
          touchAction: 'none',
        }}
      />

      {/* Engine heat gradient (Layer 2, intensifies through phases) */}
      {(phaseRef.current === 'searching' || phaseRef.current === 'filtering' || phaseRef.current === 'construction' || phaseRef.current === 'crystallize' || isAcquiring) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5,
            pointerEvents: 'none',
            background: (() => {
              const intensity = phaseRef.current === 'construction' ? 0.14
                : phaseRef.current === 'crystallize' ? 0.10
                : phaseRef.current === 'filtering' ? 0.08
                : 0.05;
              return `linear-gradient(
                to top,
                rgba(196, 80, 60, ${intensity}) 0%,
                rgba(196, 154, 74, ${intensity * 0.5}) 30%,
                transparent 65%
              )`;
            })(),
            transition: prefersReducedMotion ? 'none' : 'background 1.5s ease',
          }}
        />
      )}

      {/* Info card for zoomed cluster */}
      {infoCard && isZoomedRef.current && (
        <div
          style={{
            position: 'fixed',
            left: infoCard.screenX,
            top: infoCard.screenY,
            width: 250,
            padding: '14px 16px',
            borderRadius: 14,
            background: 'rgba(15,16,18,0.76)',
            backdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: `4px solid ${typeColor}`,
            zIndex: 15,
            pointerEvents: 'auto',
          }}
        >
          <h3
            style={{
              margin: '0 0 6px',
              color: 'var(--vie-text)',
              fontFamily: 'var(--vie-font-title)',
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            {infoCard.cluster.label}
          </h3>
          <span
            style={{
              display: 'block',
              marginBottom: 8,
              color: 'var(--vie-text-dim)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {infoCard.cluster.memberCount} objects
          </span>
          {infoCard.cluster.topObjects.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
              {infoCard.cluster.topObjects.slice(0, 3).map((objectId) => (
                <li
                  key={objectId}
                  style={{
                    color: 'var(--vie-text-muted)',
                    fontFamily: 'var(--vie-font-body)',
                    fontSize: 12,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {objectId}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `/theseus/ask?microscope=cluster:${infoCard.cluster.clusterId}`;
            }}
            style={{
              marginTop: 10,
              padding: '5px 10px',
              fontSize: 11,
              fontFamily: 'var(--vie-font-mono)',
              background: 'rgba(45,95,107,0.25)',
              border: '1px solid rgba(45,95,107,0.4)',
              borderRadius: 4,
              color: 'var(--vie-text)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Explore
          </button>
        </div>
      )}

      {/* Detail exploration drawer */}
      {/* Geographic recommendation legend */}
      {showGeoLegend && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: '10px 14px',
            borderRadius: 6,
            background: 'rgba(15, 16, 18, 0.75)',
            backdropFilter: 'blur(8px)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <div style={{ fontFamily: 'var(--vie-font-mono)', fontSize: 10, color: '#9c958d', letterSpacing: '0.08em', marginBottom: 8 }}>
            RECOMMENDATION
          </div>
          {GEO_SCORE_TIERS.map((tier) => (
            <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: tier.hex, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--vie-font-mono)', fontSize: 9, color: '#e8e5e0cc' }}>{tier.label}</span>
            </div>
          ))}
        </div>
      )}

      <GalaxyDrawer
        objectId={drawerObjectId}
        onClose={() => setDrawerObjectId(null)}
        onWhatIfRemove={handleWhatIfRemove}
        geoRegions={geoSectionRef.current?.regions}
      />
    </>
  );
}
