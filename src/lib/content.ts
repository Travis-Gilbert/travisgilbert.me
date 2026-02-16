import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkHtml from 'remark-html';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';

// ─────────────────────────────────────────────────
// Zod Schemas — ported verbatim from content.config.ts
// ─────────────────────────────────────────────────

export const investigationSchema = z.object({
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
});

export const fieldNoteSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  excerpt: z.string().max(300).optional(),
  draft: z.boolean().default(false),
  callout: z.string().optional(),
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
  urls: z.array(z.object({
    label: z.string(),
    url: z.string().url(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  order: z.number().default(0),
});

// ─────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────

export type Investigation = z.infer<typeof investigationSchema>;
export type FieldNote = z.infer<typeof fieldNoteSchema>;
export type ShelfEntry = z.infer<typeof shelfSchema>;
export type ToolkitEntry = z.infer<typeof toolkitSchema>;
export type Project = z.infer<typeof projectSchema>;

// ─────────────────────────────────────────────────
// Content loading
// ─────────────────────────────────────────────────

type CollectionName = 'investigations' | 'field-notes' | 'projects' | 'shelf' | 'toolkit';

const schemaMap: Record<CollectionName, z.ZodSchema> = {
  investigations: investigationSchema,
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
