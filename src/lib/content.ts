import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';

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
  /** Optional hero/card image path */
  image: z.string().optional(),
  /** Handwritten margin annotations keyed to paragraph index */
  annotations: z.array(z.object({
    paragraph: z.number(),
    text: z.string(),
  })).default([]),
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
  /** Whether this note is featured on the homepage */
  featured: z.boolean().default(false),
});

export const shelfSchema = z.object({
  title: z.string(),
  creator: z.string(),
  type: z.enum(['book', 'video', 'podcast', 'article', 'tool', 'album', 'other']),
  annotation: z.string(),
  url: z.string().url().optional(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
});

export const toolkitSchema = z.object({
  title: z.string(),
  category: z.enum(['production', 'tools', 'philosophy', 'automation']),
  order: z.number().default(0),
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
