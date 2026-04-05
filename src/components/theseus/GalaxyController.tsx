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
import type { MapSection } from '@/lib/theseus-types';
import type { TruthMapTopologyDirective } from '@/lib/theseus-viz/SceneDirective';
import GalaxyDrawer from './GalaxyDrawer';
import type { AskState } from '@/app/theseus/ask/page';

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
}

export default function GalaxyController({
  gridRef,
  state,
  response,
  directive,
  dataStatus,
  vizPrediction,
}: GalaxyControllerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [zoom, setZoom] = useState<{
    active: boolean;
    scale: number;
    centerX: number;
    centerY: number;
    focusedClusterId: number | null;
  }>({ active: false, scale: 1, centerX: 0, centerY: 0, focusedClusterId: null });
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
  // Track which evidence dot is hovered for visual feedback
  const hoveredDotRef = useRef<number | null>(null);
  // Track previous query for follow-up transitions
  const prevQueryRef = useRef<string | null>(null);
  // Track predicted viz type without triggering effect re-runs
  const predTypeRef = useRef<VizType>('graph-native');

  // Keep predTypeRef current without triggering the main animation effect
  useEffect(() => {
    predTypeRef.current = vizPrediction?.type ?? 'graph-native';
  }, [vizPrediction]);

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

      // Try image tracing first, fall back to graph/cluster layout
      const imageUrl = resp.reference_image_url;
      const dotCount = grid.getDotCount();

      generateTargets(imageUrl, nodes, edges, width, height, dotCount).then((result) => {
        if (result.method === 'image-trace') {
          const targets = result.targets;
          const isVisionPerson = result.visionMode === 'person';
          const visionTimerIds: number[] = [];

          if (prefersReducedMotion || !isVisionPerson) {
            // Instant assignment for reduced motion or non-person (object/Sobel) traces
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
            // Phased construction for person (face mesh) vision targets.
            // Weight encodes phase: 0-0.25 silhouette, 0.25-0.5 structure,
            // 0.5-0.75 interior, 0.75-1.0 detail.
            const phases = [
              { min: 0.00, max: 0.25, delay: 0,    label: 'silhouette' },
              { min: 0.25, max: 0.50, delay: 2000, label: 'structure' },
              { min: 0.50, max: 0.75, delay: 4000, label: 'fill' },
              { min: 0.75, max: 1.01, delay: 6000, label: 'detail' },
            ];

            // Fade all dots to near-invisible first
            for (let i = 0; i < dotCount; i++) {
              grid.setDotGalaxyState(i, { opacityOverride: 0.01 });
            }
            grid.wakeAnimation();

            // Pre-sort targets into phase buckets with their original indices
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

          // Label placement: use evidence nodes positioned at their cluster dots
          // Delay to after final phase completes (7s for person, 0 for instant)
          const crystallizeDelay = isVisionPerson && !prefersReducedMotion ? 7000 : 0;
          const crystallizeTimerId = window.setTimeout(() => {
            runCrystallizePhase(grid, objDotMap, nodes, relevantDotIndices);
          }, crystallizeDelay);
          visionTimerIds.push(crystallizeTimerId);

          // Store all timer IDs so cleanup can cancel them
          visionTimerIdsRef.current = visionTimerIds;

        } else {
          // Graph/cluster layout mode: existing behavior
          // layout is always present for graph-layout and cluster-layout methods
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

          // Progressive edge reveal
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

  // Double-click handler for galaxy exploration zoom
  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    if (!grid) return;

    if (zoom.active) {
      setZoom({ active: false, scale: 1, centerX: 0, centerY: 0, focusedClusterId: null });
      setInfoCard(null);
      grid.setPointerEvents(false);
      grid.setLabels([]);
      for (const m of mappingsRef.current) {
        grid.setDotGalaxyState(m.dotIndex, { opacityOverride: null });
      }
      grid.wakeAnimation();
      return;
    }

    const nearest = grid.findNearestClusterDot(e.clientX, e.clientY);
    if (!nearest) return;

    const mapping = mappingsRef.current.find((m) => m.clusterId === nearest.clusterId);
    if (!mapping) return;

    setZoom({
      active: true,
      scale: 3,
      centerX: nearest.x,
      centerY: nearest.y,
      focusedClusterId: nearest.clusterId,
    });

    grid.setDotGalaxyState(nearest.index, { opacityOverride: 0.5 });

    // Show labels on neighboring cluster dots
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
  }, [zoom.active, gridRef]);

  // Single click on a dot during explore phase opens the drawer
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'explore' && phaseRef.current !== 'crystallize') return;
    const grid = gridRef.current;
    if (!grid) return;

    const nearest = grid.findNearestClusterDot(e.clientX, e.clientY);
    if (!nearest) return;

    // Find the object ID mapped to this dot
    for (const [objectId, dotIndex] of objectDotMapRef.current) {
      if (dotIndex === nearest.index) {
        setDrawerObjectId(objectId);
        return;
      }
    }

    // If no object mapped, try the cluster's top objects
    const mapping = mappingsRef.current.find((m) => m.clusterId === nearest.clusterId);
    if (mapping && mapping.topObjects.length > 0) {
      setDrawerObjectId(mapping.topObjects[0]);
    }
  }, [gridRef]);

  // Hover feedback: brighten nearest evidence dot within 30px
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
    (e.currentTarget as HTMLDivElement).style.cursor = bestDotIndex !== null ? 'pointer' : 'default';
    grid.wakeAnimation();
  }, [gridRef]);

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
    if (!zoom.active) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setZoom({ active: false, scale: 1, centerX: 0, centerY: 0, focusedClusterId: null });
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
  }, [zoom.active, gridRef]);

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
      for (const id of visionTimerIdsRef.current) window.clearTimeout(id);
      window.clearInterval(pulseIntervalRef.current);
    };
  }, []);

  const { width: vw, height: vh } = gridRef.current?.getSize() ?? { width: 0, height: 0 };
  const zoomTransform = zoom.active
    ? `scale(${zoom.scale}) translate(${(vw / 2 - zoom.centerX) / zoom.scale}px, ${(vh / 2 - zoom.centerY) / zoom.scale}px)`
    : 'none';

  const typeColor = infoCard ? (TYPE_COLORS[infoCard.cluster.objectType] ?? '#9A958D') : '#9A958D';

  return (
    <>
      {/* Zoom and click interaction layer */}
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: zoom.active ? 2 : (phaseRef.current === 'idle' || phaseRef.current === 'explore' || phaseRef.current === 'crystallize' ? 1 : 0),
          pointerEvents: zoom.active || phaseRef.current === 'idle' || phaseRef.current === 'explore' || phaseRef.current === 'crystallize' ? 'auto' : 'none',
          cursor: zoom.active
            ? 'zoom-out'
            : (phaseRef.current === 'explore' || phaseRef.current === 'crystallize')
              ? 'default'
              : phaseRef.current === 'idle' ? 'pointer' : undefined,
        }}
      />

      {/* CSS zoom transform for canvas */}
      <style>{`
        .theseus-root > canvas,
        .theseus-root canvas[aria-hidden] {
          transition: transform ${prefersReducedMotion ? '0ms' : '400ms'} ease-out;
          transform-origin: center center;
          transform: ${zoomTransform};
        }
      `}</style>

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
      {infoCard && zoom.active && (
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
            Map
          </button>
        </div>
      )}

      {/* Detail exploration drawer */}
      <GalaxyDrawer
        objectId={drawerObjectId}
        onClose={() => setDrawerObjectId(null)}
        onWhatIfRemove={handleWhatIfRemove}
      />
    </>
  );
}
