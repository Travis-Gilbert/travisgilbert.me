'use client';

import { useCallback, useMemo, useState } from 'react';
import { ATLAS_SOURCES, ATLAS_KINDS, type AtlasKind } from './sources';
import type { GraphScope } from '@/lib/theseus-api';

export interface AtlasSurfaces {
  theseus: boolean;
  theorem: boolean;
  codeGraph: boolean;
}

/**
 * Defaults: `theseus` (pipeline-ingested corpus) and `theorem` (your
 * captures) both on → the baseline renders `combined` scope. `codeGraph`
 * is a separate client-side overlay that restricts the canvas to
 * code-kind nodes; off by default.
 *
 * The three existing surface checkboxes are the data-source UI; scope
 * below is a derivation of `theseus` + `theorem`, not independent state.
 */
const DEFAULT_SURFACES: AtlasSurfaces = {
  theseus: true,
  theorem: true,
  codeGraph: false,
};

export interface AtlasFiltersState {
  activeSources: Set<string>;
  activeKinds: Set<AtlasKind>;
  surfaces: AtlasSurfaces;
  scope: GraphScope;
  toggleSource: (id: string) => void;
  toggleKind: (kind: AtlasKind) => void;
  toggleSurface: (key: keyof AtlasSurfaces) => void;
  surfaceLabel: string;
  scopeLabel: string;
}

/**
 * Atlas filter + surface-overlay state. Lifts up to TheseusShell so the
 * sidebar writes it and Explorer / Plate label read it.
 *
 * Scope is derived from the Theseus + Theorem Web checkboxes:
 *   Theseus ON  + Theorem Web ON  → combined (corpus + captures)
 *   Theseus ON  + Theorem Web OFF → corpus   (pipeline-ingested only)
 *   Theseus OFF + Theorem Web ON  → personal (user captures only)
 *   both OFF                      → combined fallback (the server would
 *                                   otherwise receive no signal; the
 *                                   canvas's own empty state still fires
 *                                   if the user actively deselects)
 *
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

  const scope: GraphScope = useMemo(() => {
    if (surfaces.theseus && surfaces.theorem) return 'combined';
    if (surfaces.theseus) return 'corpus';
    if (surfaces.theorem) return 'personal';
    return 'combined';
  }, [surfaces.theseus, surfaces.theorem]);

  const surfaceLabel = useMemo(() => {
    const parts = [] as string[];
    if (surfaces.codeGraph) parts.push('CG');
    if (parts.length === 0) return '';
    return parts.join('+');
  }, [surfaces.codeGraph]);

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
    surfaceLabel,
    scopeLabel,
  };
}
