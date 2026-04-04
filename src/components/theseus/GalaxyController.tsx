'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DotGridHandle } from './TheseusDotGrid';
import type { ClusterSummary, EvidenceEdge, EvidenceNode, TheseusResponse, WhatIfResult } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import { getClusters } from '@/lib/theseus-api';
import { mulberry32 } from '@/lib/prng';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { TYPE_COLORS } from './renderers/rendering';
import { computeGraphLayout, computeClusterLayout } from './galaxyLayout';
import { generateTargets } from '@/lib/galaxy/TargetGenerator';
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
}

export default function GalaxyController({
  gridRef,
  state,
  response,
  directive,
  dataStatus,
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
  const edgeProgressRef = useRef<number>(0);
  const labelAlphaRef = useRef<number>(0);
  // Map from object_id to dot index for answer construction
  const objectDotMapRef = useRef<Map<string, number>>(new Map());
  // Original grid positions for reset
  const originalPositionsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Data acquisition pulsing
  const pulseIntervalRef = useRef<number>(0);
  const [isAcquiring, setIsAcquiring] = useState(false);
  // Drawer for cluster detail exploration
  const [drawerObjectId, setDrawerObjectId] = useState<string | null>(null);
  // Track previous query for follow-up transitions
  const prevQueryRef = useRef<string | null>(null);

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
      edgeProgressRef.current = 0;
      labelAlphaRef.current = 0;
      objectDotMapRef.current.clear();

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
      const cx = width / 2;
      const cy = height * 0.4;
      let pulsePhase = 0;

      const pulseInterval = window.setInterval(() => {
        pulsePhase += 0.04;

        for (const m of mappingsRef.current) {
          const pos = grid.getDotPosition(m.dotIndex);
          if (!pos) continue;
          const dx = pos.x - cx;
          const dy = pos.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = Math.sqrt(cx * cx + cy * cy);
          const norm = dist / maxDist;

          const wave = Math.sin((norm * 6) - pulsePhase * 3);
          const pulse = Math.max(0, wave) * 0.18;
          grid.setDotGalaxyState(m.dotIndex, {
            opacityOverride: 0.06 + pulse,
            colorOverride: pulse > 0.05 ? [74, 138, 150] : null,
          });
        }

        grid.wakeAnimation();
      }, 50);

      pulseIntervalRef.current = pulseInterval;
      return;
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

  function runAnswerConstruction(grid: DotGridHandle, resp: TheseusResponse) {
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
    const relevantDotIndices = new Set(objDotMap.values());

    // === PHASE 2: FILTERING (500ms opacity ramp) ===
    phaseRef.current = 'filtering';

    // Target opacities for the ramp
    const filterTargets = new Map<number, { opacity: number; color: [number, number, number] | null }>();
    for (const m of mappingsRef.current) {
      const isRelevant = relevantDotIndices.has(m.dotIndex);
      const typeColor = TYPE_COLORS[m.objectType];
      const rgb = typeColor ? hexToRgb(typeColor) : null;
      filterTargets.set(m.dotIndex, {
        opacity: isRelevant ? 0.25 : 0.005,
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
          // Image mode: assign ALL dots to image target positions
          // This creates the portrait/shape effect where the entire background participates
          const targets = result.targets;

          for (let i = 0; i < dotCount && i < targets.length; i++) {
            const target = targets[i];
            const jitterX = (Math.random() - 0.5) * 4;
            const jitterY = (Math.random() - 0.5) * 4;

            if (prefersReducedMotion) {
              grid.setDotGalaxyState(i, { opacityOverride: 0.25 + target.weight * 0.25 });
            } else {
              grid.setDotTarget(i, target.x + jitterX, target.y + jitterY);
              grid.setDotGalaxyState(i, { opacityOverride: 0.25 + target.weight * 0.25 });
            }
          }

          // Dots beyond target count: fade to nearly invisible
          for (let i = targets.length; i < dotCount; i++) {
            grid.setDotGalaxyState(i, { opacityOverride: 0.01 });
          }

          grid.wakeAnimation();

          // No edges for image mode (the shape IS the answer)
          // Label placement: use evidence nodes positioned at their cluster dots
          runCrystallizePhase(grid, objDotMap, nodes, relevantDotIndices);

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

      const labelData: Array<{ x: number; y: number; text: string; objectId: string }> = [];
      for (const [objectId, dotIndex] of objDotMap) {
        const node = nodes.find((n) => n.object_id === objectId);
        if (!node) continue;
        const pos = grid.getDotPosition(dotIndex);
        if (!pos) continue;
        labelData.push({
          x: pos.x, y: pos.y, objectId,
          text: node.title.length > 20 ? node.title.slice(0, 20) + '...' : node.title,
        });
      }

      if (prefersReducedMotion) {
        grid.setLabels(labelData.map((l) => ({ x: l.x, y: l.y, text: l.text, alpha: 0.7 })));
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
          grid.setLabels(labelData.map((l) => ({ x: l.x, y: l.y, text: l.text, alpha: 0.7 * t })));
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
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: zoom.active ? 2 : (phaseRef.current === 'idle' || phaseRef.current === 'explore' || phaseRef.current === 'crystallize' ? 1 : 0),
          pointerEvents: zoom.active || phaseRef.current === 'idle' || phaseRef.current === 'explore' || phaseRef.current === 'crystallize' ? 'auto' : 'none',
          cursor: zoom.active ? 'zoom-out' : (phaseRef.current === 'idle' || phaseRef.current === 'explore' ? 'pointer' : undefined),
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
            pointerEvents: 'none',
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
