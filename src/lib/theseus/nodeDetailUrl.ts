/**
 * Helper for navigating to the Reflex node detail page.
 *
 * Reads `NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL` at build time. Falls back
 * to the production hostname when the env var is unset so dev / preview
 * builds without configuration still produce a navigable URL.
 *
 * `openNodeDetail(pk)` opens the URL in a new tab with `noopener,noreferrer`
 * so the new page cannot reach back into the Explorer (security plus
 * keeps the cosmos.gl simulation isolated from the new tab).
 */

const DEFAULT_BASE = 'https://node.travisgilbert.me';

function resolveBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_REFLEX_NODE_DETAIL_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv.replace(/\/+$/, '');
  }
  return DEFAULT_BASE;
}

export function nodeDetailUrl(pk: string | number): string {
  const base = resolveBase();
  return `${base}/n/${pk}`;
}

export function openNodeDetail(pk: string | number): void {
  if (typeof window === 'undefined') return;
  window.open(nodeDetailUrl(pk), '_blank', 'noopener,noreferrer');
}
