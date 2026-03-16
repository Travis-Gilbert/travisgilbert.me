/**
 * GET /api/scrape?url=<encoded_url>
 *
 * Proxy to Firecrawl /v1/scrape. Returns a trimmed payload
 * suitable for displaying a preview in the CaptureButton and
 * for storing as the Object body on capture.
 *
 * Only called client-side from CaptureButton, never server-rendered.
 * Requires FIRECRAWL_API_KEY in the environment.
 */

import { NextRequest, NextResponse } from 'next/server';

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1';
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY ?? '';
const SCRAPE_TIMEOUT = 15_000;

export interface ScrapeResult {
  url: string;
  title: string;
  description: string;
  markdown: string;
  domain: string;
  favicon: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function faviconUrl(url: string): string {
  try {
    const { origin } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
  } catch {
    return '';
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  if (!FIRECRAWL_API_KEY) {
    return NextResponse.json(
      { error: 'Firecrawl not configured' },
      { status: 503 },
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT);

    const firecrawlRes = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!firecrawlRes.ok) {
      const text = await firecrawlRes.text().catch(() => '');
      console.error('[scrape] Firecrawl error', firecrawlRes.status, text.slice(0, 200));
      return NextResponse.json(
        { error: `Firecrawl returned ${firecrawlRes.status}` },
        { status: 502 },
      );
    }

    const data = await firecrawlRes.json();
    const meta = data?.data?.metadata ?? {};
    const markdown: string = data?.data?.markdown ?? '';

    const result: ScrapeResult = {
      url,
      title: meta.title ?? meta.ogTitle ?? '',
      description: meta.description ?? meta.ogDescription ?? '',
      // Cap body at 20k chars to keep the payload reasonable
      markdown: markdown.slice(0, 20_000),
      domain: extractDomain(url),
      favicon: faviconUrl(url),
    };

    return NextResponse.json(result, {
      headers: {
        // Cache scrape results for 5 minutes in the browser
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Scrape timed out' }, { status: 504 });
    }
    console.error('[scrape] Unexpected error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
