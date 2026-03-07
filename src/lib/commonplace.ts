/**
 * CommonPlace shared constants, types, and sidebar structure.
 *
 * Centralizes the research_api base URL, object type visual identity,
 * sidebar navigation, capture placeholders, and view registry.
 */

/* ─────────────────────────────────────────────────
   API base
   ───────────────────────────────────────────────── */

const RESEARCH_API =
  process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? 'http://localhost:8001';

export const API_BASE = `${RESEARCH_API}/api/v1/notebook`;

/* ─────────────────────────────────────────────────
   Object type visual identity
   (matches v4 architecture: Objects exist, Nodes happen)
   ───────────────────────────────────────────────── */

export interface ObjectTypeIdentity {
  slug: string;
  label: string;
  color: string;
  icon: string;
}

export const OBJECT_TYPES: ObjectTypeIdentity[] = [
  { slug: 'note', label: 'Note', color: '#F5F0E8', icon: 'note-pencil' },
  { slug: 'source', label: 'Source', color: '#2D5F6B', icon: 'book-open' },
  { slug: 'person', label: 'Person', color: '#B45A2D', icon: 'person' },
  { slug: 'place', label: 'Place', color: '#C49A4A', icon: 'map-pin' },
  { slug: 'organization', label: 'Org', color: '#5A7A4A', icon: 'building' },
  { slug: 'concept', label: 'Concept', color: '#8B6FA0', icon: 'lightbulb' },
  { slug: 'quote', label: 'Quote', color: '#C49A4A', icon: 'quote' },
  { slug: 'hunch', label: 'Hunch', color: '#B06080', icon: 'sparkle' },
  { slug: 'script', label: 'Script', color: '#6B7A8A', icon: 'code' },
  { slug: 'task', label: 'Task', color: '#C47A3A', icon: 'check-circle' },
];

export function getObjectTypeIdentity(slug: string): ObjectTypeIdentity {
  return (
    OBJECT_TYPES.find((t) => t.slug === slug) ?? {
      slug,
      label: slug,
      color: '#9A8E82',
      icon: 'note-pencil',
    }
  );
}

/* ─────────────────────────────────────────────────
   View types (what can appear in a pane)
   ───────────────────────────────────────────────── */

export type ViewType =
  | 'timeline'
  | 'scoped-timeline'
  | 'network'
  | 'notebook'
  | 'project'
  | 'object-detail'
  | 'calendar'
  | 'resurface'
  | 'loose-ends'
  | 'compose'
  | 'empty';

export interface ViewDefinition {
  type: ViewType;
  label: string;
  icon: string;
  /** Optional context: object ID, notebook slug, etc. */
  context?: Record<string, unknown>;
}

export const VIEW_REGISTRY: Record<ViewType, { label: string; icon: string }> = {
  timeline: { label: 'The Timeline', icon: 'timeline' },
  'scoped-timeline': { label: 'My Timelines', icon: 'filter' },
  network: { label: 'Knowledge Map', icon: 'graph' },
  notebook: { label: 'Notebook', icon: 'book' },
  project: { label: 'Project', icon: 'briefcase' },
  'object-detail': { label: 'Object', icon: 'note-pencil' },
  calendar: { label: 'Calendar', icon: 'calendar' },
  resurface: { label: 'Resurface', icon: 'sparkle' },
  'loose-ends': { label: 'Loose Ends', icon: 'scatter' },
  compose: { label: 'Compose', icon: 'note-pencil' },
  empty: { label: 'Empty', icon: 'plus' },
};

