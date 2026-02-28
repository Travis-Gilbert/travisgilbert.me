import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';
import type { PositionedConnection } from './connectionEngine';

// ─────────────────────────────────────────────────
// Zod Schemas
// ─────────────────────────────────────────────────

export const essaySchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  summary: z.string().max(200),
  youtubeId: z.string(),
  thumbnail: z.string().optional(),
  tags: z.array(z.string()).default([]),
  sources: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
  })).default([]),
  related: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  callout: z.string().optional(),
  /** Array of callouts for featured cards (pivoted leader-line treatment) */
  callouts: z.array(z.string()).optional(),
  /** Essay production stage */
  stage: z.enum(['research', 'drafting', 'production', 'published']).optional(),
  /** ISO date when stage last advanced (stamp animation fires if within 24h) */
  lastAdvanced: z.coerce.date().optional(),
  /** Optional hero/card image path */
  image: z.string().optional(),
  /** Handwritten margin annotations keyed to paragraph index */
  annotations: z.array(z.object({
    paragraph: z.number(),
    text: z.string(),
  })).default([]),
  /** Per-instance visual overrides (heroStyle, overlay, accent, etc.) */
  composition: z.record(z.unknown()).optional(),
  /** Deep saturated background color for homepage hero when this essay is featured */
  heroColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Path to composed hero artifact image in /public/hero/ */
  heroImage: z.string().optional(),
  /** Central claim or argument of the essay (displayed in hero) */
  thesis: z.string().optional(),
  /** Number of sources consulted (displayed as badge in hero) */
  sourceCount: z.number().optional(),
  /** ISO date string for when research began */
  researchStarted: z.string().optional(),
  /** Number of substantive revisions */
  revisionCount: z.number().optional(),
  /** Bullet-point research process notes */
  researchNotes: z.array(z.string()).optional(),
  /** Human-readable summary of source types (e.g., "3 academic papers, 2 interviews") */
  sourceSummary: z.string().optional(),
  /** Content types this essay connects to (e.g., ["field-note", "project"]) */
  connectedTypes: z.array(z.string()).optional(),
  /** Notes on how this essay relates to other content */
  connectionNotes: z.string().optional(),
});

export const fieldNoteSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  excerpt: z.string().max(300).optional(),
  draft: z.boolean().default(false),
  callout: z.string().optional(),
  /** Array of callouts for featured cards */
  callouts: z.array(z.string()).optional(),
  /** Note development status */
  status: z.enum(['observation', 'developing', 'connected']).optional(),
  /** ISO date when status last advanced (stamp animation fires if within 24h) */
  lastAdvanced: z.coerce.date().optional(),
  /** Whether this note is featured on the homepage */
  featured: z.boolean().default(false),
  /** Slug of the parent essay this note connects to */
  connectedTo: z.string().optional(),
  /** Per-instance visual overrides */
  composition: z.record(z.unknown()).optional(),
});

