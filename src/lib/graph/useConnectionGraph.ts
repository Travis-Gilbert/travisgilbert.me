'use client';

/**
 * Custom hook: fetches connection data from the research API and transforms
 * it into D3-ready node/edge format.
 *
 * Usage:
 *   const { nodes, edges, loading, error } = useConnectionGraph(slug);
 *
 * With slug: fetches /api/v1/connections/<slug>/ (popup, client-side)
 * Without slug: this hook is not needed; use server-side fetch instead.
 */

import { useEffect, useState } from 'react';
import {
  transformConnectionResponse,
  type GraphNode,
  type GraphEdge,
  type APIConnectionResponse,
} from './connectionTransform';

// Browser: relative URL (rewrite proxy handles it)
const RESEARCH_URL = '';

interface UseConnectionGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetch and transform connection data for a single content piece (popup).
 *
 * @param slug        Content slug to fetch connections for
 * @param centerTitle Display title for the center node
 */
export function useConnectionGraph(
  slug: string | null,
  centerTitle = '',
): UseConnectionGraphResult {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${RESEARCH_URL}/api/v1/connections/${slug}/`)
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json() as Promise<APIConnectionResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        const result = transformConnectionResponse(data, centerTitle);
        setNodes(result.nodes);
        setEdges(result.edges);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch connections');
        setNodes([]);
        setEdges([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, centerTitle]);

  return { nodes, edges, loading, error };
}
