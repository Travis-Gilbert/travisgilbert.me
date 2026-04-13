'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';
import { scaleSqrt } from 'd3-scale';
import { getClusters } from '@/lib/theseus-api';
import type { ClusterSummary } from '@/lib/theseus-types';

/** A positioned cluster blob for canvas rendering. */
export interface DeepFieldBlob {
  id: number;
  label: string;
  memberCount: number;
  x: number;      // positioned by d3-force, normalized 0-1
  y: number;
  radius: number;  // visual radius in px (before zoom)
  glowRadius: number;
  pulseOffset: number;
}

export interface UseDeepFieldReturn {
  blobs: DeepFieldBlob[];
  visible: boolean;
  loading: boolean;
  toggle: () => void;
}

/** mulberry32 PRNG for deterministic pulse offsets. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function useDeepField(): UseDeepFieldReturn {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [blobs, setBlobs] = useState<DeepFieldBlob[]>([]);
  const fetchedRef = useRef(false);

  const toggle = useCallback(() => {
    setVisible((v) => !v);
  }, []);

  // Fetch clusters once when first toggled on
  useEffect(() => {
    if (!visible || fetchedRef.current) return;
    fetchedRef.current = true;

    async function load() {
      setLoading(true);
      const result = await getClusters();
      if (!result.ok || !result.clusters) {
        setLoading(false);
        return;
      }

      const clusters = result.clusters.filter((c: ClusterSummary) => c.member_count > 20);
      if (clusters.length === 0) {
        setLoading(false);
        return;
      }

      // Scale radius by member count using sqrt (area-correct)
      const radiusScale = scaleSqrt()
        .domain([0, Math.max(...clusters.map((c: ClusterSummary) => c.member_count))])
        .range([15, 60]);

      // Build simulation nodes
      interface SimBlob extends SimulationNodeDatum {
        clusterId: number;
        r: number;
      }

      const rng = mulberry32(42);
      const simNodes: SimBlob[] = clusters.map((c: ClusterSummary) => ({
        clusterId: c.id,
        r: radiusScale(c.member_count),
        x: (rng() - 0.5) * 400,
        y: (rng() - 0.5) * 400,
      }));

      // Run force simulation: spread blobs apart, no overlaps
      const sim = forceSimulation<SimBlob>(simNodes)
        .force('charge', forceManyBody<SimBlob>().strength(-200))
        .force('collide', forceCollide<SimBlob>().radius((d) => d.r * 2.5).strength(0.8))
        .force('cx', forceX<SimBlob>(0).strength(0.03))
        .force('cy', forceY<SimBlob>(0).strength(0.03))
        .stop();

      sim.tick(200);

      // Normalize positions to 0-1 range
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const sn of simNodes) {
        const x = sn.x ?? 0;
        const y = sn.y ?? 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;

      const rng2 = mulberry32(7);
      const positioned: DeepFieldBlob[] = clusters.map((c: ClusterSummary, i: number) => {
        const sn = simNodes[i];
        const r = radiusScale(c.member_count);
        return {
          id: c.id,
          label: c.label,
          memberCount: c.member_count,
          x: 0.08 + (((sn.x ?? 0) - minX) / rangeX) * 0.84,
          y: 0.08 + (((sn.y ?? 0) - minY) / rangeY) * 0.84,
          radius: r,
          glowRadius: r * 3,
          pulseOffset: rng2() * Math.PI * 2,
        };
      });

      setBlobs(positioned);
      setLoading(false);
    }

    load();
  }, [visible]);

  return { blobs, visible, loading, toggle };
}
