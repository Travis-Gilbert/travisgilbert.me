'use client';

/**
 * EntityNetwork: filtered network view for Person + Organization nodes.
 *
 * Uses the same KnowledgeMap component but passes a type filter for
 * 'person' and 'organization' slugs, enables clustering forces, and
 * shows labels on all nodes (not just hover).
 *
 * This view answers "who connects to whom" in the knowledge graph.
 */

import { useMemo } from 'react';
import KnowledgeMap from './KnowledgeMap';
import type { GraphNode, GraphLink } from '@/lib/commonplace';

const ENTITY_TYPES = new Set(['person', 'organization']);

interface EntityNetworkProps {
  onOpenObject?: (objectId: string) => void;
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
}

export default function EntityNetwork({
  onOpenObject,
  graphNodes,
  graphLinks,
}: EntityNetworkProps) {
  const filter = useMemo(() => ENTITY_TYPES, []);

  return (
    <KnowledgeMap
      onOpenObject={onOpenObject}
      graphNodes={graphNodes}
      graphLinks={graphLinks}
      filter={filter}
      cluster
      alwaysShowLabels
    />
  );
}
