'use client';

import { useEffect, useState } from 'react';
import { getGraphData } from '@/lib/theseus-api';
import type { GraphNode, GraphEdge } from '@/lib/theseus-types';

export interface CosmographPoint {
  id: string;
  /** Sequential integer index. Required by Cosmograph's data prep
   *  (`pointIndexBy`) for efficient row-level lookups. */
  index: number;
  label: string;
  type: string;
  pagerank?: number;
  degree?: number;
  community?: number | null;
  confidence?: number;
  ingested_at?: string;
  description?: string;
}

export interface CosmographLink {
  source: string;
  target: string;
  weight?: number;
  reason?: string;
}

export interface UseGraphDataResult {
  points: CosmographPoint[];
  links: CosmographLink[];
  loading: boolean;
  error: string | null;
  total: { nodes: number; edges: number };
}

function mapNode(node: GraphNode, index: number): CosmographPoint {
  return {
    id: node.id,
    index,
    label: node.title,
    type: node.object_type || 'note',
    degree: node.edge_count,
    description: node.body_preview,
  };
}

function mapEdge(edge: GraphEdge): CosmographLink {
  return {
    source: edge.source,
    target: edge.target,
    weight: edge.strength,
    reason: edge.reason,
  };
}

/**
 * Load graph data for the Explorer Cosmograph surface. Normalises the
 * `/api/v1/notebook/graph/` response into Cosmograph's `{ points, links }`
 * shape; Cosmograph owns physics simulation.
 */
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
          points: nodes.map((n, i) => mapNode(n, i)),
          links: edges.map(mapEdge),
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
