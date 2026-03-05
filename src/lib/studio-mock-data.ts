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
  StudioTimelineConnection,
  StudioTimelineNote,
  StudioDashboardStats,
  StudioItemMetrics,
  StudioContentItemWithMetrics,
  StudioDashboardIntel,
  StudioTodayQueueItem,
  StudioPulseInsight,
  StudioDaySummary,
  WorkbenchPanelData,
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

  /* Enrich the most recently edited item with session context */
  if (items.length > 0) {
    const enrichRng = createRng(hashString('enrich-hero-2026'));
    items[0].nextMove = pick(enrichRng, NEXT_MOVE_TEMPLATES);
    items[0].lastSessionSummary = pick(enrichRng, SESSION_SUMMARY_TEMPLATES);
  }

  /* Add connections and notes to timeline entries */
  for (const entry of timeline) {
    const connRng = createRng(hashString('conn-' + entry.id));
    const connCount = Math.floor(connRng() * 3); // 0 to 2
    if (connCount > 0) {
      const connections: StudioTimelineConnection[] = [];
      const otherItems = items.filter((i) => i.id !== entry.contentId);
      for (let c = 0; c < connCount && c < otherItems.length; c++) {
        const target = otherItems[Math.floor(connRng() * otherItems.length)];
        if (!connections.find((cn) => cn.targetId === target.id)) {
          connections.push({
            targetId: target.id,
            targetTitle: target.title,
          });
        }
      }
      if (connections.length > 0) entry.connections = connections;
    }

    const notes = getMockTimelineNotes(entry.contentId);
    if (notes.length > 0) entry.notes = notes;
  }

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
   Item metrics: per-item intelligence computations
   ───────────────────────────────────────────────── */

const METRICS_SEED = 'studio-metrics-2026';
const NOW_MS = new Date('2026-03-04T14:00:00Z').getTime();
const DAY_MS = 86400000;

/**
 * Compute intelligence metrics for a single content item.
 * Uses a seeded PRNG per-item (hash of item id) so metrics
 * are deterministic but vary convincingly per item.
 */
export function computeItemMetrics(item: StudioContentItem): StudioItemMetrics {
  const rng = createRng(hashString(METRICS_SEED + item.id));

  const daysSinceLastTouched = Math.max(
    0,
    Math.round((NOW_MS - new Date(item.updatedAt).getTime()) / DAY_MS),
  );

  /* Stage age: how long in the current stage (simulated). Items
     created more recently have a shorter stage age. */
  const createdDaysAgo = Math.round(
    (NOW_MS - new Date(item.createdAt).getTime()) / DAY_MS,
  );
  const stageAgeDays = Math.max(
    1,
    Math.round(rng() * Math.min(createdDaysAgo, 30)),
  );

  /* Script completion is only meaningful for videos */
  const scriptCompletionPct =
    item.contentType === 'video'
      ? Math.round(rng() * 100)
      : null;

  /* Sources: research-stage items have more, others fewer */
  const sourceBase = item.stage === 'research' ? 5 : 1;
  const sourcesCollected = Math.floor(rng() * 8) + sourceBase;

  /* Linked notes: correlated with stage advancement */
  const stageObj = STAGES.find((s) => s.slug === item.stage);
  const stageOrder = stageObj?.order ?? 0;
  const linkedNotes = Math.floor(rng() * (stageOrder + 2));

  /* Hook strength: 1 to 5. Ideas with good titles get higher scores. */
  const hookStrength = Math.min(5, Math.max(1, Math.round(rng() * 5)));

  return {
    daysSinceLastTouched,
    stageAgeDays,
    scriptCompletionPct,
    sourcesCollected,
    linkedNotes,
    hookStrength,
  };
}

/**
 * Attach metrics to all mock items.
 */
function getItemsWithMetrics(): StudioContentItemWithMetrics[] {
  return getMockContentItems().map((item) => ({
    ...item,
    metrics: computeItemMetrics(item),
  }));
}

/**
 * Dashboard intelligence: categorizes items into 5 actionable sections.
 *
 * Each section has different inclusion criteria:
 *   nextSession: active drafts/revisions sorted by recency (top 3)
 *   stuckItems: stageAge > 14 days and not in idea stage
 *   closestToPublish: revising or production stage
 *   researchToConvert: research stage with decent source counts
 *   dormantIdeas: idea/research not touched in 30+ days with hookStrength >= 3
 */
