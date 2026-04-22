'use client';

import { useEffect, useMemo, useState } from 'react';
import { getGraphData } from '@/lib/theseus-api';
import type { GraphNode, GraphEdge } from '@/lib/theseus-types';
import type { AtlasKind } from '@/components/theseus/atlas/sources';
import type { AtlasSurfaces } from '@/components/theseus/atlas/useAtlasFilters';

/** Sentinel color value signalling "use the VIE token fallback chain".
 *  The cosmos.gl encoder (`resolveTypeColorRgba`) treats any non-hex
 *  string as a cache miss and walks the type-token path; when that
 *  fails it falls back to `--color-rough`. Keeping a string sentinel
 *  here avoids a hardcoded hex triplet in the data layer (M4/N2). */
const MISSING_COLOR_SENTINEL = '__missing__';

export interface CosmoPoint {
  id: string;
  label: string;
  type: string;
  colorHex: string;
  degree: number;
  description?: string;
  /** Optional epistemic role (hypothetical, substantive, etc.).
   *  Not all backend payloads expose this yet; when absent, the
   *  renderer treats the node as substantive. */
  epistemic_role?: string;
  // --- Phase C: Mosaic filter columns. All optional. Django serializer
  // growth is happening in parallel; until it lands, these fall back to
  // undefined and are ingested into DuckDB as NULL so charts that depend
  // on them render empty rather than crashing the Explorer.
  status?: string;
  /** ISO-8601 string from Django; converted to TIMESTAMP by DuckDB. */
  captured_at?: string;
  pagerank?: number;
  leiden_community?: number;
  k_core_number?: number;
  graph_uncertainty?: number;
  novelty_score?: number;
}

export interface CosmoLink {
  source: string;
  target: string;
  weight: number;
  reason?: string;
  /** Optional edge metadata surfaced for DuckDB ingestion. */
  edge_type?: string;
  engine?: string;
}

export interface UseGraphDataResult {
  points: CosmoPoint[];
  links: CosmoLink[];
  loading: boolean;
  error: string | null;
  total: { nodes: number; edges: number };
}

export interface UseGraphDataOptions {
  /** Active kind set from the Atlas filter block. When a kind is not
   *  present in the set, nodes of that kind are filtered out. When the
   *  set covers all known kinds, no filtering is applied. */
  activeKinds?: Set<AtlasKind>;
  /** Atlas surface overlay toggles. Codd Graph ON restricts the canvas
   *  to code-kind / code-sourced nodes so the user sees the code slice
   *  of the graph. Theseus / Theorem Web overlays are held as metadata
   *  for the plate label for now — the data layer backing them will
   *  arrive in a later pass. */
  surfaces?: AtlasSurfaces;
}

/** Atlas "code" taxonomy — kinds or object-types that count as code when
 *  the Code Graph overlay is on. Matches the Atlas KINDS map. */
const CODE_TYPE_HINTS = new Set(['code', 'github', 'repo', 'commit', 'symbol']);
/** Kinds we know how to filter on; types outside this set are never
 *  hidden by the Atlas kind pills. */
const KNOWN_ATLAS_KINDS = new Set<AtlasKind>([
  'concept',
  'finding',
  'paper',
  'person',
  'code',
  'note',
]);

function isCodeNode(point: CosmoPoint): boolean {
  const t = point.type.toLowerCase();
  if (CODE_TYPE_HINTS.has(t)) return true;
  if (t.includes('code') || t.includes('git')) return true;
  return false;
}

/** Normalise a backend GraphNode (or an unknown record with the same
 *  fields) into the canvas-facing `CosmoPoint` shape. Accepts both the
 *  typed Explorer payload and the directive-point records that ship
 *  inline with chat scene directives. */
