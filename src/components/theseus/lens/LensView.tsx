'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { computeLensLayout } from './useLensLayout';
import { loadEdgeTypeMeta, type EdgeTypeMeta } from './edgeTypeMeta';
import LensShellRenderer from './LensShellRenderer';

/**
 * Tier 2 Lens close-read view (port of references/atlas-lens.jsx).
 *
 * Reads `?node=<id>` from the URL, fetches the lens-focus payload for
 * that node, runs `computeLensLayout` to assign neighbors to the
 * inner / middle / outer shells, and renders the SVG via
 * `LensShellRenderer`. The lens-focus endpoint is tracked as a
 * deferred Stage 6 follow-up in `docs/plans/instant-kg/cross-cutting.md`;
 * until it lands the LensView shows an honest loading state per
 * CLAUDE.md "Empty states are honest".
 */

interface NeighborPayload {
  object_id: number;
  title: string;
  object_type_slug: string;
  edge_type: string;
  edge_label?: string;
}

interface LensFocusPayload {
  object_id: number;
  title: string;
  object_type_slug: string;
  neighbors: NeighborPayload[];
}

async function fetchLensData(nodeId: string): Promise<LensFocusPayload> {
  const response = await fetch(`/api/v1/notebook/objects/${nodeId}/lens-focus/`);
  if (!response.ok) throw new Error(`lens-focus HTTP ${response.status}`);
  return (await response.json()) as LensFocusPayload;
}

export default function LensView() {
  const params = useSearchParams();
  const node = params?.get('node');
  const [data, setData] = useState<LensFocusPayload | null>(null);
  const [edgeTypeMeta, setEdgeTypeMeta] = useState<Map<string, EdgeTypeMeta> | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [shellHover] = useState<'inner' | 'middle' | 'outer' | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEdgeTypeMeta().then((m) => {
      if (!cancelled) setEdgeTypeMeta(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!node) return;
    let cancelled = false;
    fetchLensData(node)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [node]);

  const layout = useMemo(() => {
    if (!data || !edgeTypeMeta) return null;
    return computeLensLayout({
      focused: { id: String(data.object_id), kind: data.object_type_slug },
      neighbors: data.neighbors.map((n) => ({
        node: { id: String(n.object_id), kind: n.object_type_slug },
        edgeType: n.edge_type,
        edgeLabel: n.edge_label,
      })),
      edgeTypeMeta,
    });
  }, [data, edgeTypeMeta]);

  if (!node) {
    return <div className="lens-empty">Pick a node to focus the Lens.</div>;
  }
  if (!data || !edgeTypeMeta || !layout) {
    return <div className="lens-empty">Loading Lens for node {node}.</div>;
  }

  return (
    <div className="lens-canvas">
      <svg
        viewBox="0 0 1120 680"
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
      >
        <defs>
          <radialGradient id="lens-halo" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="var(--paper-pencil)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="var(--paper-pencil)" stopOpacity={0} />
          </radialGradient>
        </defs>
        <LensShellRenderer
          layout={layout}
          hoverId={hoverId}
          onHoverId={setHoverId}
          showLabels={true}
          shellHover={shellHover}
          focusedTitle={data.title}
          focusedDisplayId={String(data.object_id)}
        />
      </svg>
    </div>
  );
}
