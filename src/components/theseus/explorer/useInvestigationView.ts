'use client';

import { useCallback, useMemo, useState } from 'react';
import type Graph from 'graphology';
import type { InvestigationView, TheseusResponse } from '@/lib/theseus-types';
import { projectGraph } from '@/lib/graph-projections';
import type { ProjectedGraph, ViewContext } from '@/lib/graph-projections';

export interface UseInvestigationViewReturn {
  activeView: InvestigationView;
  setActiveView: (view: InvestigationView) => void;
  projection: ProjectedGraph;
}

export function useInvestigationView(
  graph: Graph,
  response: TheseusResponse | null,
  retrievalObjectIds?: Set<string>,
  focalObjectIds?: Set<string>,
): UseInvestigationViewReturn {
  const [activeView, setActiveView] = useState<InvestigationView>('all');

  const context: ViewContext = useMemo(() => ({
    response,
    retrievalObjectIds,
    focalObjectIds,
  }), [response, retrievalObjectIds, focalObjectIds]);

  const projection = useMemo(() => {
    return projectGraph(graph, activeView, context);
  }, [graph, activeView, context]);

  const handleSetActiveView = useCallback((view: InvestigationView) => {
    setActiveView(view);
  }, []);

  return {
    activeView,
    setActiveView: handleSetActiveView,
    projection,
  };
}
