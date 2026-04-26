/**
 * Shared cache for `/api/v2/theseus/edge-types/`. Lives under lens/
 * because the Lens classifyShell port (Stage 6 Task 6.4) is the
 * primary consumer; the GraphLegend pre-fetches so the cache is hot
 * by the time Lens mounts and so display labels are available for
 * any chip that wants them.
 *
 * The cache deduplicates concurrent fetches via `inflight`: if the
 * GraphLegend and the Lens panel both call `loadEdgeTypeMeta()` on
 * the same render cycle, only one network request goes out. A null
 * resolution caches an empty Map so repeated reads on a backend
 * that returned 4xx don't keep retrying every render.
 */

export type EpistemicRole = 'kin' | 'anchoring' | 'context' | 'structural';

export interface EdgeTypeMeta {
  slug: string;
  display_label: string;
  epistemic_role: EpistemicRole;
}

let cache: Map<string, EdgeTypeMeta> | null = null;
let inflight: Promise<Map<string, EdgeTypeMeta>> | null = null;

/** Returns a Map keyed by edge slug. Always resolves; on fetch
 *  failure resolves with an empty Map so the legend / lens fall
 *  back to displaying the raw slug. */
export async function loadEdgeTypeMeta(): Promise<Map<string, EdgeTypeMeta>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch('/api/v2/theseus/edge-types/');
      if (!response.ok) {
        cache = new Map();
        return cache;
      }
      const rows = (await response.json()) as EdgeTypeMeta[];
      const map = new Map<string, EdgeTypeMeta>();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row && typeof row.slug === 'string') {
            map.set(row.slug, row);
          }
        }
      }
      cache = map;
      return map;
    } catch {
      // Honest fallback: a network error sets the cache to empty so
      // every consumer renders raw slugs. This avoids tight retry
      // loops on flaky backends. Reload restores fetch behaviour.
      cache = new Map();
      return cache;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Synchronous read of the cached map. Returns null when the cache
 *  has not been populated yet; callers can fall through to the slug.
 *  Useful for render-time chip labels where a deferred fetch would
 *  cause a label flash. */
export function getCachedEdgeTypeMeta(): Map<string, EdgeTypeMeta> | null {
  return cache;
}

/** Test hook: clear both the cache and any in-flight fetch so unit
 *  tests can exercise multiple resolution paths in isolation. Not
 *  used in production code. */
export function _resetEdgeTypeMetaForTest(): void {
  cache = null;
  inflight = null;
}