export function getMockDashboardIntel(): StudioDashboardIntel {
  const all = getItemsWithMetrics();

  const nextSession = all
    .filter((i) => ['drafting', 'revising'].includes(i.stage))
    .sort((a, b) => a.metrics.daysSinceLastTouched - b.metrics.daysSinceLastTouched)
    .slice(0, 3);

  const stuckItems = all
    .filter(
      (i) => i.metrics.stageAgeDays > 14 && i.stage !== 'idea' && i.stage !== 'published',
    )
    .sort((a, b) => b.metrics.stageAgeDays - a.metrics.stageAgeDays);

  const closestToPublish = all
    .filter((i) => ['revising', 'production'].includes(i.stage))
    .sort((a, b) => {
      /* Production before revising */
      const stageOrder = (s: string) =>
        s === 'production' ? 1 : 0;
      return stageOrder(b.stage) - stageOrder(a.stage);
    });

  const researchToConvert = all
    .filter((i) => i.stage === 'research' && i.metrics.sourcesCollected >= 3)
    .sort((a, b) => b.metrics.sourcesCollected - a.metrics.sourcesCollected);

  const dormantIdeas = all
    .filter(
      (i) =>
        ['idea', 'research'].includes(i.stage) &&
        i.metrics.daysSinceLastTouched >= 30 &&
        i.metrics.hookStrength >= 3,
    )
    .sort((a, b) => b.metrics.hookStrength - a.metrics.hookStrength);

  return {
    nextSession,
    stuckItems,
    closestToPublish,
    researchToConvert,
    dormantIdeas,
  };
}

/**
 * Aggregated data for the collapsible workbench panel.
 */
export function getMockWorkbenchData(): WorkbenchPanelData {
  const items = getMockContentItems();
  const timeline = getMockTimeline();

  const pipelineBreakdown: Record<string, number> = {};
  let totalWords = 0;

  for (const item of items) {
    pipelineBreakdown[item.stage] = (pipelineBreakdown[item.stage] ?? 0) + 1;
    totalWords += item.wordCount;
  }

  const publishReadyThisWeek = items.filter(
    (i) => i.stage === 'production',
  ).length;

  const ideaBacklogCount = items.filter(
    (i) => i.stage === 'idea',
  ).length;

  return {
    pipelineBreakdown,
    publishReadyThisWeek,
    ideaBacklogCount,
    totalWords,
    recentActivity: timeline.slice(0, 5),
  };
}

/* ─────────────────────────────────────────────────
   Dashboard v2 generators
   ───────────────────────────────────────────────── */

const TASK_TEMPLATES: Record<string, string[]> = {
  drafting: [
    'Finish the opening section',
    'Expand the central argument',
    'Write the second half',
    'Fill in the example section',
  ],
  revising: [
    'Tighten the introduction',
    'Cut the digression in section 3',
    'Strengthen the closing paragraph',
    'Review the tone in the middle section',
  ],
  production: [
    'Add images and pull quotes',
    'Check all links and sources',
    'Write the meta description',
    'Format code blocks and callouts',
  ],
};

const NEXT_MOVE_TEMPLATES = [
  'Flesh out the connection between sections 2 and 3',
  'Add the Brand quote and tie it to the thesis',
  'Rewrite the opening with a concrete image',
  'Cut 200 words from the middle section',
  'Find a stronger ending that circles back',
];

const SESSION_SUMMARY_TEMPLATES = [
  'Restructured the argument flow and expanded the Brand section. Cut 150 words.',
  'Drafted two new paragraphs connecting the theory to practical examples.',
  'Rewrote the introduction with a walking tour anecdote. Added three sources.',
  'Cleaned up citations and reorganized the closing section.',
];

/**
 * Today's queue: top 3 active tasks across drafting/revising items.
 */
export function getMockTodayQueue(): StudioTodayQueueItem[] {
  const items = getMockContentItems();
  const rng = createRng(hashString('today-queue-2026'));

  return items
    .filter((i) => ['drafting', 'revising', 'production'].includes(i.stage))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 3)
    .map((item) => {
      const templates = TASK_TEMPLATES[item.stage] ?? TASK_TEMPLATES.drafting;
      const task = pick(rng, templates);
      return {
        id: `queue-${item.id}`,
        task,
        contentId: item.id,
        contentTitle: item.title,
        contentType: item.contentType,
        stage: item.stage,
      };
    });
}

/**
 * Studio pulse: 4 to 6 interpreted insights about the writing practice.
 */
