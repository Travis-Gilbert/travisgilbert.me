/**
 * Networks API client and shared constants.
 *
 * Centralizes the Index API base URL, node type visual identity,
 * and fetch helpers for all Networks components.
 */

/* ─────────────────────────────────────────────────
   API base
   ───────────────────────────────────────────────── */

// Browser: relative URL (rewrite proxy handles it). SSR: use env var if set.
const INDEX_API = typeof window !== 'undefined'
  ? ''
  : (process.env.NEXT_PUBLIC_INDEX_API_URL
     ?? process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? '');

const API_BASE = `${INDEX_API}/api/v1/notebook`;

/* ─────────────────────────────────────────────────
   Node type visual identity
   ───────────────────────────────────────────────── */

export interface NodeTypeIdentity {
  slug: string;
  label: string;
  color: string;
  icon: string;
}

export const NODE_TYPES: NodeTypeIdentity[] = [
  { slug: 'note', label: 'Note', color: '#F5F0E8', icon: 'note-pencil' },
  { slug: 'source', label: 'Source', color: '#2D5F6B', icon: 'book-open' },
  { slug: 'person', label: 'Person', color: '#C45D3E', icon: 'person' },
  { slug: 'place', label: 'Place', color: '#D4A843', icon: 'map-pin' },
  { slug: 'organization', label: 'Org', color: '#5A7A4A', icon: 'building' },
  { slug: 'concept', label: 'Concept', color: '#8B6FA0', icon: 'lightbulb' },
  { slug: 'event', label: 'Event', color: '#4A7A9A', icon: 'calendar' },
  { slug: 'hunch', label: 'Hunch', color: '#B06080', icon: 'sparkle' },
  { slug: 'quote', label: 'Quote', color: '#C49A4A', icon: 'quote' },
  { slug: 'project', label: 'Project', color: '#C45D3E', icon: 'briefcase' },
  { slug: 'task', label: 'Task', color: '#C47A3A', icon: 'check-circle' },
  { slug: 'reminder', label: 'Reminder', color: '#C4A83A', icon: 'bell' },
];

export function getNodeTypeIdentity(slug: string): NodeTypeIdentity {
  return (
    NODE_TYPES.find((t) => t.slug === slug) ?? {
      slug,
      label: slug,
      color: '#9B8FA0',
      icon: 'note-pencil',
    }
  );
}

/* ─────────────────────────────────────────────────
   API response types (matching DRF serializers)
   ───────────────────────────────────────────────── */

export interface NodeListItem {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  node_type: number;
  node_type_name: string;
  node_type_slug: string;
  node_type_icon: string;
  node_type_color: string;
  url: string;
  status: string;
  is_pinned: boolean;
  is_starred: boolean;
  captured_at: string;
  capture_method: string;
  edge_count: number;
}

export interface NodeTypeFromAPI {
  id: number;
  name: string;
  slug: string;
  icon: string;
  color: string;
  schema: Record<string, unknown>;
  is_built_in: boolean;
  sort_order: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/* ─────────────────────────────────────────────────
   Fetch helpers
   ───────────────────────────────────────────────── */

export async function fetchNodeTypes(): Promise<NodeTypeFromAPI[]> {
  const res = await fetch(`${API_BASE}/types/`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchNodes(params?: {
  status?: string;
  type?: string;
  q?: string;
  starred?: boolean;
  pinned?: boolean;
}): Promise<PaginatedResponse<NodeListItem>> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.type) search.set('type', params.type);
  if (params?.q) search.set('q', params.q);
  if (params?.starred) search.set('starred', 'true');
  if (params?.pinned) search.set('pinned', 'true');

  const qs = search.toString();
  const url = `${API_BASE}/nodes/${qs ? `?${qs}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { count: 0, next: null, previous: null, results: [] };
    return res.json();
  } catch {
    // Network error (API server unreachable)
    return { count: 0, next: null, previous: null, results: [] };
  }
}

export async function quickCapture(data: {
  url?: string;
  body?: string;
  title?: string;
  node_type?: string;
}): Promise<{ ok: boolean; node?: NodeListItem; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.detail ?? 'Capture failed' };
    }
    const node = await res.json();
    return { ok: true, node };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/* ─────────────────────────────────────────────────
   CaptureBar placeholder quotes
   ───────────────────────────────────────────────── */

export const CAPTURE_PLACEHOLDERS = [
  'Paste a URL, jot a thought, capture a name...',
  'What caught your attention today?',
  'Drop a link, save it for later...',
  'A person, a place, an idea...',
  'Something you want to remember...',
  'A connection you noticed...',
  'A quote that resonated...',
  'What are you thinking about?',
];

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
  icon?: string;
  color?: string;
  badge?: number;
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'Notebooks',
    items: [
      { label: 'All Notes', href: '/networks', icon: 'inbox' },
      { label: 'Starred', href: '/networks?filter=starred', icon: 'star' },
    ],
  },
  {
    title: 'Projects',
    items: [
      { label: 'Active Projects', href: '/networks/projects', icon: 'briefcase' },
    ],
  },
  {
    title: 'Networks',
    items: [
      { label: 'Knowledge Graph', href: '/networks/graph', icon: 'graph' },
      { label: 'Connections', href: '/networks/connections', icon: 'link' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Resurface', href: '/networks/resurface', icon: 'sparkle' },
      { label: 'Calendar', href: '/networks/calendar', icon: 'calendar' },
    ],
  },
];
