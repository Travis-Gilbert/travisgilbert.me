/**
 * Studio shared constants, types, and sidebar structure.
 *
 * Centralizes content type definitions, stage pipeline,
 * sidebar navigation, and the API base URL. Follows the
 * same pattern as commonplace.ts for route group isolation.
 */

/* ─────────────────────────────────────────────────
   API base
   ───────────────────────────────────────────────── */

const STUDIO_URL =
  process.env.NEXT_PUBLIC_STUDIO_URL ?? 'http://localhost:8000';

export const STUDIO_API_BASE = `${STUDIO_URL}/editor/api`;

const CONTENT_TYPE_ALIASES: Record<string, string> = {
  essay: 'essay',
  essays: 'essay',
  'field-note': 'field-note',
  'field-notes': 'field-note',
  field_note: 'field-note',
  field_notes: 'field-note',
  shelf: 'shelf',
  video: 'video',
  videos: 'video',
  project: 'project',
  projects: 'project',
  toolkit: 'toolkit',
};

const API_CONTENT_TYPE_BY_SLUG: Record<string, string> = {
  essay: 'essay',
  'field-note': 'field_note',
  shelf: 'shelf',
  video: 'video',
  project: 'project',
  toolkit: 'toolkit',
};

/* ─────────────────────────────────────────────────
   Content types: what Studio manages
   ───────────────────────────────────────────────── */

export interface ContentTypeIdentity {
  slug: string;
  label: string;
  pluralLabel: string;
  color: string;
  icon: string;
  /** Route segment for list pages */
  route: string;
}

export const CONTENT_TYPES: ContentTypeIdentity[] = [
  {
    slug: 'essay',
    label: 'Essay',
    pluralLabel: 'Essays',
    color: '#B45A2D',
    icon: 'file-text',
    route: 'essays',
  },
  {
    slug: 'field-note',
    label: 'Field Note',
    pluralLabel: 'Field Notes',
    color: '#3A8A9A',
    icon: 'note-pencil',
    route: 'field-notes',
  },
  {
    slug: 'shelf',
    label: 'Shelf Entry',
    pluralLabel: 'Shelf',
    color: '#D4AA4A',
    icon: 'book-open',
    route: 'shelf',
  },
  {
    slug: 'video',
    label: 'Video',
    pluralLabel: 'Videos',
    color: '#6A9A5A',
    icon: 'video',
    route: 'videos',
  },
  {
    slug: 'project',
    label: 'Project',
    pluralLabel: 'Projects',
    color: '#D4AA4A',
    icon: 'briefcase',
    route: 'projects',
  },
  {
    slug: 'toolkit',
    label: 'Toolkit',
    pluralLabel: 'Toolkit',
    color: '#B45A2D',
    icon: 'wrench',
    route: 'toolkit',
  },
];

export function getContentTypeIdentity(slug: string): ContentTypeIdentity {
  const normalized = normalizeStudioContentType(slug);
  return (
    CONTENT_TYPES.find((t) => t.slug === normalized) ?? {
      slug: normalized,
      label: normalized,
      pluralLabel: normalized,
      color: '#9A8E82',
      icon: 'file-text',
      route: normalized,
    }
  );
}

export function normalizeStudioContentType(value: string): string {
  const normalized = value.trim().toLowerCase();
  return CONTENT_TYPE_ALIASES[normalized] ?? normalized;
}

export function toStudioApiContentType(value: string): string {
  const normalized = normalizeStudioContentType(value);
  return API_CONTENT_TYPE_BY_SLUG[normalized] ?? normalized;
}

export function toStudioRouteContentType(value: string): string {
  return normalizeStudioContentType(value);
}

/* ─────────────────────────────────────────────────
   Pipeline stages
   ───────────────────────────────────────────────── */

export interface StageDefinition {
  slug: string;
  label: string;
  color: string;
  /** Order in the pipeline (0 = first) */
  order: number;
}

export const STAGES: StageDefinition[] = [
  { slug: 'idea', label: 'Idea', color: '#9A8E82', order: 0 },
  { slug: 'research', label: 'Research', color: '#2D8A9A', order: 1 },
  { slug: 'drafting', label: 'Drafting', color: '#D4AA4A', order: 2 },
  { slug: 'revising', label: 'Revising', color: '#8A6A9A', order: 3 },
  { slug: 'production', label: 'Production', color: '#B45A2D', order: 4 },
  { slug: 'published', label: 'Published', color: '#6A9A5A', order: 5 },
];

