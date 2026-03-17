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
export const EPISTEMIC_BASE = `${RESEARCH_API}/api/v1`;

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
  { slug: 'event', label: 'Event', color: '#4A6A8A', icon: 'calendar' },
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
  | 'library'
  | 'grid'
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
  | 'connection-engine'
  | 'model-view'
  | 'reminders'
  | 'settings'
  | 'promotion-queue'
  | 'emergent-types'
  | 'entity-promotions'
  | 'notebook-formation'
  | 'artifacts'
  | 'temporal-evolution'
  | 'empty';

/* ─────────────────────────────────────────────────
   Navigation model: Screens vs Views
   Screens replace the entire content area.
   Views open inside the split pane workspace.
   ───────────────────────────────────────────────── */

export type NavigationMode = 'screen' | 'view';

export type ScreenType = 'library' | 'models' | 'notebooks' | 'projects' | 'engine' | 'settings';

export interface ViewDefinition {
  type: ViewType;
  label: string;
  icon: string;
  /** Optional context: object ID, notebook slug, etc. */
  context?: Record<string, unknown>;
}

export const VIEW_REGISTRY: Record<ViewType, { label: string; icon: string }> = {
  library: { label: 'Library', icon: 'grid' },
  grid: { label: 'All Objects', icon: 'grid' },
  timeline: { label: 'Timeline', icon: 'timeline' },
  'scoped-timeline': { label: 'My Timelines', icon: 'filter' },
  network: { label: 'Map', icon: 'graph' },
  notebook: { label: 'Notebook', icon: 'book' },
  project: { label: 'Project', icon: 'briefcase' },
  'object-detail': { label: 'Object', icon: 'note-pencil' },
  calendar: { label: 'Calendar', icon: 'calendar' },
  resurface: { label: 'Resurface', icon: 'brain-research' },
  'loose-ends': { label: 'Loose Ends', icon: 'scatter' },
  compose: { label: 'Compose', icon: 'note-pencil' },
  'connection-engine': { label: 'Engine', icon: 'engine' },
  'model-view': { label: 'Models', icon: 'model' },
  reminders: { label: 'Reminders', icon: 'bell' },
  settings: { label: 'Settings', icon: 'gear' },
  'promotion-queue': { label: 'Review Queue', icon: 'check-list' },
  'emergent-types': { label: 'Emergent Types', icon: 'round-flask' },
  'entity-promotions': { label: 'Entity Promotions', icon: 'user-star' },
  'notebook-formation': { label: 'Notebook Formation', icon: 'book' },
  artifacts: { label: 'Artifacts', icon: 'archive' },
  'temporal-evolution': { label: 'Temporal', icon: 'timeline' },
  empty: { label: 'Empty', icon: 'plus' },
};

