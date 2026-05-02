import { NextResponse } from 'next/server';

const MAX_RESPONSE_CHARS = 400000;
const REQUEST_TIMEOUT_MS = 10000;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
  }

  const url = typeof payload === 'object' && payload !== null && 'url' in payload
    ? String((payload as { url?: unknown }).url ?? '').trim()
    : '';

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Enter a valid URL.' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Only HTTP and HTTPS URLs can be analyzed.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(parsed, {
      headers: {
        Accept: 'text/html,text/plain;q=0.9,*/*;q=0.2',
        'User-Agent': 'travisgilbert-act-lab/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json({ error: `The URL returned HTTP ${response.status}.` }, { status: 502 });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return NextResponse.json({ error: 'That URL did not return readable text or HTML.' }, { status: 415 });
    }

    const raw = (await response.text()).slice(0, MAX_RESPONSE_CHARS);
    const title = extractTitle(raw) || parsed.hostname;
    const text = contentType.includes('text/html') ? extractTextFromHtml(raw) : raw;
    const normalized = text.replace(/\s+/g, ' ').trim();

    if (normalized.split(/\s+/).filter(Boolean).length < 20) {
      return NextResponse.json({ error: 'The URL did not contain enough readable text.' }, { status: 422 });
    }

    return NextResponse.json({
      title,
      url: parsed.toString(),
      text: normalized.slice(0, 30000),
    });
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'The URL took too long to respond.'
      : 'The URL could not be fetched.';
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : '';
}

function extractTextFromHtml(html: string) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/(p|div|section|article|li|h[1-6]|blockquote)>/gi, '$&\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(cleaned);
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