export function getStage(slug: string): StageDefinition {
  return (
    STAGES.find((s) => s.slug === slug) ?? {
      slug,
      label: slug,
      color: '#9A8E82',
      order: -1,
    }
  );
}

export function getNextStage(currentSlug: string): StageDefinition | null {
  const current = STAGES.find((s) => s.slug === currentSlug);
  if (!current) return null;
  return STAGES.find((s) => s.order === current.order + 1) ?? null;
}

export function getPreviousStage(currentSlug: string): StageDefinition | null {
  const current = STAGES.find((s) => s.slug === currentSlug);
  if (!current || current.order === 0) return null;
  return STAGES.find((s) => s.order === current.order - 1) ?? null;
}

/* ─────────────────────────────────────────────────
   Video production phases (P0 through P7 + Published)
   ───────────────────────────────────────────────── */

export const VIDEO_PHASES: StageDefinition[] = [
  { slug: 'research', label: 'P0: Research', color: '#2D8A9A', order: 0 },
  { slug: 'scripting', label: 'P1: Script Lock', color: '#D4AA4A', order: 1 },
  { slug: 'voiceover', label: 'P2: Voiceover', color: '#8A6A9A', order: 2 },
  { slug: 'filming', label: 'P3: Filming', color: '#B45A2D', order: 3 },
  { slug: 'assembly', label: 'P4: Assembly', color: '#6A9A5A', order: 4 },
  { slug: 'polish', label: 'P5: Polish', color: '#3A8A9A', order: 5 },
  { slug: 'metadata', label: 'P6: Metadata', color: '#D4AA4A', order: 6 },
  { slug: 'publish', label: 'P7: Publish', color: '#9A8E82', order: 7 },
  { slug: 'published', label: 'Published', color: '#6A9A5A', order: 8 },
];

export function getVideoPhase(slug: string): StageDefinition {
  return VIDEO_PHASES.find((p) => p.slug === slug) ?? {
    slug,
    label: slug,
    color: '#9A8E82',
    order: -1,
  };
}

/* ─────────────────────────────────────────────────
   Data shapes: content items
   ───────────────────────────────────────────────── */

export interface StudioContentItem {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  stage: string;
  body: string;
  excerpt: string;
  wordCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  /** What to do next on this piece (dashboard hero card) */
  nextMove?: string;
  /** Summary of the last working session */
  lastSessionSummary?: string;
}

export interface StudioTimelineConnection {
  targetId: string;
  targetTitle: string;
}

export interface StudioTimelineNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface StudioTimelineEntry {
  id: string;
  contentId: string;
  contentTitle: string;
  contentType: string;
  action: string;
  detail: string;
  occurredAt: string;
  /** Linked content items referenced in this entry */
  connections?: StudioTimelineConnection[];
  /** User notes attached to this timeline entry */
  notes?: StudioTimelineNote[];
}

export interface StudioDashboardStats {
  totalPieces: number;
  totalWords: number;
  byStage: Record<string, number>;
  byType: Record<string, number>;
  recentActivity: StudioTimelineEntry[];
}

/* ─────────────────────────────────────────────────
   Item metrics: per-item intelligence data
   ───────────────────────────────────────────────── */

export interface StudioItemMetrics {
  /** Days since the item's updatedAt timestamp */
  daysSinceLastTouched: number;
  /** Days the item has been in its current stage */
  stageAgeDays: number;
  /** For video type: estimated completion percentage (0 to 100) */
  scriptCompletionPct: number | null;
  /** Number of sources associated with this item */
  sourcesCollected: number;
  /** Number of notes linked to this item */
  linkedNotes: number;
  /** 1 to 5 rating of how compelling the idea hook is */
  hookStrength: number;
}

/** A content item with its computed metrics attached. */
export interface StudioContentItemWithMetrics extends StudioContentItem {
  metrics: StudioItemMetrics;
}

/* ─────────────────────────────────────────────────
   Dashboard intelligence: categorized item lists
   ───────────────────────────────────────────────── */

