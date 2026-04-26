// Classifies composer input as URL, YouTube URL, file, or plain text.
// Per ADR 0002 the YouTube branch must be detected BEFORE the generic
// URL branch so the dispatcher routes to youtube-transcript-api.

export type ComposerInputKind = 'url' | 'youtube' | 'file' | 'text';

export interface ClassifiedComposerInput {
  kind: ComposerInputKind;
  text: string;
  files: File[];
}

const URL_RE = /^(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)$/i;
const YOUTUBE_HOST_RE = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\b/i;

export function classifyComposerInput(
  raw: string,
  attachedFiles?: File[] | FileList | null,
): ClassifiedComposerInput {
  const files = toFileArray(attachedFiles);
  const text = raw.trim();

  if (files.length > 0) {
    return { kind: 'file', text, files };
  }

  if (text && YOUTUBE_HOST_RE.test(text)) {
    return { kind: 'youtube', text: normalizeUrl(text), files: [] };
  }

  if (text && URL_RE.test(text)) {
    return { kind: 'url', text: normalizeUrl(text), files: [] };
  }

  return { kind: 'text', text, files: [] };
}

export function isLikelyUrl(value: string): boolean {
  return URL_RE.test(value.trim());
}

function toFileArray(input: File[] | FileList | null | undefined): File[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  const out: File[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const f = input.item(i);
    if (f) out.push(f);
  }
  return out;
}

function normalizeUrl(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  return `https://${value}`;
}
