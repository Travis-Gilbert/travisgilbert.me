/**
 * Research Trail API client and TypeScript types.
 *
 * Fetches from the research_api Django service at research.travisgilbert.me.
 * All functions return null on failure for graceful degradation:
 * if the API is unreachable, the Research Trail section simply doesn't appear.
 */

const RESEARCH_API = 'https://research.travisgilbert.me';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TrailSource {
  id: number;
  title: string;
  slug: string;
  creator: string;
  sourceType: string;
  url: string;
  publication: string;
  publicAnnotation: string;
  role: string;
  keyQuote: string;
  keyFindings?: string[];
  dateEncountered?: string;
  datePublished?: string;
  tags?: string[];
}

export interface Backlink {
  contentType: string;
  contentSlug: string;
  contentTitle: string;
  sharedSources: Array<{
    sourceId: number;
    sourceTitle: string;
  }>;
}

export interface ThreadEntry {
  entryType: string;
  date: string;
  title: string;
  description: string;
  sourceTitle: string;
}

export interface ResearchThread {
  title: string;
  slug: string;
  description: string;
  status: string;
  startedDate: string;
  completedDate?: string;
  durationDays?: number;
  entries: ThreadEntry[];
}

export interface Mention {
  sourceUrl: string;
  sourceTitle: string;
  sourceExcerpt: string;
  sourceAuthor: string;
  mentionType: string;
  featured: boolean;
  mentionSourceName: string;
  mentionSourceAvatar: string;
  createdAt: string;
  sourcePublished?: string;
}

export interface ApprovedSuggestion {
  title: string;
  url: string;
  sourceType: string;
  relevanceNote: string;
  contributorName: string;
}

export interface TrailResponse {
  slug: string;
  contentType: 'essay' | 'field_note';
  sources: TrailSource[];
  backlinks: Backlink[];
  thread: ResearchThread | null;
  mentions: Mention[];
  approvedSuggestions?: ApprovedSuggestion[];
}

// Graph types (D3 visualization)
export interface GraphNode {
  id: string;
  type: 'source' | 'essay' | 'field_note';
  label: string;
  slug: string;
  sourceType?: string;
  creator?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  role: string;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Thread list types (for active threads on homepage)
// Note: DRF serializer uses snake_case (no camelCase renderer configured)
export interface ThreadListItem {
  title: string;
  slug: string;
  description: string;
  status: string;
  started_date: string;
  entry_count: number;
  tags?: string[];
}

// Activity types (for heatmap and timeline visualizations)
export interface ActivityDay {
  date: string;
  sources: number;
  links: number;
  entries: number;
}

export interface SourceSuggestion {
  title: string;
  url: string;
  source_type: string;
  relevance_note: string;
  target_content_type: string;
  target_slug: string;
  contributor_name: string;
  contributor_url: string;
  recaptcha_token: string;
}

// ─── API Functions ──────────────────────────────────────────────────────────

export async function fetchResearchTrail(slug: string): Promise<TrailResponse | null> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/trail/${slug}/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchApprovedSuggestions(slug: string): Promise<ApprovedSuggestion[]> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/suggestions/${slug}/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function submitSourceSuggestion(data: SourceSuggestion): Promise<boolean> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/suggest/source/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchSourceGraph(): Promise<GraphResponse | null> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/graph/`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchResearchActivity(days = 365): Promise<ActivityDay[]> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/activity/?days=${days}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchActiveThreads(): Promise<ThreadListItem[]> {
  try {
    const res = await fetch(`${RESEARCH_API}/api/v1/threads/?status=active`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (!text) return [];
    const data = JSON.parse(text);
    // DRF ListAPIView returns array directly (not paginated here)
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
