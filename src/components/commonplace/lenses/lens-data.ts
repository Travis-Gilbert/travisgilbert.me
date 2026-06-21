'use client';

/**
 * Engine-lens data seam.
 *
 * One live call backs the engine lenses: `gqlAsk` — the store's unified
 * retrieve (vector + lexical + graph, fused), seeded by the object. Terminal
 * renders its answer + provenance; Cluster builds its ego-graph from the same
 * provenance; both degrade cleanly when an arm returns nothing (SC-010).
 *
 * `gqlFetchObjectDetail` enriches with the object's own body / claims / edges
 * when the REST/epistemic backend is live; on the GraphQL backend those may be
 * sparse, and the lenses fall back to the ask provenance.
 */

import { gqlAsk, itemToObjectListItem } from '@/lib/commonplace-graphql';
import type { AskResultGql, AskProvenanceGql } from '@/lib/commonplace-graphql';
import { renderableFromObjectListItem } from '../objectRenderables';
import type { RenderableObject } from '../objects/ObjectRenderer';

export type { AskResultGql, AskProvenanceGql } from '@/lib/commonplace-graphql';

/** A neighbor surfaced for an object: the object, its fusion score, and the arms that found it. */
export interface LensNeighbor {
  object: RenderableObject;
  score: number;
  arms: string[];
}

/** Seed a question scoped to an object. Empty user input asks for the open read. */
export function scopedQuestion(objectTitle: string, userQuestion?: string): string {
  const subject = objectTitle?.trim() || 'this object';
  const q = userQuestion?.trim();
  if (!q) return `What is known about: ${subject}?`;
  return `Regarding "${subject}": ${q}`;
}

/** Run the engine's unified retrieve, seeded by (and scoped to) the object. */
export function askObject(objectTitle: string, userQuestion: string | undefined, k = 8): Promise<AskResultGql> {
  return gqlAsk(scopedQuestion(objectTitle, userQuestion), k);
}

/** Map ask provenance into renderable neighbors (drops the seed object itself). */
export function provenanceToNeighbors(
  provenance: AskProvenanceGql[],
  selfSlug?: string,
): LensNeighbor[] {
  const out: LensNeighbor[] = [];
  const seen = new Set<string>();
  for (const p of provenance) {
    const object = renderableFromObjectListItem(itemToObjectListItem(p.item));
    if (selfSlug && object.slug === selfSlug) continue;
    if (seen.has(object.slug)) continue;
    seen.add(object.slug);
    out.push({ object, score: p.score, arms: p.arms ?? [] });
  }
  return out;
}

/** Human-readable name for a retrieval arm. */
export function armLabel(arm: string): string {
  const map: Record<string, string> = {
    vector: 'semantic',
    semantic: 'semantic',
    lexical: 'lexical',
    bm25: 'lexical',
    fts: 'lexical',
    graph: 'graph',
    similar_to: 'graph',
    ppr: 'graph',
  };
  return map[arm?.toLowerCase()] ?? arm;
}

/** Clamp a fusion score into a 0-100 confidence percent for the bar. */
export function confidencePct(score: number): number {
  if (!Number.isFinite(score)) return 0;
  // RRF / cosine scores are small positive numbers; normalize generously.
  const pct = score <= 1 ? score * 100 : Math.min(score, 100);
  return Math.max(2, Math.min(100, Math.round(pct)));
}

/**
 * External / web context seam (FR-012). There is no browser-reachable web
 * search endpoint today (web_search_graph / fractal_expansion live behind the
 * harness MCP, not the consumer client), so this honestly returns nothing and
 * the Terminal lens shows a clear "no web context" state (SC-010 permits the
 * internal-read-only case). Upgrade path: a /web-context route over
 * rustyweb_search_acquisition, mapped to LensNeighbor[].
 */
export const WEB_CONTEXT_AVAILABLE = false;

export async function fetchWebContext(_objectTitle: string): Promise<LensNeighbor[]> {
  return [];
}
