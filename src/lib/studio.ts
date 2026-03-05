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
  return (
    CONTENT_TYPES.find((t) => t.slug === slug) ?? {
      slug,
      label: slug,
      pluralLabel: slug,
      color: '#9A8E82',
      icon: 'file-text',
      route: slug,
    }
  );
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
}

export interface StudioTimelineEntry {
  id: string;
  contentId: string;
  contentTitle: string;
  contentType: string;
  action: string;
  detail: string;
  occurredAt: string;
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
    title: 'Make Stuff',
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
    title: 'Collect',
    items: [
      {
        label: 'Shelf',
        href: '/studio/shelf',
        icon: 'book-open',
        dotColor: '#D4AA4A',
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
    title: 'Build',
    items: [
      {
        label: 'Projects',
        href: '/studio/projects',
        icon: 'briefcase',
        dotColor: '#D4AA4A',
      },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Timeline', href: '/studio/timeline', icon: 'timeline' },
      { label: 'Settings', href: '/studio/settings', icon: 'gear' },
    ],
  },
];

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