/* ─────────────────────────────────────────────────
   Sidebar navigation structure
   Four sections: CAPTURE, VIEW, WORK, SYSTEM
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
  /** If true, this is an expandable group with children */
  expandable?: boolean;
  children?: SidebarItem[];
  /** If set, clicking this item opens a pane tab instead of navigating */
  viewType?: ViewType;
  /** Context to pass to the pane tab */
  viewContext?: Record<string, unknown>;
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'Capture',
    items: [
      { label: 'Capture', href: '#capture', icon: 'capture' },
      { label: '+ Object', href: '#new-object', icon: 'molecule' },
    ],
  },
  {
    title: 'View',
    items: [
      { label: 'The Timeline', href: '#timeline', icon: 'timeline', viewType: 'timeline' as ViewType },
      { label: 'My Timelines', href: '#scoped-timeline', icon: 'filter', viewType: 'scoped-timeline' as ViewType },
      {
        label: 'Networks',
        href: '#networks',
        icon: 'graph',
        viewType: 'network' as ViewType,
        expandable: true,
        children: [
          { label: 'Saved Frames', href: '#frames', icon: 'frame', viewType: 'network' as ViewType, viewContext: { showFrames: true } },
        ],
      },
      { label: 'Calendar', href: '#calendar', icon: 'calendar', viewType: 'calendar' as ViewType },
      { label: 'Loose Ends', href: '#loose-ends', icon: 'scatter', viewType: 'loose-ends' as ViewType },
    ],
  },
  {
    title: 'Work',
    items: [
      {
        label: 'Notebooks',
        href: '/commonplace/notebooks',
        icon: 'book',
        expandable: true,
        children: [],
      },
      {
        label: 'Projects',
        href: '/commonplace/projects',
        icon: 'briefcase',
        expandable: true,
        children: [],
      },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Connection Engine', href: '#engine', icon: 'engine' },
      { label: 'Reminders', href: '#reminders', icon: 'bell' },
      { label: 'Resurface', href: '#resurface', icon: 'sparkle', viewType: 'resurface' as ViewType },
      { label: 'Settings', href: '#settings', icon: 'gear' },
    ],
  },
];

/* ─────────────────────────────────────────────────
   Captured object: local-first representation
   used by the capture system before API sync.
   ───────────────────────────────────────────────── */

export type CaptureMethod = 'typed' | 'pasted' | 'dropped' | 'quick-create';

export type CaptureStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface CapturedObject {
  id: string;
  title: string;
  body: string;
  objectType: string;
  capturedAt: string;
  captureMethod: CaptureMethod;
  status: CaptureStatus;
  /** Original URL if the capture was a link */
  sourceUrl?: string;
  /** Enriched OG title (populated after mock delay) */
  enrichedTitle?: string;
}

/* ─────────────────────────────────────────────────
   Mock data types for timeline and network views.
   These mirror the Django API response shapes so
   the switch from mock to live data is mechanical.
   ───────────────────────────────────────────────── */

export interface MockEdge {
  id: string;
  sourceId: string;
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface MockNode {
  id: string;
  /** Object database ID for detail navigation */
  objectRef: number;
  objectType: string;
  title: string;
  summary: string;
  capturedAt: string;
  edgeCount: number;
  edges: MockEdge[];
}

/* ─────────────────────────────────────────────────
   Graph types for D3 force layout (Session 8).
   ───────────────────────────────────────────────── */

export interface GraphNode {
  id: string;
  objectType: string;
  title: string;
  edgeCount: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  reason: string;
}

export interface ViewFrame {
  id: string;
  name: string;
  zoom: number;
  centerX: number;
  centerY: number;
  highlightedNodeIds: string[];
  createdAt: string;
}

/* ─────────────────────────────────────────────────
   Capture bar placeholders
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
   API response types (match Django DRF serializers)
   Used by commonplace-api.ts mapping layer.
   ───────────────────────────────────────────────── */

/** GET /feed/ item (NodeListSerializer) */
export interface ApiFeedNode {
  id: number;
  sha_hash: string;
  node_type: string;
  occurred_at: string;
  title: string;
  object_ref: number;
  object_title: string;
  object_type: string;
}

/** GET /graph/ object (GraphObjectSerializer) */
export interface ApiGraphObject {
  id: number;
  title: string;
  slug: string;
  object_type: string;
  object_type_color: string;
  object_type_icon: string;
  edge_count: number;
  status: string;
}

/** GET /graph/ edge (GraphEdgeSerializer) */
export interface ApiGraphEdge {
  id: number;
  source: number;
  target: number;
  edge_type: string;
  strength: number;
  reason: string;
}

/** GET /graph/ full response */
export interface ApiGraphResponse {
  objects: ApiGraphObject[];
  edges: ApiGraphEdge[];
  meta: {
    object_count: number;
    edge_count: number;
    type_distribution: Record<string, number>;
  };
}

/** Object detail edge (EdgeCompactSerializer) */
export interface ApiEdgeCompact {
  id: number;
  other_id: number;
  other_title: string;
  direction: 'incoming' | 'outgoing';
  edge_type: string;
  reason: string;
  strength: number;
}

/** Object component (ComponentSerializer) */
export interface ApiComponent {
  id: number;
  component_type: number;
  component_type_name: string;
  data_type: string;
  key: string;
  value: string;
  sort_order: number;
}

/** GET /objects/{slug}/ (ObjectDetailSerializer) */
export interface ApiObjectDetail {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  object_type: number;
  object_type_data: { slug: string; name: string; icon: string; color: string };
  body: string;
  url: string;
  og_title: string | null;
  og_description: string | null;
  status: string;
  captured_at: string;
  capture_method: string;
  edges: ApiEdgeCompact[];
  components: ApiComponent[];
  recent_nodes: ApiFeedNode[];
}

/** POST /capture/ response */
export interface ApiCaptureResponse {
  object: ApiObjectDetail;
  creation_node: ApiFeedNode | null;
}

/** GET /resurface/ item */
export interface ApiResurfaceItem extends ApiGraphObject {
  captured_at: string;
  score: number;
  why_this: string;
}

/** GET /resurface/ response */
export interface ApiResurfaceResponse {
  objects: ApiResurfaceItem[];
  meta: { count: number };
}

/* ── Notebook types (NotebookListSerializer / NotebookDetailSerializer) ── */

export interface ApiNotebookListItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
  object_count: number;
}

