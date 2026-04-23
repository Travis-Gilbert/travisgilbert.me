'use client';

import { useCallback, useMemo, useState } from 'react';
import { ATLAS_SOURCES, ATLAS_KINDS, type AtlasKind } from './sources';
import type { GraphScope } from '@/lib/theseus-api';

export interface AtlasSurfaces {
  theseus: boolean;
  theorem: boolean;
  codeGraph: boolean;
}

const DEFAULT_SURFACES: AtlasSurfaces = {
  theseus: false,
  theorem: false,
  codeGraph: false,
};

/**
 * Baseline scope for the Explorer canvas. `combined` is the full
 * Theseus graph (pipeline-ingested corpus + user captures). `corpus`
 * drops user captures; `personal` keeps only them. Backed server-side
 * by the `source_system IS NULL` predicate; see
 * apps/notebook/views/graph.py::graph_data_view.
 */
const DEFAULT_SCOPE: GraphScope = 'combined';

export interface AtlasFiltersState {
  activeSources: Set<string>;
  activeKinds: Set<AtlasKind>;
  surfaces: AtlasSurfaces;
  scope: GraphScope;
  toggleSource: (id: string) => void;
  toggleKind: (kind: AtlasKind) => void;
  toggleSurface: (key: keyof AtlasSurfaces) => void;
  setScope: (scope: GraphScope) => void;
  surfaceLabel: string;
  scopeLabel: string;
}

/**
 * Atlas filter + surface-overlay state. Lifts up to TheseusShell so the
 * sidebar writes it and Explorer / Plate label read it.
 *
 * Initial scope: `combined` — the full Theseus corpus plus the user's
 * captures, rendered like the cosmos.gl worm-clusters example so the
 * baseline reads as "machine thinking" rather than one blob.
 * Initial surfaces: all off.
 * Active sources/kinds: all on = no filtering.
 */
export function useAtlasFilters(): AtlasFiltersState {
  const [activeSources, setActiveSources] = useState<Set<string>>(
    () => new Set(ATLAS_SOURCES.map((s) => s.id)),
  );
  const [activeKinds, setActiveKinds] = useState<Set<AtlasKind>>(
    () => new Set(Object.keys(ATLAS_KINDS) as AtlasKind[]),
  );
  const [surfaces, setSurfaces] = useState<AtlasSurfaces>(DEFAULT_SURFACES);
  const [scope, setScopeState] = useState<GraphScope>(DEFAULT_SCOPE);

  const toggleSource = useCallback((id: string) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleKind = useCallback((kind: AtlasKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const toggleSurface = useCallback((key: keyof AtlasSurfaces) => {
    setSurfaces((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const setScope = useCallback((next: GraphScope) => {
    setScopeState(next);
  }, []);

  const surfaceLabel = useMemo(() => {
    const parts = [] as string[];
    if (surfaces.theseus) parts.push('T');
    if (surfaces.theorem) parts.push('TW');
    if (surfaces.codeGraph) parts.push('CG');
    if (parts.length === 0) return 'Argo';
    return `Argo+${parts.join('+')}`;
  }, [surfaces]);

  const scopeLabel = useMemo(() => {
    switch (scope) {
      case 'corpus':
        return 'Theseus corpus';
      case 'personal':
        return 'My captures';
      case 'combined':
      default:
        return 'Corpus + mine';
    }
  }, [scope]);

  return {
    activeSources,
    activeKinds,
    surfaces,
    scope,
    toggleSource,
    toggleKind,
    toggleSurface,
    setScope,
    surfaceLabel,
    scopeLabel,
  };
}