export const shelfSchema = z.object({
  title: z.string(),
  creator: z.string(),
  type: z.enum(['book', 'video', 'podcast', 'article', 'tool', 'album', 'other']),
  annotation: z.string(),
  url: z.string().url().optional(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  /** Essay slug this source relates to */
  connectedEssay: z.string().optional(),
  /** Per-instance visual overrides */
  composition: z.record(z.unknown()).optional(),
});

export const toolkitSchema = z.object({
  title: z.string(),
  category: z.enum(['production', 'tools', 'philosophy', 'automation']),
  order: z.number().default(0),
  /** Per-instance visual overrides */
  composition: z.record(z.unknown()).optional(),
});

export const projectSchema = z.object({
  title: z.string(),
  role: z.string(),
  description: z.string().max(300),
  year: z.coerce.number(),
  date: z.coerce.date(),
  organization: z.string().optional(),
  urls: z.array(z.object({
    label: z.string(),
    url: z.string().url(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  order: z.number().default(0),
  callout: z.string().optional(),
  /** Per-instance visual overrides */
  composition: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────

export type Essay = z.infer<typeof essaySchema>;
export type FieldNote = z.infer<typeof fieldNoteSchema>;
export type ShelfEntry = z.infer<typeof shelfSchema>;
export type ToolkitEntry = z.infer<typeof toolkitSchema>;
export type Project = z.infer<typeof projectSchema>;

// ─────────────────────────────────────────────────
// Content loading
// ─────────────────────────────────────────────────

type CollectionName = 'essays' | 'field-notes' | 'projects' | 'shelf' | 'toolkit';

const schemaMap: Record<CollectionName, z.ZodSchema> = {
  essays: essaySchema,
  'field-notes': fieldNoteSchema,
  projects: projectSchema,
  shelf: shelfSchema,
  toolkit: toolkitSchema,
};

export interface ContentEntry<T> {
  slug: string;
  data: T;
  body: string;
}

export function getCollection<T>(name: CollectionName): ContentEntry<T>[] {
  const dir = path.join(process.cwd(), 'src', 'content', name);

  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const schema = schemaMap[name];

  return files.map(file => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    const { data, content } = matter(raw);
    const validated = schema.parse(data);
    return {
      slug: file.replace(/\.md$/, ''),
      data: validated as T,
      body: content,
    };
  });
}

export function getEntry<T>(name: CollectionName, slug: string): ContentEntry<T> | undefined {
  const dir = path.join(process.cwd(), 'src', 'content', name);
  const filePath = path.join(dir, `${slug}.md`);

  if (!fs.existsSync(filePath)) return undefined;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const schema = schemaMap[name];
  const validated = schema.parse(data);

  return {
    slug,
    data: validated as T,
    body: content,
  };
}

export async function renderMarkdown(body: string): Promise<string> {
  const result = await remark()
    .use(remarkGfm)
    .use(remarkHtml, { sanitize: false })
    .process(body);
  return result.toString();
}

// ─────────────────────────────────────────────────
// Reading Time
// ─────────────────────────────────────────────────

/**
 * Estimate reading time from raw markdown body text.
 * Uses 200 words per minute (average adult reading speed).
 * Returns at least 1 minute.
 */
export function estimateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ─────────────────────────────────────────────────
// Margin Annotation Injection
// ─────────────────────────────────────────────────

interface Annotation {
  paragraph: number;
  text: string;
}

/**
 * Escape a string for safe use inside an HTML attribute value.
 */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Inject margin annotation anchors into rendered HTML after the specified
 * paragraph positions. Annotations alternate between right and left sides.
 *
 * Counts closing </p> tags to identify paragraph boundaries. Each annotation
 * is a zero-height <span> with data attributes that CSS ::after pseudo-elements
 * read to render the handwritten note.
 *
 * No-op when the annotations array is empty.
 */
export function injectAnnotations(html: string, annotations: Annotation[]): string {
  if (annotations.length === 0) return html;

  // Build a map of paragraph index to annotation(s)
  const annotationMap = new Map<number, Annotation[]>();
  for (const ann of annotations) {
    const existing = annotationMap.get(ann.paragraph);
    if (existing) {
      existing.push(ann);
    } else {
      annotationMap.set(ann.paragraph, [ann]);
    }
  }

  let paragraphIndex = 0;
  let sideToggle = 0; // alternates 0 (right) and 1 (left)
  const closingTag = '</p>';

  return html.replace(/<\/p>/gi, (match) => {
    paragraphIndex++;
    const anns = annotationMap.get(paragraphIndex);
    if (!anns) return match;

    let injected = match;
    for (const ann of anns) {
      const side = sideToggle % 2 === 0 ? 'right' : 'left';
      sideToggle++;
      injected += `<span class="margin-annotation-anchor" data-annotation-text="${escapeAttr(ann.text)}" data-annotation-side="${side}"></span>`;
    }
    return injected;
  });
}

// ─────────────────────────────────────────────────
// Connection callouts (inline, build-time)
// ─────────────────────────────────────────────────

/** Map connection type to its URL prefix */
const TYPE_URL_PREFIX: Record<string, string> = {
  essay: '/essays',
  'field-note': '/field-notes',
  shelf: '/shelf',
};

/** Map connection type to its display label */
const TYPE_LABEL: Record<string, string> = {
  essay: 'Essay',
  'field-note': 'Field Note',
  shelf: 'Shelf',
};

/**
 * Inject inline connection callout blocks after paragraphs that mention
 * connected content. Only processes connections where `mentionFound` is true.
 *
 * Follows the same `</p>` counting pattern as `injectAnnotations()`.
 * Must be called AFTER `injectAnnotations()` to avoid shifting paragraph indices.
 */
export function injectConnectionCallouts(
  html: string,
  connections: PositionedConnection[],
): string {
  // Only process connections with a real mention
  const mentionConnections = connections.filter((c) => c.mentionFound);
  if (mentionConnections.length === 0) return html;

  // Build a map of paragraph index to connections (sorted by weight)
  const WEIGHT_ORDER: Record<string, number> = { heavy: 0, medium: 1, light: 2 };
  const byParagraph = new Map<number, PositionedConnection[]>();

  for (const pc of mentionConnections) {
    const group = byParagraph.get(pc.paragraphIndex) || [];
    group.push(pc);
    byParagraph.set(pc.paragraphIndex, group);
  }

  // Sort each group by weight (heavy first)
  for (const group of byParagraph.values()) {
    group.sort(
      (a, b) =>
        (WEIGHT_ORDER[a.connection.weight] ?? 2) -
        (WEIGHT_ORDER[b.connection.weight] ?? 2),
    );
  }

  let paragraphIndex = 0;

  return html.replace(/<\/p>/gi, (match) => {
    paragraphIndex++;
    const group = byParagraph.get(paragraphIndex);
    if (!group) return match;

    let injected = match;
    for (const pc of group) {
      const c = pc.connection;
      const href = `${TYPE_URL_PREFIX[c.type] ?? ''}/${c.slug}`;
      const label = TYPE_LABEL[c.type] ?? c.type;

      injected += `<aside class="connection-callout" data-connection-type="${c.type}" data-connection-color="${c.color}"><a href="${escapeAttr(href)}" class="connection-callout-link"><span class="connection-callout-type">${escapeAttr(label)}</span><span class="connection-callout-title">${escapeAttr(c.title)}</span></a></aside>`;
    }
    return injected;
  });
}

// ─────────────────────────────────────────────────
// Print Footnote Markers (screen-hidden, print-visible)
// ─────────────────────────────────────────────────

/**
 * Inject footnote markers after external links and append a footnote table.
 *
 * Scans for `<a href="https://...">` tags that point to external URLs.
 * Each gets a numbered `<sup class="fn-marker">` after the closing `</a>`.
 * A `<div class="fn-table">` with the numbered URL list is appended at the end.
 *
 * Both `.fn-marker` and `.fn-table` are `display: none` on screen (global.css).
 * The print stylesheet (print.css) reveals them so printed essays show
 * traditional footnote references instead of underlined blue links.
 *
 * Internal links (starting with `/`) and anchor-only links (`#`) are skipped.
 * Connection callout links are also skipped (inside `<aside class="connection-callout">`).
 *
 * No-op when no external links are found.
 */
export function injectFootnoteMarkers(html: string): string {
  const footnotes: { index: number; url: string }[] = [];
  let counter = 0;

  // Match <a> tags, but skip internal/anchor links and connection callout links
  const markedHtml = html.replace(
    /<a\s+href="([^"]*)"[^>]*>.*?<\/a>/gi,
    (match, href: string) => {
      if (
        href.startsWith('/') ||
        href.startsWith('#') ||
        match.includes('connection-callout-link')
      ) {
        return match;
      }

      counter++;
      footnotes.push({ index: counter, url: href });
      return `${match}<sup class="fn-marker" aria-hidden="true">[${counter}]</sup>`;
    },
  );

  if (footnotes.length === 0) return html;

  // Build the footnote table
  const rows = footnotes
    .map(
      (fn) =>
        `<div class="fn-row"><span class="fn-num">[${fn.index}]</span> <span class="fn-url">${escapeAttr(fn.url)}</span></div>`,
    )
    .join('\n');

  const table = `\n<div class="fn-table" aria-hidden="true">\n<div class="fn-table-title">Links</div>\n${rows}\n</div>`;

  return markedHtml + table;
}
