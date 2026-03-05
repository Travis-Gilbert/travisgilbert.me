/**
 * Deterministic mock data for Studio views.
 *
 * Produces ~20 content items across 6 types with realistic
 * titles, word counts, stages, and timeline entries. Uses
 * djb2 + LCG PRNG (same pattern as CommonPlace and HeroAccents)
 * so builds are stable and SSG safe.
 *
 * When Django DRF endpoints are ready, this file is replaced
 * by fetch calls in studio-api.ts.
 */

import { CONTENT_TYPES, STAGES } from '@/lib/studio';
import type {
  StudioContentItem,
  StudioTimelineEntry,
  StudioDashboardStats,
} from '@/lib/studio';

/* ─────────────────────────────────────────────────
   Deterministic PRNG (djb2 + LCG)
   ───────────────────────────────────────────────── */

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function createRng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ─────────────────────────────────────────────────
   Title and excerpt pools per content type
   ───────────────────────────────────────────────── */

const TITLES: Record<string, string[]> = {
  essay: [
    'On Pattern Languages in Digital Spaces',
    'The Studio and the Factory',
    'How Buildings Learn: Notes for Software',
    'Pace Layering and Content Strategy',
    'Sidewalks as Negotiated Space',
    'What Makes a Living Document',
    'The Gap Between Capturing and Understanding',
  ],
  'field-note': [
    'Observation: Wayfinding at Eastern Market',
    'The feel of handwritten margins',
    'Tools that invite slowness',
    'Morning coffee shop as third place',
    'Noticing desire paths on campus',
    'A conversation about repair culture',
  ],
  shelf: [
    'How Buildings Learn (Stewart Brand)',
    'A Pattern Language (Christopher Alexander)',
    'The Death and Life of Great American Cities',
    'Seeing Like a State (James C. Scott)',
    'Thinking in Systems (Donella Meadows)',
    'The Timeless Way of Building',
  ],
  video: [
    'Walking Tour: Detroit Eastern Market',
    'Studio Session: Typography Deep Dive',
    'Conversation: Design for Repair',
    'Process: Building a Knowledge Graph',
  ],
  project: [
    'Creative Workbench',
    'CommonPlace Knowledge Engine',
    'Research API',
    'Paper Trail Explorer',
  ],
  toolkit: [
    'Rough.js Visual Language',
    'Content Pipeline System',
    'Connection Engine',
    'Django Studio Architecture',
  ],
};

const EXCERPTS: Record<string, string[]> = {
  essay: [
    'Alexander wrote about pattern languages as shared vocabularies for design. How does that translate to the tools we build for thinking?',
    'Factories optimize for output. Studios optimize for process. The distinction matters when building creative tools.',
    'Brand shows how buildings adapt over time through shearing layers. Software has its own version of this temporal hierarchy.',
    'Different parts of a system change at different rates. This insight from Brand reshapes how I think about content.',
    'The negotiations that happen on a sidewalk are invisible protocols. Design encodes social agreements.',
  ],
  'field-note': [
    'The signs at Eastern Market have a particular typographic voice. Hand-lettered, functional, evolving over decades.',
    'There is something different about writing in margins by hand vs typing an annotation. The speed changes the thought.',
    'Why do some tools feel like they want you to be careful? The weight of a fountain pen vs a ballpoint.',
    'Third places need just enough friction to make you stay but not so much that you leave.',
  ],
  shelf: [
    'The foundational text on how buildings adapt and learn from their occupants over decades.',
    'Alexander and colleagues catalog 253 patterns for towns, buildings, and construction.',
    'Jacobs dismantles modernist planning by observing how cities actually work at street level.',
    'How large-scale planning schemes fail by prioritizing legibility over local knowledge.',
  ],
  video: [
    'A walking tour through the market halls, vendor stalls, and murals of Detroit Eastern Market.',
    'A deep dive into the typographic choices behind the creative workbench redesign.',
    'A conversation about repair culture, right to repair, and designing for longevity.',
  ],
  project: [
    'Personal creative workbench: a living record of work, interests, and thinking.',
    'Knowledge graph with spaCy NER, typed objects, and explained edges.',
    'Source tracking, backlinks, Webmention receiver, and research threads.',
  ],
  toolkit: [
    'Hand-drawn SVG elements using rough.js for a studio-journal aesthetic.',
    'Markdown to HTML pipeline with Zod frontmatter validation and remark processing.',
    'spaCy NER engine that creates typed edges between knowledge objects.',
  ],
};