/* ─────────────────────────────────────────────────
   Sidebar navigation structure
   Five sections: CAPTURE, primary views, secondary VIEWS, WORK, SYSTEM
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
  /** Navigation mode: 'screen' replaces content area, 'view' opens in pane workspace */
  mode?: NavigationMode;
  /** Screen target (when mode is 'screen') */
  screenType?: ScreenType;
  /** View target (when mode is 'view') */
  viewType?: ViewType;
  /** Context to pass to the view */
  viewContext?: Record<string, unknown>;
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: 'Capture',
    items: [
      { label: 'Capture', href: '#capture', icon: 'capture' },
    ],
  },
  {
    title: '',
    items: [
      { label: 'Library', href: '#library', icon: 'grid', mode: 'screen', screenType: 'library' },
      { label: 'Models', href: '#models', icon: 'model', mode: 'screen', screenType: 'models' },
      { label: 'Artifacts', href: '#artifacts', icon: 'archive', mode: 'view', viewType: 'artifacts' },
      { label: 'Compose', href: '#compose', icon: 'note-pencil', mode: 'view', viewType: 'compose' },
    ],
  },
  {
    title: 'Views',
    items: [
      {
        label: 'Timeline',
        href: '#timeline',
        icon: 'timeline',
        mode: 'view',
        viewType: 'timeline',
        expandable: true,
        children: [
          { label: 'Temporal', href: '#temporal', icon: 'timeline', mode: 'view', viewType: 'temporal-evolution' },
        ],
      },
      { label: 'Map', href: '#networks', icon: 'graph', mode: 'view', viewType: 'network' },
      { label: 'Calendar', href: '#calendar', icon: 'calendar', mode: 'view', viewType: 'calendar' },
      { label: 'Loose Ends', href: '#loose-ends', icon: 'scatter', mode: 'view', viewType: 'loose-ends' },
    ],
  },
  {
    title: 'Work',
    items: [
      {
        label: 'Notebooks',
        href: '/commonplace/notebooks',
        icon: 'book',
        mode: 'screen',
        screenType: 'notebooks',
        expandable: true,
        children: [
          { label: 'Formation', href: '#notebook-formation', icon: 'book', mode: 'view', viewType: 'notebook-formation' },
        ],
      },
      {
        label: 'Projects',
        href: '/commonplace/projects',
        icon: 'briefcase',
        mode: 'screen',
        screenType: 'projects',
        expandable: true,
        children: [],
      },
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Engine',
        href: '#engine',
        icon: 'engine',
        mode: 'screen',
        screenType: 'engine',
        expandable: true,
        children: [
          { label: 'Emergent Types', href: '#emergent-types', icon: 'round-flask', mode: 'view', viewType: 'emergent-types' },
          { label: 'Entity Promotions', href: '#entity-promotions', icon: 'user-star', mode: 'view', viewType: 'entity-promotions' },
        ],
      },
      { label: 'Review Queue', href: '#review', icon: 'check-list', mode: 'view', viewType: 'promotion-queue' },
      { label: 'Settings', href: '#settings', icon: 'gear', mode: 'screen', screenType: 'settings' },
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
  /** Binary file attachment (PDF, image) for server-side extraction */
  file?: File;
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
  edge_type?: string;
  createdAt: string;
}

export interface MockNode {
  id: string;
  /** Object database ID for detail navigation */
  objectRef: number;
  /** Object slug for URL-friendly lookups */
  objectSlug: string;
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
  objectRef?: number;
  objectSlug?: string;
  objectType: string;
  title: string;
  edgeCount: number;
  bodyPreview?: string;
  status?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  reason: string;
  edge_type?: string;
  strength?: number;
  engine?: string;
}

export interface ViewFrame {
  id: string;
  name: string;
  zoom: number;
  centerX: number;
  centerY: number;
  highlightedNodeIds: string[];
  createdAt: string;
  /** Base64 PNG thumbnail (48x48, quality 0.3) captured at save time */
  thumbnail?: string;
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
  id: string;             // "node:<pk>"
  node_type: string;
  icon: string;
  object_type: string;
  object_type_color: string;
  title: string;
  body: string;
  timestamp: string;      // ISO datetime
  has_retrospective: boolean;
  retrospective: { text: string; written_at: string } | null;
  object_id: string;      // "object:<pk>"
  object_slug?: string;   // optional slug when provided by feed endpoint
}

/** Day bucket returned by /feed/ */
export interface ApiFeedDay {
  date: string;           // "YYYY-MM-DD"
  nodes: ApiFeedNode[];
}

