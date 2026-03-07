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
  tags?: string[];
}

export interface PositionedConnection {
  connection: Connection;
  paragraphIndex: number;
  mentionFound: boolean;
  /** Author's research note for this specific connection (from essay frontmatter) */
  researchNote?: string;
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
    // Skip self-references (an essay should not connect to itself)
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
      tags: match.data.tags,
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
      tags: note.data.tags,
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
      tags: entry.data.tags,
    });
  }

  return results;
}

// ─────────────────────────────────────────────────
// Positioning
// ─────────────────────────────────────────────────

/**
 * Find the first paragraph that mentions the connection by title or slug words.
 *
 * Tries three strategies in order:
 * 1. Full title match (e.g., "The Parking Lot Problem: How Minimum...")
 * 2. Slug words match (e.g., "parking lot problem" from "the-parking-lot-problem")
 * 3. Returns null if nothing matches (caller provides a fallback)
 */
export function findMentionIndex(
  connection: Connection,
  html: string,
): number | null {
  const segments = html.split('</p>');
  const paragraphs = segments.slice(0, -1).map((seg) =>
    seg.replace(/<[^>]*>/g, '').toLowerCase()
  );

  // Strategy 1: full title
  const titleNeedle = connection.title.toLowerCase();
  for (let i = 0; i < paragraphs.length; i++) {
    if (paragraphs[i].includes(titleNeedle)) return i + 1;
  }

  // Strategy 2: slug words (strip common articles, join with spaces)
  const slugWords = connection.slug
    .split('-')
    .filter((w) => !['the', 'a', 'an', 'of', 'in', 'on', 'and', 'for', 'to'].includes(w))
    .join(' ');

  if (slugWords.length >= 4) {
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].includes(slugWords)) return i + 1;
    }
  }

  return null;
}

/** Default paragraph index when no mention is found in the text */
const FALLBACK_PARAGRAPH = 1;

export function positionConnections(
  connections: Connection[],
  html: string,
  connectionNotes?: { slug: string; note: string }[],
): PositionedConnection[] {
  const noteMap = new Map(
    (connectionNotes ?? []).map((n) => [n.slug, n.note]),
  );

  return connections.map((connection) => {
    const rawIndex = findMentionIndex(connection, html);
    return {
      connection,
      paragraphIndex: rawIndex ?? FALLBACK_PARAGRAPH,
      mentionFound: rawIndex !== null,
      researchNote: noteMap.get(connection.slug),
    };
  });
}

// ─────────────────────────────────────────────────
// Thread pairs (for listing page thread lines)
// ─────────────────────────────────────────────────

export interface ThreadPair {
  fromSlug: string;
  toSlug: string;
  type: ConnectionType;
  color: string;
  weight: ConnectionWeight;
}

/**
 * Compute unique thread pairs across all content for listing page arcs.
 * Deduplicates bidirectional relationships (A→B and B→A become one pair).
 * Limited to `maxPairs` to prevent visual noise.
 */
export function computeThreadPairs(
  content: AllContent,
  maxPairs = 8,
): ThreadPair[] {
  const seen = new Set<string>();
  const pairs: ThreadPair[] = [];

  // Essay related (bidirectional)
  for (const essay of content.essays) {
    if (essay.data.draft) continue;
    for (const relSlug of essay.data.related) {
      if (relSlug === essay.slug) continue;
      const target = content.essays.find((e) => e.slug === relSlug && !e.data.draft);
      if (!target) continue;

      const key = [essay.slug, relSlug].sort().join('::');
      if (seen.has(key)) continue;
      seen.add(key);

      pairs.push({
        fromSlug: essay.slug,
        toSlug: relSlug,
        type: 'essay',
        color: TYPE_COLOR.essay,
        weight: TYPE_WEIGHT.essay,
      });
    }
  }

  // Field note connectedTo (unidirectional: note → essay)
  for (const note of content.fieldNotes) {
    if (note.data.draft || !note.data.connectedTo) continue;
    const target = content.essays.find(
      (e) => e.slug === note.data.connectedTo && !e.data.draft,
    );
    if (!target) continue;

    const key = [note.slug, note.data.connectedTo].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);

    pairs.push({
      fromSlug: note.slug,
      toSlug: note.data.connectedTo,
      type: 'field-note',
      color: TYPE_COLOR['field-note'],
      weight: TYPE_WEIGHT['field-note'],
    });
  }

  // Shelf connectedEssay (unidirectional: shelf → essay)
  for (const entry of content.shelf) {
    if (!entry.data.connectedEssay) continue;
    const target = content.essays.find(
      (e) => e.slug === entry.data.connectedEssay && !e.data.draft,
    );
    if (!target) continue;

    const key = [entry.slug, entry.data.connectedEssay].sort().join('::');
    if (seen.has(key)) continue;
    seen.add(key);

    pairs.push({
      fromSlug: entry.slug,
      toSlug: entry.data.connectedEssay,
      type: 'shelf',
      color: TYPE_COLOR.shelf,
      weight: TYPE_WEIGHT.shelf,
    });
  }

  // Sort by weight (heavy first) and limit
  const WEIGHT_SORT: Record<string, number> = { heavy: 0, medium: 1, light: 2 };
  pairs.sort((a, b) => (WEIGHT_SORT[a.weight] ?? 2) - (WEIGHT_SORT[b.weight] ?? 2));

  return pairs.slice(0, maxPairs);
}