const TAGS_POOL = [
  'design', 'architecture', 'urbanism', 'pattern-language', 'systems',
  'tools', 'making', 'repair', 'infrastructure', 'typography',
  'research', 'observation', 'community', 'technology', 'craft',
];

const TIMELINE_ACTIONS = [
  'created', 'edited', 'advanced to research', 'advanced to drafting',
  'advanced to revising', 'advanced to production', 'published',
  'added tags', 'updated excerpt', 'word count milestone',
];

/* ─────────────────────────────────────────────────
   Generator
   ───────────────────────────────────────────────── */

const MOCK_SEED = 'studio-mock-2026';

let _cachedItems: StudioContentItem[] | null = null;
let _cachedTimeline: StudioTimelineEntry[] | null = null;

/**
 * Generate (or return cached) mock content items.
 * Deterministic: same output every call and every build.
 */
export function getMockContentItems(): StudioContentItem[] {
  if (_cachedItems) return _cachedItems;
  generate();
  return _cachedItems!;
}

export function getMockTimeline(): StudioTimelineEntry[] {
  if (_cachedTimeline) return _cachedTimeline;
  generate();
  return _cachedTimeline!;
}

export function getMockDashboardStats(): StudioDashboardStats {
  const items = getMockContentItems();
  const timeline = getMockTimeline();

  const byStage: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalWords = 0;

  for (const item of items) {
    byStage[item.stage] = (byStage[item.stage] ?? 0) + 1;
    byType[item.contentType] = (byType[item.contentType] ?? 0) + 1;
    totalWords += item.wordCount;
  }

  return {
    totalPieces: items.length,
    totalWords,
    byStage,
    byType,
    recentActivity: timeline.slice(0, 8),
  };
}