export function getMockStudioPulse(): StudioPulseInsight[] {
  const all = getItemsWithMetrics();
  const insights: StudioPulseInsight[] = [];

  /* Momentum: items touched in the last 2 days */
  const recentCount = all.filter(
    (i) => i.metrics.daysSinceLastTouched <= 2,
  ).length;
  if (recentCount >= 2) {
    insights.push({
      type: 'momentum',
      message: `${recentCount} pieces touched in the last 2 days`,
      detail: 'Consistent daily writing builds compound progress.',
    });
  }

  /* Simmering: items in research with good source counts */
  const simmering = all.filter(
    (i) => i.stage === 'research' && i.metrics.sourcesCollected >= 4,
  );
  if (simmering.length > 0) {
    insights.push({
      type: 'simmering',
      message: `${simmering.length} piece${simmering.length > 1 ? 's' : ''} gathering rich source material`,
      detail: `"${simmering[0].title}" has ${simmering[0].metrics.sourcesCollected} sources.`,
    });
  }

  /* Quiet: items not touched in 7+ days */
  const quietItems = all.filter(
    (i) =>
      i.metrics.daysSinceLastTouched >= 7 &&
      !['published', 'idea'].includes(i.stage),
  );
  if (quietItems.length > 0) {
    insights.push({
      type: 'quiet',
      message: `${quietItems.length} active piece${quietItems.length > 1 ? 's' : ''} have gone quiet`,
      detail: `"${quietItems[0].title}" last touched ${quietItems[0].metrics.daysSinceLastTouched} days ago.`,
    });
  }

  /* Ready: items in production or late revising */
  const readyItems = all.filter(
    (i) => i.stage === 'production' || (i.stage === 'revising' && i.metrics.stageAgeDays >= 5),
  );
  if (readyItems.length > 0) {
    insights.push({
      type: 'ready',
      message: `${readyItems.length} piece${readyItems.length > 1 ? 's' : ''} approaching publication`,
      detail: `"${readyItems[0].title}" is in ${readyItems[0].stage}.`,
    });
  }

  /* Rich: items with many linked notes */
  const richItems = all.filter((i) => i.metrics.linkedNotes >= 3);
  if (richItems.length > 0) {
    insights.push({
      type: 'rich',
      message: `${richItems.length} piece${richItems.length > 1 ? 's' : ''} with deep note connections`,
      detail: `"${richItems[0].title}" has ${richItems[0].metrics.linkedNotes} linked notes.`,
    });
  }

  /* Ensure at least 4 insights */
  if (insights.length < 4) {
    const totalWords = all.reduce((sum, i) => sum + i.wordCount, 0);
    insights.push({
      type: 'momentum',
      message: `${totalWords.toLocaleString()} words across ${all.length} pieces`,
      detail: 'The practice is the product.',
    });
  }

  return insights.slice(0, 6);
}

/**
 * Generate a day summary for a group of timeline entries.
 */
export function generateDaySummary(
  entries: StudioTimelineEntry[],
): StudioDaySummary {
  const rng = createRng(hashString('day-summary-' + (entries[0]?.occurredAt ?? '')));

  const uniqueContentIds = new Set(entries.map((e) => e.contentId));
  const piecesTouched = uniqueContentIds.size;
  const wordsDelta = Math.floor(rng() * 800) + 50;
  const stageChanges = entries.filter((e) =>
    e.action.startsWith('advanced'),
  ).length;

  let summaryText: string;
  if (stageChanges > 0) {
    summaryText = `Touched ${piecesTouched} piece${piecesTouched > 1 ? 's' : ''}, added ~${wordsDelta} words, moved ${stageChanges} forward.`;
  } else if (piecesTouched > 1) {
    summaryText = `Worked across ${piecesTouched} pieces, adding ~${wordsDelta} words.`;
  } else {
    summaryText = `Focused session on one piece, ~${wordsDelta} words added.`;
  }

  return { piecesTouched, wordsDelta, stageChanges, summaryText };
}

/**
 * Generate 0 to 2 notes for a content item (seeded from contentId).
 */
export function getMockTimelineNotes(contentId: string): StudioTimelineNote[] {
  const rng = createRng(hashString('notes-' + contentId));
  const count = Math.floor(rng() * 3); // 0 to 2

  const noteTexts = [
    'This connects to the pattern language thread.',
    'Revisit the Brand quote in context.',
    'Consider splitting into two shorter pieces.',
    'The anecdote about the market might work better as the opening.',
    'Source list is getting long; curate the top 5.',
  ];

  const notes: StudioTimelineNote[] = [];
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rng() * 14) + 1;
    notes.push({
      id: `note-${contentId}-${i}`,
      text: pick(rng, noteTexts),
      createdAt: new Date(NOW_MS - daysAgo * DAY_MS).toISOString(),
    });
  }
  return notes;
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