export interface StudioDashboardIntel {
  /** Items to work on in the next session (active drafts/revisions) */
  nextSession: StudioContentItemWithMetrics[];
  /** Items stuck too long in the same stage (stageAge > 14 days) */
  stuckItems: StudioContentItemWithMetrics[];
  /** Items closest to being published (revising/production) */
  closestToPublish: StudioContentItemWithMetrics[];
  /** Research stage items with rich sources worth converting */
  researchToConvert: StudioContentItemWithMetrics[];
  /** Dormant idea/research items with strong hooks */
  dormantIdeas: StudioContentItemWithMetrics[];
}

/* ─────────────────────────────────────────────────
   Workbench panel data
   ───────────────────────────────────────────────── */

export interface WorkbenchPanelData {
  /** Per-stage counts for the pipeline breakdown */
  pipelineBreakdown: Record<string, number>;
  /** Items publish-ready this week (in production stage) */
  publishReadyThisWeek: number;
  /** Total items in idea stage */
  ideaBacklogCount: number;
  /** Aggregate word count across all items */
  totalWords: number;
  /** Recent activity entries for the feed */
  recentActivity: StudioTimelineEntry[];
}

/* ─────────────────────────────────────────────────
   Dashboard v2: today queue, pulse, day summary
   ───────────────────────────────────────────────── */

export interface StudioTodayQueueItem {
  id: string;
  task: string;
  contentId: string;
  contentTitle: string;
  contentType: string;
  stage: string;
}

export interface StudioPulseInsight {
  type: 'momentum' | 'simmering' | 'quiet' | 'ready' | 'rich';
  message: string;
  detail: string;
}

export interface StudioDaySummary {
  piecesTouched: number;
  wordsDelta: number;
  stageChanges: number;
  summaryText: string;
}

/* ─────────────────────────────────────────────────
   Sidebar navigation structure
   ───────────────────────────────────────────────── */

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export interface SidebarItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  /** Color dot for content type items */
  dotColor?: string;
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'MAKE STUFF',
    items: [
      {
        label: 'Essays',
        href: '/studio/essays',
        icon: 'file-text',
        dotColor: '#B45A2D',
      },
      {
        label: 'Field Notes',
        href: '/studio/field-notes',
        icon: 'note-pencil',
        dotColor: '#3A8A9A',
      },
      {
        label: 'Videos',
        href: '/studio/videos',
        icon: 'video',
        dotColor: '#6A9A5A',
      },
    ],
  },
  {
    title: 'COLLECT',
    items: [
      {
        label: 'Shelf',
        href: '/studio/shelf',
        icon: 'book-open',
        dotColor: '#D4AA4A',
      },
      {
        label: 'Commonplace',
        href: '/commonplace',
        icon: 'notebook',
        dotColor: '#9A8E82',
      },
      {
        label: 'Toolkit',
        href: '/studio/toolkit',
        icon: 'wrench',
        dotColor: '#B45A2D',
      },
    ],
  },
  {
    title: 'BUILD',
    items: [
      {
        label: 'Projects',
        href: '/studio/projects',
        icon: 'briefcase',
        dotColor: '#D4AA4A',
      },
      { label: 'Settings', href: '/studio/settings', icon: 'gear' },
    ],
  },
];

export const SIDEBAR_TIMELINE_ITEM: SidebarItem = {
  label: 'Timeline',
  href: '/studio/timeline',
  icon: 'timeline',
  dotColor: '#8A6A9A',
};

/* ─────────────────────────────────────────────────
   View types (what can appear in the main area)
   ───────────────────────────────────────────────── */

export type StudioView =
  | 'dashboard'
  | 'content-list'
  | 'editor'
  | 'timeline'
  | 'settings';

/* ─────────────────────────────────────────────────
   Capture bar placeholders
   ───────────────────────────────────────────────── */

export const CAPTURE_PLACEHOLDERS = [
  'Start a new essay, note, or shelf entry...',
  'What are you working on?',
  'New idea? Start writing...',
  'Draft a title to begin...',
];

/* ─────────────────────────────────────────────────
   CSS utility: color-mix for glow cards
   ───────────────────────────────────────────────── */

/**
 * Generates a CSS `color-mix()` value for transparent tinting.
 *
 * Mirrors the three-state glow pattern from ProjectColumns.tsx
 * where rest, hover, and expanded states use increasing percentages
 * of the type color mixed with transparent.
 *
 * @example studioMix('#B45A2D', 5.5) => 'color-mix(in srgb, #B45A2D 5.5%, transparent)'
 */
export function studioMix(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
