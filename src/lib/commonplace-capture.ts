/**
 * CommonPlace capture logic: local-first object creation.
 *
 * Objects are created optimistically with a `local-` prefixed UUID.
 * They appear in the UI immediately. Once the Django API is wired
 * in a future session, the `syncCapture()` stub will POST to the
 * server and replace the local ID with a real one.
 *
 * URL detection regex, mock OG enrichment, and capture helpers
 * all live here to keep components thin.
 */

import type { CapturedObject, CaptureMethod, CaptureStatus } from './commonplace';
import { getObjectTypeIdentity } from './commonplace';

/* ─────────────────────────────────────────────────
   URL detection
   ───────────────────────────────────────────────── */

const URL_REGEX =
  /https?:\/\/(?:[-\w.])+(?::\d+)?(?:\/[-\w._~:/?#[\]@!$&'()*+,;=%]*)?/gi;

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

export function isUrl(text: string): boolean {
  const trimmed = text.trim();
  return URL_REGEX.test(trimmed) && extractUrls(trimmed).length > 0;
}

/** Extract a readable domain from a URL for initial title */
export function domainFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return url.slice(0, 40);
  }
}

/* ─────────────────────────────────────────────────
   Optimistic ID generation
   ───────────────────────────────────────────────── */

export function generateLocalId(): string {
  return `local-${crypto.randomUUID()}`;
}

/* ─────────────────────────────────────────────────
   Infer object type from capture content
   ───────────────────────────────────────────────── */

export function inferObjectType(text: string): string {
  const trimmed = text.trim();

  /* URLs default to 'source' */
  if (isUrl(trimmed)) return 'source';

  /* Text in quotes suggests a quotation */
  if (/^[""\u201C]/.test(trimmed) && /[""\u201D]$/.test(trimmed)) return 'quote';

  /* Very short text (under 20 chars) without punctuation: might be a person or place */
  if (trimmed.length < 20 && !/[.!?]/.test(trimmed)) {
    const words = trimmed.split(/\s+/);
    /* Two or three capitalized words: likely a person name */
    if (
      words.length >= 2 &&
      words.length <= 3 &&
      words.every((w) => /^[A-Z]/.test(w))
    ) {
      return 'person';
    }
  }

  /* Default to 'note' */
  return 'note';
}

/* ─────────────────────────────────────────────────
   Mock OG enrichment (simulated 1s delay)
   ───────────────────────────────────────────────── */

const MOCK_OG_TITLES: Record<string, string> = {
  'github.com': 'GitHub Repository',
  'youtube.com': 'YouTube Video',
  'twitter.com': 'Tweet',
  'x.com': 'Post on X',
  'nytimes.com': 'New York Times Article',
  'wikipedia.org': 'Wikipedia Entry',
  'medium.com': 'Medium Article',
  'arxiv.org': 'arXiv Paper',
  'substack.com': 'Substack Post',
};

export function mockEnrichUrl(url: string): Promise<string> {
  return new Promise((resolve) => {
    const domain = domainFromUrl(url);
    const ogTitle =
      Object.entries(MOCK_OG_TITLES).find(([key]) =>
        domain.includes(key)
      )?.[1] ?? `Link from ${domain}`;

    setTimeout(() => resolve(ogTitle), 800 + Math.random() * 400);
  });
}

/* ─────────────────────────────────────────────────
   Create a captured object (local-first)
   ───────────────────────────────────────────────── */

export function createCapturedObject(opts: {
  text: string;
  objectType?: string;
  captureMethod: CaptureMethod;
  sourceUrl?: string;
}): CapturedObject {
  const { text, captureMethod, sourceUrl } = opts;
  const trimmed = text.trim();
  const objectType = opts.objectType ?? inferObjectType(trimmed);

  /* Title: domain for URLs, first ~60 chars for text */
  let title = trimmed.slice(0, 60);
  if (sourceUrl || isUrl(trimmed)) {
    const url = sourceUrl ?? extractUrls(trimmed)[0] ?? trimmed;
    title = domainFromUrl(url);
  }

  return {
    id: generateLocalId(),
    title,
    body: trimmed,
    objectType,
    capturedAt: new Date().toISOString(),
    captureMethod,
    status: 'local',
    sourceUrl: sourceUrl ?? (isUrl(trimmed) ? extractUrls(trimmed)[0] : undefined),
  };
}

/* ─────────────────────────────────────────────────
   Sync stub (future: POST to Django API)
   ───────────────────────────────────────────────── */

export async function syncCapture(
  _object: CapturedObject
): Promise<{ ok: boolean; error?: string }> {
  /* In this session, objects stay local. Future sessions wire
     this to the Django research_api quickCapture endpoint. */
  return { ok: true };
}

/* ─────────────────────────────────────────────────
   File type inference for drag-and-drop
   ───────────────────────────────────────────────── */

export function inferTypeFromFile(file: File): string {
  const mime = file.type;
  if (mime.startsWith('image/')) return 'note';
  if (mime === 'application/pdf') return 'source';
  if (mime.includes('text/')) return 'note';
  return 'note';
}

export function inferTypeFromDrop(dataTransfer: DataTransfer): {
  type: 'url' | 'text' | 'file';
  content: string;
  file?: File;
} {
  /* Check for URLs first */
  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    return { type: 'url', content: uriList.split('\n')[0].trim() };
  }

  /* Check for plain text that might contain a URL */
  const text = dataTransfer.getData('text/plain');
  if (text && isUrl(text.trim())) {
    return { type: 'url', content: text.trim() };
  }

  /* Check for files */
  if (dataTransfer.files.length > 0) {
    const file = dataTransfer.files[0];
    return { type: 'file', content: file.name, file };
  }

  /* Default: plain text */
  return { type: 'text', content: text || '' };
}
