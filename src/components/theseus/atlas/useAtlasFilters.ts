'use client';

import { useCallback, useMemo, useState } from 'react';
import { ATLAS_SOURCES, ATLAS_KINDS, type AtlasKind } from './sources';

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

export interface AtlasFiltersState {
  activeSources: Set<string>;
  activeKinds: Set<AtlasKind>;
  surfaces: AtlasSurfaces;
  toggleSource: (id: string) => void;
  toggleKind: (kind: AtlasKind) => void;
  toggleSurface: (key: keyof AtlasSurfaces) => void;
  surfaceLabel: string;
}

/**
 * Atlas filter + surface-overlay state. Lifts up to TheseusShell so the
 * sidebar writes it and Explorer / Plate label read it.
 *
 * Initial surfaces: all off = user's personal Argo graph.
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

  const surfaceLabel = useMemo(() => {
    const parts = [] as string[];
    if (surfaces.theseus) parts.push('T');
    if (surfaces.theorem) parts.push('TW');
    if (surfaces.codeGraph) parts.push('CG');
    if (parts.length === 0) return 'Argo';
    return `Argo+${parts.join('+')}`;
  }, [surfaces]);

  return {
    activeSources,
    activeKinds,
    surfaces,
    toggleSource,
    toggleKind,
    toggleSurface,
    surfaceLabel,
  };
}