export function mapNode(node: GraphNode | Record<string, unknown>): CosmoPoint {
  const raw = node as Record<string, unknown>;
  const id = String(raw.id ?? '');
  const label = String(raw.title ?? raw.label ?? raw.slug ?? id);
  const type = String(raw.object_type ?? raw.type ?? 'note');
  const rawColor = raw.object_type_color ?? raw.colorHex;
  const colorHex = typeof rawColor === 'string' && rawColor.length > 0
    ? rawColor
    : MISSING_COLOR_SENTINEL;
  const degree = typeof raw.edge_count === 'number'
    ? raw.edge_count
    : typeof raw.degree === 'number'
      ? raw.degree
      : 0;
  const bodyPreview = typeof raw.body_preview === 'string' ? raw.body_preview : undefined;
  const description = typeof raw.description === 'string' ? raw.description : bodyPreview;
  const epistemic_role = typeof raw.epistemic_role === 'string' ? raw.epistemic_role : undefined;
  const status = typeof raw.status === 'string' ? raw.status : undefined;
  const captured_at = typeof raw.captured_at === 'string' ? raw.captured_at : undefined;
  const pagerank = typeof raw.pagerank === 'number' ? raw.pagerank : undefined;
  const leiden_community = typeof raw.leiden_community === 'number' ? raw.leiden_community : undefined;
  const k_core_number = typeof raw.k_core_number === 'number' ? raw.k_core_number : undefined;
  const graph_uncertainty = typeof raw.graph_uncertainty === 'number' ? raw.graph_uncertainty : undefined;
  const novelty_score = typeof raw.novelty_score === 'number' ? raw.novelty_score : undefined;
  return {
    id,
    label,
    type,
    colorHex,
    degree,
    description,
    epistemic_role,
    status,
    captured_at,
    pagerank,
    leiden_community,
    k_core_number,
    graph_uncertainty,
    novelty_score,
  };
}

export function mapEdge(edge: GraphEdge | Record<string, unknown>): CosmoLink | null {
  const raw = edge as Record<string, unknown>;
  const source = raw.source != null ? String(raw.source) : '';
  const target = raw.target != null ? String(raw.target) : '';
  if (!source || !target) return null;
  const weight = typeof raw.strength === 'number'
    ? raw.strength
    : typeof raw.weight === 'number'
      ? raw.weight
      : 0.5;
  const reason = typeof raw.reason === 'string' ? raw.reason : undefined;
  const edge_type = typeof raw.edge_type === 'string' ? raw.edge_type : undefined;
  const engine = typeof raw.engine === 'string' ? raw.engine : undefined;
  return { source, target, weight, reason, edge_type, engine };
}

export function useGraphData(options: UseGraphDataOptions = {}): UseGraphDataResult {
  const { activeKinds, surfaces } = options;
  const [state, setState] = useState<UseGraphDataResult>({
    points: [],
    links: [],
    loading: true,
    error: null,
    total: { nodes: 0, edges: 0 },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getGraphData({ limit: 2000 });
        if (cancelled) return;
        if (!result.ok) {
          setState((s) => ({
            ...s,
            loading: false,
            error: result.message ?? 'Failed to load graph',
          }));
          return;
        }
        const { nodes, edges, meta } = result;
        setState({
          points: nodes.map(mapNode),
          links: edges.map(mapEdge).filter((l): l is CosmoLink => l !== null),
          loading: false,
          error: null,
          total: { nodes: meta.node_count, edges: meta.edge_count },
        });
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derive filtered points + links from the raw state plus Atlas surface
  // and kind filters. When filters are fully-open this is a no-op.
  const filtered = useMemo((): UseGraphDataResult => {
    if (state.loading || state.error || state.points.length === 0) return state;

    const codeOnly = surfaces?.codeGraph === true;
    const kindSet = activeKinds;

    const keepNode = (p: CosmoPoint): boolean => {
      if (codeOnly && !isCodeNode(p)) return false;
      if (kindSet && kindSet.size > 0) {
        // Hide only nodes whose type maps to a known Atlas kind that's
        // been toggled off. Types outside the catalog pass through.
        const typeLower = p.type.toLowerCase() as AtlasKind;
        if (KNOWN_ATLAS_KINDS.has(typeLower) && !kindSet.has(typeLower)) return false;
      }
      return true;
    };

    const nextPoints = state.points.filter(keepNode);
    if (nextPoints.length === state.points.length) {
      return state;
    }

    const keptIds = new Set(nextPoints.map((p) => p.id));
    const nextLinks = state.links.filter(
      (l) => keptIds.has(l.source) && keptIds.has(l.target),
    );

    return {
      ...state,
      points: nextPoints,
      links: nextLinks,
    };
  }, [state, activeKinds, surfaces]);

  return filtered;
}
