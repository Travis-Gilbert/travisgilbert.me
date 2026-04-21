'use client';

// Stable id→label resolver for applySceneDirective callers.
//
// ExplorerShell and the inline chat GraphPart both need to hand
// applySceneDirective a resolver that turns node ids into display text.
// Both build the same `{id -> label}` map from their CosmoPoint list, then
// wrap it in a ref so the resolver's identity stays stable across renders
// (React Compiler churns the useEffect dep array otherwise). This hook
// captures that pattern in one place.

import { useMemo, useRef } from 'react';
import type { CosmoPoint } from './useGraphData';

export function useLabelResolver(
  points: CosmoPoint[],
): (id: string) => string | undefined {
  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of points) map.set(p.id, p.label);
    return map;
  }, [points]);
  const labelByIdRef = useRef<Map<string, string>>(labelById);
  labelByIdRef.current = labelById;
  const resolverRef = useRef((id: string) => labelByIdRef.current.get(id));
  return resolverRef.current;
}

/** Richer resolver that returns a concatenation of label + description,
 *  suitable for semantic embedding by the foundation encoder. Falls back
 *  to the label alone when no description is available. Stable identity
 *  across renders for use as a Choreographer option. */
export function useEvidenceTextResolver(
  points: CosmoPoint[],
): (id: string) => string | undefined {
  const textById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of points) {
      const body = p.description && p.description.length > 0 ? `. ${p.description}` : '';
      map.set(p.id, `${p.label}${body}`);
    }
    return map;
  }, [points]);
  const textByIdRef = useRef<Map<string, string>>(textById);
  textByIdRef.current = textById;
  const resolverRef = useRef((id: string) => textByIdRef.current.get(id));
  return resolverRef.current;
}