/**
 * Compute connections from a field note's perspective.
 * Returns the parent essay (if connectedTo) plus tag-matched essays.
 */
export function computeFieldNoteConnections(
  note: ContentEntry<FieldNote>,
  content: AllContent,
): Connection[] {
  const results: Connection[] = [];
  const seen = new Set<string>();

  // Parent essay via connectedTo
  if (note.data.connectedTo) {
    const parent = content.essays.find(
      (e) => e.slug === note.data.connectedTo && !e.data.draft,
    );
    if (parent) {
      seen.add(parent.slug);
      results.push({
        id: `essay-${parent.slug}`,
        type: 'essay',
        slug: parent.slug,
        title: parent.data.title,
        summary: parent.data.summary,
        color: TYPE_COLOR.essay,
        weight: 'heavy',
        date: parent.data.date.toISOString(),
        tags: parent.data.tags,
      });
    }
  }

  // Tag-matched essays (excluding parent)
  if (note.data.tags.length > 0) {
    const noteTags = new Set(note.data.tags);
    for (const essay of content.essays) {
      if (essay.data.draft || seen.has(essay.slug)) continue;
      if (essay.data.tags.some((t) => noteTags.has(t))) {
        results.push({
          id: `essay-${essay.slug}`,
          type: 'essay',
          slug: essay.slug,
          title: essay.data.title,
          summary: essay.data.summary,
          color: TYPE_COLOR.essay,
          weight: 'light',
          date: essay.data.date.toISOString(),
          tags: essay.data.tags,
        });
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────
// Navigation Suggestions (Feature: Where To Next)
// ─────────────────────────────────────────────────

export interface NavigationSuggestion {
  connection: Connection;
  rationale: string;
  relevanceScore: number;
  curveStyle: 'heavy' | 'medium' | 'light';
}

const RATIONALE_TEMPLATES: Record<string, (conn: Connection, sharedTag?: string) => string> = {
  essay: (conn, tag) =>
    tag
      ? `Explores a related question about ${tag}`
      : 'Part of the same thread of inquiry',
  'field-note': () => 'A field observation connected to this essay',
  shelf: () => 'A source that shaped this investigation',
};

const WEIGHT_BASE_SCORE: Record<string, number> = {
  heavy: 0.8,
  medium: 0.6,
  light: 0.4,
};

/**
 * Generate ranked navigation suggestions from computed connections.
 *
 * Picks the top N connections by relevance score, each with a
 * human-readable rationale string for display in the WhereToNext panel.
 */
export function generateNavigationSuggestions(
  connections: Connection[],
  currentTags: string[],
  maxSuggestions = 4,
): NavigationSuggestion[] {
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

  return connections
    .map((conn) => {
      let score = WEIGHT_BASE_SCORE[conn.weight] ?? 0.4;

      // Recency bonus
      if (conn.date && now - new Date(conn.date).getTime() < NINETY_DAYS) {
        score += 0.1;
      }

      // Tag overlap bonus
      const connTags = conn.tags ?? [];
      const shared = currentTags.filter((t) => connTags.includes(t));
      score += Math.min(shared.length * 0.05, 0.15);

      const templateFn = RATIONALE_TEMPLATES[conn.type] ?? (() => 'Related content');
      const rationale = templateFn(conn, shared[0]);

      return {
        connection: conn,
        rationale,
        relevanceScore: score,
        curveStyle: conn.weight,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxSuggestions);
}
