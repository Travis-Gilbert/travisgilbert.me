/**
 * Video Production API client.
 *
 * Fetches from the publishing_api (Studio) Django service.
 * All functions return null/empty on failure for graceful degradation:
 * if the API is unreachable, video sections simply don't appear.
 */

const STUDIO_API = process.env.STUDIO_API_URL || 'https://draftroom.travisgilbert.me';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VideoSummary {
  slug: string;
  title: string;
  short_title: string;
  phase: string;
  phase_display: string;
  phase_number: number;
  draft: boolean;
  updated_at: string;
  youtube_id: string;
  linked_essay_slugs: string[];
  published_at: string | null;
}

export interface VideoDetail extends VideoSummary {
  thesis: string;
  sources: Array<{ title: string; url: string }>;
  script_word_count: number;
  script_estimated_duration: string;
  youtube_url: string;
  youtube_title: string;
  published_at: string | null;
  linked_essays: Array<{ slug: string; title: string }>;
  linked_field_notes: Array<{ slug: string; title: string }>;
  scenes: Array<{
    id: number;
    order: number;
    title: string;
    scene_type: string;
    script_locked: boolean;
    vo_recorded: boolean;
    filmed: boolean;
    assembled: boolean;
    polished: boolean;
  }>;
  deliverables: Array<{
    id: number;
    label: string;
    platform: string;
    status: string;
    url: string;
  }>;
}

// ─── Phase Definitions ──────────────────────────────────────────────────────

export const VIDEO_PHASES = [
  'research',
  'scripting',
  'voiceover',
  'filming',
  'assembly',
  'polish',
  'metadata',
  'publish',
  'published',
] as const;

export type VideoPhase = (typeof VIDEO_PHASES)[number];

export const PHASE_LABELS: Record<VideoPhase, string> = {
  research: 'Research',
  scripting: 'Scripting',
  voiceover: 'Voiceover',
  filming: 'Filming',
  assembly: 'Assembly',
  polish: 'Polish',
  metadata: 'Metadata',
  publish: 'Publish',
  published: 'Published',
};

// ─── API Functions ──────────────────────────────────────────────────────────

export async function fetchActiveVideos(): Promise<VideoSummary[]> {
  try {
    const res = await fetch(`${STUDIO_API}/api/videos/?active=true`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos ?? [];
  } catch {
    return [];
  }
}

export async function fetchAllVideos(): Promise<VideoSummary[]> {
  try {
    const res = await fetch(`${STUDIO_API}/api/videos/`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.videos ?? [];
  } catch {
    return [];
  }
}

export async function fetchVideoDetail(slug: string): Promise<VideoDetail | null> {
  try {
    const res = await fetch(`${STUDIO_API}/api/videos/${slug}/`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Find videos linked to a specific essay slug.
 * Uses the list endpoint (deduped by Next.js fetch) and filters client-side.
 */
export async function fetchVideosForEssay(essaySlug: string): Promise<VideoSummary[]> {
  const videos = await fetchAllVideos();
  return videos.filter((v) => v.linked_essay_slugs.includes(essaySlug));
}