export interface ApiNotebookDetail extends ApiNotebookListItem {
  engine_config: Record<string, unknown>;
  available_types: string[];
  default_layout: Record<string, unknown> | null;
  theme: Record<string, unknown>;
  objects: { id: number; title: string; object_type: string }[];
}

/* ── Project types (ProjectListSerializer / ProjectDetailSerializer) ── */

export interface ApiProjectListItem {
  id: number;
  name: string;
  slug: string;
  mode: string;
  status: string;
  notebook: string | null;
  notebook_name: string | null;
  is_template: boolean;
  reminder_at: string | null;
}

export interface ApiProjectDetail extends ApiProjectListItem {
  sha_hash: string;
  description: string;
  template_from: string | null;
  settings_override: Record<string, unknown>;
  objects: { id: number; title: string; object_type: string }[];
}

/* ── DailyLog types (DailyLogSerializer) ── */

export interface ApiDailyLogObject {
  id: number;
  title: string;
  object_type: string;
}

export interface ApiDailyLogUpdate {
  id: number;
  title: string;
  action: string;
}

export interface ApiDailyLogEdge {
  id: number;
  from_title: string;
  to_title: string;
  reason: string;
}

export interface ApiDailyLogEntity {
  text: string;
  entity_type: string;
  resolved_to: string;
}

export interface ApiDailyLog {
  id: number;
  date: string;
  objects_created: ApiDailyLogObject[];
  objects_updated: ApiDailyLogUpdate[];
  edges_created: ApiDailyLogEdge[];
  entities_resolved: ApiDailyLogEntity[];
  summary: string;
}

/* ─────────────────────────────────────────────────
   Fetch helpers (same pattern as networks.ts)
   ───────────────────────────────────────────────── */

export interface ObjectListItem {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  object_type: number;
  object_type_name: string;
  object_type_slug: string;
  object_type_icon: string;
  object_type_color: string;
  url: string;
  status: string;
  is_pinned: boolean;
  is_starred: boolean;
  captured_at: string;
  capture_method: string;
  edge_count: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function fetchObjects(params?: {
  status?: string;
  type?: string;
  q?: string;
  starred?: boolean;
  pinned?: boolean;
  notebook?: string;
  project?: string;
}): Promise<PaginatedResponse<ObjectListItem>> {
  const url = new URL(`${API_BASE}/nodes/`);
  if (params?.status) url.searchParams.set('status', params.status);
  if (params?.type) url.searchParams.set('type', params.type);
  if (params?.q) url.searchParams.set('q', params.q);
  if (params?.starred) url.searchParams.set('starred', 'true');
  if (params?.pinned) url.searchParams.set('pinned', 'true');
  if (params?.notebook) url.searchParams.set('notebook', params.notebook);
  if (params?.project) url.searchParams.set('project', params.project);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return { count: 0, next: null, previous: null, results: [] };
    return res.json();
  } catch {
    return { count: 0, next: null, previous: null, results: [] };
  }
}

export async function quickCapture(data: {
  url?: string;
  body?: string;
  title?: string;
  object_type?: string;
}): Promise<{ ok: boolean; object?: ObjectListItem; error?: string }> {
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
    const object = await res.json();
    return { ok: true, object };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
