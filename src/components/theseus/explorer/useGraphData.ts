'use client';

import { useEffect, useState } from 'react';
import { getGraphData } from '@/lib/theseus-api';
import type { GraphNode, GraphEdge } from '@/lib/theseus-types';

export const DEFAULT_POINT_COLOR = '#7a6a58';

export interface CosmoPoint {
  id: string;
  label: string;
  type: string;
  colorHex: string;
  degree: number;
  description?: string;
}

export interface CosmoLink {
  source: string;
  target: string;
  weight: number;
  reason?: string;
}

export interface UseGraphDataResult {
  points: CosmoPoint[];
  links: CosmoLink[];
  loading: boolean;
  error: string | null;
  total: { nodes: number; edges: number };
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
  const colorHex = String(raw.object_type_color ?? raw.colorHex ?? DEFAULT_POINT_COLOR);
  const degree = typeof raw.edge_count === 'number'
    ? raw.edge_count
    : typeof raw.degree === 'number'
      ? raw.degree
      : 0;
  const bodyPreview = typeof raw.body_preview === 'string' ? raw.body_preview : undefined;
  const description = typeof raw.description === 'string' ? raw.description : bodyPreview;
  return { id, label, type, colorHex, degree, description };
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
  return { source, target, weight, reason };
}

export function useGraphData(): UseGraphDataResult {
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

  return state;
}
