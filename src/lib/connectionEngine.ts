import type { ContentEntry, Essay, FieldNote, ShelfEntry } from './content';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export type ConnectionType = 'essay' | 'field-note' | 'shelf';

export type ConnectionWeight = 'heavy' | 'medium' | 'light';

export interface Connection {
  id: string;
  type: ConnectionType;
  slug: string;
  title: string;
  summary?: string;
  color: string;
  weight: ConnectionWeight;
  date: string;
}

export interface PositionedConnection {
  connection: Connection;
  paragraphIndex: number | null;
}

export interface AllContent {
  essays: ContentEntry<Essay>[];
  fieldNotes: ContentEntry<FieldNote>[];
  shelf: ContentEntry<ShelfEntry>[];
}

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

export const TYPE_COLOR: Record<ConnectionType, string> = {
  'essay': '#B45A2D',
  'field-note': '#2D5F6B',
  'shelf': '#C49A4A',
};

export const TYPE_WEIGHT: Record<ConnectionType, ConnectionWeight> = {
  'essay': 'heavy',
  'field-note': 'medium',
  'shelf': 'light',
};

export const WEIGHT_STROKE: Record<ConnectionWeight, number> = {
  'heavy': 1.8,
  'medium': 1.2,
  'light': 0.8,
};

// ─────────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────────

export function computeConnections(
  essay: ContentEntry<Essay>,
  content: AllContent,
): Connection[] {
  return [
    ...resolveRelatedEssays(essay, content.essays),
    ...resolveConnectedFieldNotes(essay, content.fieldNotes),
    ...resolveConnectedShelfEntries(essay, content.shelf),
  ];
}

function resolveRelatedEssays(
  essay: ContentEntry<Essay>,
  allEssays: ContentEntry<Essay>[],
): Connection[] {
  const relatedSlugs = essay.data.related;
  if (relatedSlugs.length === 0) return [];

  const results: Connection[] = [];

  for (const slug of relatedSlugs) {
    if (slug === essay.slug) continue;
    const match = allEssays.find((e) => e.slug === slug);
    if (!match) continue;
    if (match.data.draft) continue;

    results.push({
      id: `essay-${match.slug}`,
      type: 'essay',
      slug: match.slug,
      title: match.data.title,
      summary: match.data.summary,
      color: TYPE_COLOR.essay,
      weight: TYPE_WEIGHT.essay,
      date: match.data.date.toISOString(),
    });
  }

  return results;
}

function resolveConnectedFieldNotes(
  essay: ContentEntry<Essay>,
  allFieldNotes: ContentEntry<FieldNote>[],
): Connection[] {
  const results: Connection[] = [];

  for (const note of allFieldNotes) {
    if (note.data.draft) continue;
    if (note.data.connectedTo !== essay.slug) continue;

    results.push({
      id: `field-note-${note.slug}`,
      type: 'field-note',
      slug: note.slug,
      title: note.data.title,
      summary: note.data.excerpt,
      color: TYPE_COLOR['field-note'],
      weight: TYPE_WEIGHT['field-note'],
      date: note.data.date.toISOString(),
    });
  }

  return results;
}

function resolveConnectedShelfEntries(
  essay: ContentEntry<Essay>,
  allShelf: ContentEntry<ShelfEntry>[],
): Connection[] {
  const results: Connection[] = [];

  for (const entry of allShelf) {
    if (entry.data.connectedEssay !== essay.slug) continue;

    results.push({
      id: `shelf-${entry.slug}`,
      type: 'shelf',
      slug: entry.slug,
      title: entry.data.title,
      summary: entry.data.annotation,
      color: TYPE_COLOR.shelf,
      weight: TYPE_WEIGHT.shelf,
      date: entry.data.date.toISOString(),
    });
  }

  return results;
}
