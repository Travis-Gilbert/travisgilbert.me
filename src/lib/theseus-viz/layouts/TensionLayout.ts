/* SPEC-VIE-3: Split contradiction layout for tension-bearing graphs */

import type { EvidenceNode, EvidenceEdge, TensionSection } from '@/lib/theseus-types';
import { seededRandom, clamp } from './layoutUtils';

/**
 * Partitions nodes into two sides based on TensionSection analysis.
 * Side A: x in [-10, -2], Side B: x in [2, 10], Neutral: x in [-2, 2].
 * y = small random offset for visual spread.
 */
export function computeTensionLayout(
  nodes: EvidenceNode[],
  edges: EvidenceEdge[],
  tensions: TensionSection[],
): [number, number, number][] {
  if (nodes.length === 0) return [];

  // Classify nodes into sides based on claim membership in tensions
  const sideA = new Set<string>();
  const sideB = new Set<string>();

  for (const tension of tensions) {
    for (const nd of nodes) {
      const claims = nd.claims.map((c: string) => c.toLowerCase());
      const claimALower = tension.claim_a.toLowerCase();
      const claimBLower = tension.claim_b.toLowerCase();
      if (claims.some((c: string) => c.includes(claimALower))) {
        sideA.add(nd.object_id);
      }
      if (claims.some((c: string) => c.includes(claimBLower))) {
        sideB.add(nd.object_id);
      }
    }
  }

  // Also classify by contradicts edges: if node connects to sideA via contradicts, it's sideB
  for (const e of edges) {
    if (e.relation !== 'contradicts') continue;
    if (sideA.has(e.from_id) && !sideA.has(e.to_id)) sideB.add(e.to_id);
    if (sideA.has(e.to_id) && !sideA.has(e.from_id)) sideB.add(e.from_id);
    if (sideB.has(e.from_id) && !sideB.has(e.to_id)) sideA.add(e.to_id);
    if (sideB.has(e.to_id) && !sideB.has(e.from_id)) sideA.add(e.from_id);
  }

  // Remove nodes in both sides from both (they're neutral)
  const bothSides = new Set<string>();
  for (const id of sideA) {
    if (sideB.has(id)) bothSides.add(id);
  }
  for (const id of bothSides) {
    sideA.delete(id);
    sideB.delete(id);
  }

  // Materialize arrays once to avoid O(n^2) spread inside map
  const sideAArr = Array.from(sideA);
  const sideBArr = Array.from(sideB);

  return nodes.map((nd, i) => {
    const id = nd.object_id;
    const yOff = seededRandom(i * 7 + 31) * 4 - 2; // [-2, 2]
    const zOff = seededRandom(i * 11 + 43) * 4 - 2;

    if (sideA.has(id)) {
      const idx = sideAArr.indexOf(id);
      const x = sideAArr.length > 1 ? -10 + (idx / (sideAArr.length - 1)) * 8 : -6;
      return [clamp(x), yOff, zOff];
    }
    if (sideB.has(id)) {
      const idx = sideBArr.indexOf(id);
      const x = sideBArr.length > 1 ? 2 + (idx / (sideBArr.length - 1)) * 8 : 6;
      return [clamp(x), yOff, zOff];
    }
    // Neutral
    return [clamp(seededRandom(i * 5 + 7) * 4 - 2), yOff, zOff];
  });
}

