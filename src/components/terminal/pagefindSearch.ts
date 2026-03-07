'use client';

/**
 * Thin wrapper around Pagefind's client-side API.
 * Loads the index on first search, caches the instance.
 */

interface PagefindResult {
  id: string;
  url: string;
  excerpt: string;
  meta: {
    title?: string;
    image?: string;
  };
  filters: {
    type?: string[];
  };
  sub_results?: PagefindSubResult[];
}

interface PagefindSubResult {
  title: string;
  url: string;
  excerpt: string;
}

interface PagefindResponse {
  results: { id: string; data: () => Promise<PagefindResult> }[];
  totalFilters: Record<string, Record<string, number>>;
}

let pagefindInstance: {
  search: (query: string, options?: Record<string, unknown>) => Promise<PagefindResponse>;
} | null = null;

async function loadPagefind() {
  if (pagefindInstance) return pagefindInstance;
  // Pagefind injects itself at /pagefind/pagefind.js during build
  // @ts-expect-error dynamic import of build-time generated module
  const pf = await import(/* webpackIgnore: true */ '/pagefind/pagefind.js');
  await pf.options({ excerptLength: 120 });
  pagefindInstance = pf;
  return pf;
}

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  excerpt: string;
  contentType: string;
}

export async function search(query: string, maxResults = 10): Promise<SearchResult[]> {
  const pf = await loadPagefind();
  const response = await pf.search(query);

  const results: SearchResult[] = [];
  const limit = Math.min(response.results.length, maxResults);

  for (let i = 0; i < limit; i++) {
    const data = await response.results[i].data();
    // Strip any HTML tags from excerpt for safe text rendering
    const plainExcerpt = data.excerpt.replace(/<[^>]*>/g, '');
    results.push({
      id: data.id,
      url: data.url,
      title: data.meta.title ?? 'Untitled',
      excerpt: plainExcerpt,
      contentType: data.filters.type?.[0] ?? 'page',
    });
  }

  return results;
}
