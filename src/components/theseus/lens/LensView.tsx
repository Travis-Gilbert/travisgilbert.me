'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { computeLensLayout } from './useLensLayout';
import { loadEdgeTypeMeta, type EdgeTypeMeta } from './edgeTypeMeta';
import LensShellRenderer from './LensShellRenderer';
import {
  lensFocusToLayoutInputs,
  type LensFocusResponse,
} from './lensFocusContract';

/**
 * Tier 2 Lens close-read view (port of references/atlas-lens.jsx).
 *
 * Reads `?node=<id>` from the URL, fetches the lens-focus payload for
 * that node, runs `computeLensLayout` to assign neighbors to the
 * inner / middle / outer shells, and renders the SVG via
 * `LensShellRenderer`. The lens-focus endpoint shipped at Index-API
 * commit 9a3e02d with the canonical {focused, neighbors[].edge} shape;
 * the response contract lives in `./lensFocusContract`.
 */

async function fetchLensData(nodeId: string): Promise<LensFocusResponse> {
  const response = await fetch(`/api/v1/notebook/objects/${nodeId}/lens-focus/`);
  if (!response.ok) throw new Error(`lens-focus HTTP ${response.status}`);
  return (await response.json()) as LensFocusResponse;
}

export default function LensView() {
  const params = useSearchParams();
  const node = params?.get('node');
  const [data, setData] = useState<LensFocusResponse | null>(null);
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
    const inputs = lensFocusToLayoutInputs(data);
    return computeLensLayout({
      focused: inputs.focused,
      neighbors: inputs.neighbors,
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
      <button
        type="button"
        className="lens-back"
        onClick={() => {
          // window.history.back triggers PanelManager popstate listener
          // and Explorer's ?live_additions= URL hydration on remount.
          window.history.back();
          window.dispatchEvent(
            new CustomEvent('theseus:switch-panel', {
              detail: { panel: 'explorer' },
            }),
          );
        }}
        aria-label="Back to corpus view"
      >
        Back
      </button>
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
          focusedTitle={data.focused.title}
          focusedDisplayId={String(data.focused.id)}
        />
      </svg>
    </div>
  );
}
