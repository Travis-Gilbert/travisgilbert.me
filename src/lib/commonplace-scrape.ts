/**
 * Client-side scrape helper.
 *
 * Calls the Next.js /api/scrape route which proxies Firecrawl.
 * Used by CaptureButton to show a URL preview and bake scraped
 * content into the capture payload before submitting.
 */

export interface ScrapePreview {
  title: string;
  description: string;
  markdown: string;
  domain: string;
  favicon: string;
}

export interface ScrapeState {
  status: 'idle' | 'loading' | 'success' | 'error';
  preview: ScrapePreview | null;
  error: string | null;
}

export async function scrapeUrl(url: string): Promise<ScrapePreview> {
  const res = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`, {
    method: 'GET',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Scrape failed (${res.status})`);
  }

  const data = await res.json();
  return {
    title: data.title ?? '',
    description: data.description ?? '',
    markdown: data.markdown ?? '',
    domain: data.domain ?? '',
    favicon: data.favicon ?? '',
  };
}