function generate(): void {
  const rng = createRng(hashString(MOCK_SEED));
  const now = new Date('2026-03-04T14:00:00Z').getTime();
  const DAY = 86400000;

  const items: StudioContentItem[] = [];
  const timeline: StudioTimelineEntry[] = [];

  for (const contentType of CONTENT_TYPES) {
    const titles = TITLES[contentType.slug] ?? ['Untitled'];
    const excerpts = EXCERPTS[contentType.slug] ?? [''];
    const count = Math.floor(rng() * 2) + 2; // 2 to 3 per type

    for (let i = 0; i < count && i < titles.length; i++) {
      const title = titles[i];
      const id = `mock-${contentType.slug}-${i}`;
      const slug = slugify(title);

      /* Spread creation dates over 45 days */
      const daysAgo = rng() * 45;
      const createdAt = new Date(now - daysAgo * DAY).toISOString();

      /* Updated more recently than created */
      const updatedDaysAgo = rng() * Math.min(daysAgo, 7);
      const updatedAt = new Date(now - updatedDaysAgo * DAY).toISOString();

      /* Pick a stage weighted toward the middle */
      const stageIdx = Math.min(
        Math.floor(rng() * STAGES.length),
        STAGES.length - 1,
      );
      const stage = STAGES[stageIdx].slug;

      const publishedAt =
        stage === 'published'
          ? new Date(now - rng() * 10 * DAY).toISOString()
          : null;

      /* Word count: essays longer, field notes shorter */
      let wordCount: number;
      if (contentType.slug === 'essay') {
        wordCount = Math.floor(rng() * 4000) + 800;
      } else if (contentType.slug === 'field-note') {
        wordCount = Math.floor(rng() * 600) + 100;
      } else if (contentType.slug === 'shelf') {
        wordCount = Math.floor(rng() * 400) + 50;
      } else {
        wordCount = Math.floor(rng() * 1200) + 200;
      }

      /* Pick 2 to 4 tags */
      const tagCount = Math.floor(rng() * 3) + 2;
      const tags: string[] = [];
      for (let t = 0; t < tagCount; t++) {
        const tag = pick(rng, TAGS_POOL);
        if (!tags.includes(tag)) tags.push(tag);
      }

      const excerpt = excerpts[i % excerpts.length] ?? '';

      items.push({
        id,
        title,
        slug,
        contentType: contentType.slug,
        stage,
        body: `# ${title}\n\n${excerpt}\n\n[Mock content body for development.]`,
        excerpt,
        wordCount,
        tags,
        createdAt,
        updatedAt,
        publishedAt,
      });

      /* Generate 1 to 3 timeline entries per item */
      const entryCount = Math.floor(rng() * 3) + 1;
      for (let e = 0; e < entryCount; e++) {
        const action = pick(rng, TIMELINE_ACTIONS);
        const entryDaysAgo = rng() * daysAgo;
        timeline.push({
          id: `tl-${id}-${e}`,
          contentId: id,
          contentTitle: title,
          contentType: contentType.slug,
          action,
          detail: `${action} on "${title}"`,
          occurredAt: new Date(now - entryDaysAgo * DAY).toISOString(),
        });
      }
    }
  }

  /* Sort items by updatedAt descending (most recently edited first) */
  items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  /* Sort timeline by occurredAt descending (newest first) */
  timeline.sort(
    (a, b) =>
      new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  _cachedItems = items;
  _cachedTimeline = timeline;
}

/* ─────────────────────────────────────────────────
   Grouping helpers
   ───────────────────────────────────────────────── */

export interface TimelineDateGroup {
  dateLabel: string;
  dateKey: string;
  entries: StudioTimelineEntry[];
}

/**
 * Group timeline entries by date for display.
 * Returns groups sorted newest first with relative labels.
 */
export function groupTimelineByDate(
  entries: StudioTimelineEntry[],
): TimelineDateGroup[] {
  const now = new Date('2026-03-04T14:00:00Z');
  const todayStr = toDateKey(now);
  const yesterdayStr = toDateKey(new Date(now.getTime() - 86400000));

  const groups = new Map<string, StudioTimelineEntry[]>();

  for (const entry of entries) {
    const key = toDateKey(new Date(entry.occurredAt));
    const existing = groups.get(key);
    if (existing) existing.push(entry);
    else groups.set(key, [entry]);
  }

  const result: TimelineDateGroup[] = [];
  for (const [key, groupEntries] of groups) {
    let dateLabel: string;
    if (key === todayStr) dateLabel = 'Today';
    else if (key === yesterdayStr) dateLabel = 'Yesterday';
    else dateLabel = formatDateLabel(key);

    result.push({ dateLabel, dateKey: key, entries: groupEntries });
  }

  result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  return result;
}

/** Filter items by content type */
export function getItemsByType(contentType: string): StudioContentItem[] {
  return getMockContentItems().filter((i) => i.contentType === contentType);
}

/** Get the most recently edited item (for ContinueCard) */
export function getMostRecentItem(): StudioContentItem | null {
  const items = getMockContentItems();
  return items.length > 0 ? items[0] : null;
}

/** Get items at a specific stage */
export function getItemsByStage(stage: string): StudioContentItem[] {
  return getMockContentItems().filter((i) => i.stage === stage);
}

/** Find a single item by content type + slug */
export function getItemBySlug(
  contentType: string,
  slug: string,
): StudioContentItem | null {
  return (
    getMockContentItems().find(
      (i) => i.contentType === contentType && i.slug === slug,
    ) ?? null
  );
}

/* ─────────────────────────────────────────────────
   Internal helpers
   ───────────────────────────────────────────────── */

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}