/** GET /feed/ paginated response */
export interface ApiFeedResponse {
  days: ApiFeedDay[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
}

/** GET /graph/ node */
export interface ApiGraphObject {
  id: string;             // "object:<pk>"
  title: string;
  slug: string;
  body_preview: string;
  object_type: string;
  object_type_color: string;
  object_type_icon: string;
  edge_count: number;
  size: number;
  status: string;
}

/** GET /graph/ edge */
export interface ApiGraphEdge {
  id: string;             // "edge:<pk>"
  source: string;         // "object:<pk>"
  target: string;         // "object:<pk>"
  edge_type: string;
  strength: number;
  reason: string;
  engine?: string;
}

/** GET /graph/ full response */
export interface ApiGraphResponse {
  nodes: ApiGraphObject[];
  edges: ApiGraphEdge[];
  meta: {
    node_count: number;
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
  engine?: string;
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

/** Node list item (NodeListSerializer, used in object detail recent_nodes) */
export interface ApiNodeListItem {
  id: number;
  sha_hash: string;
  node_type: string;
  occurred_at: string;
  title: string;
  object_ref: number;
  object_title: string;
  object_type: string;
  object_slug: string;
}

/** GET /objects/{slug}/ (ObjectDetailSerializer) */
export interface ApiEvidenceLink {
  id: number;
  artifact_id: number | null;
  relation_type: string;
  confidence: number;
  reason: string;
  created_at: string;
}

export interface ApiObjectClaim {
  id: number;
  text: string;
  claim_type: string;
  polarity: string;
  status: string;
  confidence: number;
  reviewed_at: string | null;
  evidence_links: ApiEvidenceLink[];
}

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
  recent_nodes: ApiNodeListItem[];
  object_claims?: ApiObjectClaim[];
}

/** POST /capture/ response */
export interface ApiCaptureResponse {
  object: ApiObjectDetail;
  inferred_type?: string;
  creation_node: ApiNodeListItem | null;
  engine_job_id?: string;
}

/** GET /resurface/ card */
export interface ApiResurfaceCard {
  object: ApiObjectDetail;
  signal: string;
  signal_label: string;
  explanation: string;
  score: number;
  actions: string[];
}

/** GET /resurface/ response */
export interface ApiResurfaceResponse {
  cards: ApiResurfaceCard[];
  meta: { count: number };
}

/* ── Compose live query types (POST /compose/related/) ── */

export type ComposePassId =
  | 'ner'
  | 'shared_entity'
  | 'keyword'
  | 'tfidf'
  | 'sbert'
  | 'nli'
  | 'kge';

export type ComposeResultSignal =
  | ComposePassId
  | 'supports'
  | 'contradicts';

export interface ApiComposePassState {
  id: ComposePassId;
  status: 'complete' | 'degraded';
  match_count: number;
  degraded_reason?: string;
}

export interface ApiComposeObject {
  id: string; // "object:<pk>"
  slug: string;
  type: string;
  type_color: string;
  title: string;
  body_preview: string;
  score: number;
  signal: ComposeResultSignal;
  explanation: string;
  dominant_signal?: ComposeResultSignal;
  dominant_explanation?: string;
  supporting_signals?: ComposeResultSignal[];
}

export interface ApiComposeDegraded {
  degraded: boolean;
  sbert_unavailable: boolean;
  nli_unavailable?: boolean;
  kge_unavailable: boolean;
  reasons: string[];
}

export interface ApiComposeResponse {
  query_id: string;
  text_length: number;
  passes_run: string[];
  pass_states: ApiComposePassState[];
  objects: ApiComposeObject[];
  degraded: ApiComposeDegraded;
}

export interface ApiCanvasSuggestion {
  id: string;
  name: string;
  description: string;
  vega_lite_spec: Record<string, unknown>;
}

export interface ApiEngineJobStatus {
  job_id: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  summary: Record<string, number | string | string[]>;
  error: string;
  object_id?: number | null;
  object_slug?: string;
  object_title?: string;
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
  visibility?: string;
}

/* ── Notebook Workspace types ── */

/** GET /notebooks/<slug>/health/ */
export interface ApiNotebookHealth {
  object_count: number;
  edge_count: number;
  density: number;
  last_engine_run: string | null;
  cluster_count: number;
}

/** GET /temporal/ response */
export interface ApiTemporalSnapshot {
  window_start: string;
  window_end: string;
  object_count: number;
  edge_count: number;
  density: number;
  component_count: number;
  top_types: Record<string, number>;
}

export interface ApiTemporalTrajectory {
  window_start: string;
  object_growth: number;
  edge_growth: number;
  density_change: number;
}

export interface ApiTemporalEvolution {
  snapshots: ApiTemporalSnapshot[];
  trajectory: ApiTemporalTrajectory[];
  summary: string;
}

/** Engine config shape (Surface 8) */
export interface EnginePassConfig {
  enabled: boolean;
  [key: string]: unknown;
}

export interface EngineConfig {
  passes?: Record<string, EnginePassConfig>;
  post_passes?: Record<string, EnginePassConfig>;
  modules?: Record<string, boolean>;
  novelty?: number;
  [key: string]: unknown;
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

export interface TagSummaryPip {
  type: 'evidence' | 'tension' | 'refuted' | 'candidate' | 'dormant';
  count: number;
}

export interface TagSummary {
  badge: 'proposed' | 'supported' | 'contested' | 'refuted' | 'superseded' | null;
  badge_confirmed: boolean;
  pips: TagSummaryPip[];
  needs_review: boolean;
}

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
  pinned_objects?: PinnedBadgeObject[];
  tag_summary?: TagSummary | null;
}

/** Object attached to a parent via a pinned edge (Lego composition). */
export interface PinnedBadgeObject {
  edge_id: number;
  object_id: number;
  slug: string;
  title: string;
  object_type: string;
  position?: 'badge' | 'inline' | 'sidebar';
  sort_order?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ClusterMember {
  id: number;
  title: string;
  slug: string;
  body_preview: string;
  edge_count: number;
}

export interface ClusterResponse {
  type: string;
  label: string;
  color: string;
  icon: string;
  count: number;
  members: ClusterMember[];
}

export interface LineageNeighbor {
  id: number;
  title: string;
  slug: string;
  object_type_slug: string;
  object_type_label: string;
  object_type_color: string;
  reason: string;
  strength: number;
}

export interface LineageResponse {
  object: {
    id: number;
    title: string;
    slug: string;
    object_type_slug: string;
    object_type_label: string;
    object_type_color: string;
  };
  ancestors: LineageNeighbor[];
  descendants: LineageNeighbor[];
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

/* ─────────────────────────────────────────────────
   Epistemic + self-organize API types
   ───────────────────────────────────────────────── */

export interface ApiPromotionItem {
  id: number;
  artifact: number;
  artifact_title: string;
  item_type: 'claim' | 'entity' | 'question' | 'rule' | 'method_candidate';
  queue_state: 'pending' | 'accepted' | 'rejected' | 'deferred';
  title: string;
  confidence: number;
  pack_hint: string;
  created_at: string;
}

export interface ApiNotebookFormationPreview {
  modularity: number;
  threshold: number;
  eligible: boolean;
  candidate_count: number;
  candidates: {
    label: string;
    member_count: number;
    unassigned_count: number;
    top_notebook_share: number;
    top_types: Record<string, number>;
  }[];
}

export interface ApiEntityPromotionCandidate {
  normalized_text: string;
  entity_type: string;
  mention_count: number;
  suggested_object_type: string;
}

export interface ApiSelfOrganizePreview {
  notebook_formation: ApiNotebookFormationPreview;
  entity_promotions: {
    threshold: number;
    candidate_count: number;
    candidates: ApiEntityPromotionCandidate[];
  };
  edge_evolution: {
    half_life_days: number;
    prune_threshold: number;
    to_prune_count: number;
    to_decay_count: number;
  };
  emergent_types?: {
    candidate_count: number;
    candidates: ApiEmergentTypeSuggestion[];
  };
}

export interface ApiEmergentTypeSuggestion {
  reason: string;
  suggested_name: string;
  suggested_slug: string;
  member_count: number;
  member_pks: number[];
  member_samples?: { id: number; title: string; slug: string; object_type_name: string }[];
}

export interface ApiArtifactListItem {
  id: number;
  sha_hash: string;
  title: string;
  capture_kind: 'text' | 'url' | 'file';
  source_url: string;
  parser_type: string;
  ingestion_status: 'captured' | 'parsed' | 'extracted' | 'failed';
  epistemic_status: string;
  notebook_slug: string | null;
  project_slug: string | null;
  projection_count: number;
  raw_text_preview?: string;
  extraction_summary?: {
    claims: number; entities: number; questions: number;
    rules: number; methods: number;
  };
  created_at: string;
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
