/**
 * Studio API client: typed fetch wrapper, response mappers,
 * and error handling.
 */

import {
  STUDIO_API_BASE,
  normalizeStudioContentType,
  toStudioApiContentType,
} from '@/lib/studio';
import type {
  StudioContentItem,
  StudioTimelineEntry,
  StudioDashboardStats,
} from '@/lib/studio';

interface StudioApiContentItem {
  id: string | number;
  title: string;
  slug: string;
  content_type: string;
  stage: string;
  body: string;
  excerpt: string;
  word_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

interface StudioApiTimelineItem {
  id: string;
  content_id: string;
  content_title: string;
  content_type: string;
  action: string;
  detail: string;
  occurred_at: string;
}

interface StudioApiConnectionsNode {
  id: string;
  pk: string;
  title: string;
  slug: string;
  content_type: string;
  stage: string;
  updated_at: string;
}

interface StudioApiConnectionsEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  reason: string;
}

interface StudioApiConnectionsGraph {
  nodes: StudioApiConnectionsNode[];
  edges: StudioApiConnectionsEdge[];
  meta: {
    node_count: number;
    edge_count: number;
    generated_at: string;
  };
}

export interface StudioConnectionsNode {
  id: string;
  pk: string;
  title: string;
  slug: string;
  contentType: string;
  stage: string;
  updatedAt: string;
}

export interface StudioConnectionsEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  reason: string;
}

export interface StudioConnectionsGraph {
  nodes: StudioConnectionsNode[];
  edges: StudioConnectionsEdge[];
  meta: {
    nodeCount: number;
    edgeCount: number;
    generatedAt: string;
  };
}

export class StudioApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public isNetworkError = false,
  ) {
    super(message);
    this.name = 'StudioApiError';
  }
}

function mergeHeaders(
  target: Record<string, string>,
  source?: HeadersInit,
): void {
  if (!source) return;
  if (source instanceof Headers) {
    source.forEach((value, key) => {
      target[key] = value;
    });
    return;
  }
  if (Array.isArray(source)) {
    source.forEach(([key, value]) => {
      target[key] = value;
    });
    return;
  }
  Object.assign(target, source);
}

function mapApiContentItem(item: StudioApiContentItem): StudioContentItem {
  return {
    id: String(item.id),
    title: item.title,
    slug: item.slug,
    contentType: normalizeStudioContentType(item.content_type),
    stage: item.stage,
    body: item.body ?? '',
    excerpt: item.excerpt ?? '',
    wordCount: item.word_count ?? 0,
    tags: Array.isArray(item.tags) ? item.tags : [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    publishedAt: item.published_at,
  };
}

function mapApiTimelineItem(item: StudioApiTimelineItem): StudioTimelineEntry {
  return {
    id: item.id,
    contentId: item.content_id,
    contentTitle: item.content_title,
    contentType: normalizeStudioContentType(item.content_type),
    action: item.action,
    detail: item.detail,
    occurredAt: item.occurred_at,
  };
}

function mapApiConnectionsNode(
  item: StudioApiConnectionsNode,
): StudioConnectionsNode {
  return {
    id: item.id,
    pk: item.pk,
    title: item.title,
    slug: item.slug,
    contentType: normalizeStudioContentType(item.content_type),
    stage: item.stage,
    updatedAt: item.updated_at,
  };
}

export async function studioFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${STUDIO_API_BASE}${path}`;
  const hasBody = options?.body !== undefined && options?.body !== null;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  mergeHeaders(headers, options?.headers);

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'omit',
      cache: 'no-store',
    });

    const text = await res.text();
    let payload: unknown = {};

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = {};
      }
    }

    if (!res.ok) {
      const body = payload as Record<string, unknown>;
      const message =
        (typeof body.detail === 'string' && body.detail) ||
        (typeof body.error === 'string' && body.error) ||
        `Studio API error ${res.status}`;
      throw new StudioApiError(res.status, message);
    }

    return payload as T;
  } catch (err) {
    if (err instanceof StudioApiError) throw err;
    throw new StudioApiError(
      0,
      'Network error: could not reach Studio API',
      true,
    );
  }
}

export async function fetchContentList(params?: {
  content_type?: string;
  stage?: string;
  q?: string;
}): Promise<StudioContentItem[]> {
  const contentType = params?.content_type
    ? normalizeStudioContentType(params.content_type)
    : null;

  const search = new URLSearchParams();
  if (params?.stage) search.set('stage', params.stage);
  if (params?.q) search.set('q', params.q);

  const qs = search.toString();
  const pathBase = contentType
    ? `/content/${toStudioApiContentType(contentType)}/`
    : '/content/';

  const data = await studioFetch<
    { results: StudioApiContentItem[] } | StudioApiContentItem[]
  >(`${pathBase}${qs ? `?${qs}` : ''}`);

  const items = Array.isArray(data) ? data : data.results ?? [];
  return items.map(mapApiContentItem);
}

export async function fetchContentItem(
  contentType: string,
  slug: string,
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/${slug}/`,
  );
  return mapApiContentItem(data);
}

export async function createContentItem(
  contentType: string,
  payload: { title?: string } = {},
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/create/`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return mapApiContentItem(data);
}

export async function saveContentItem(
  contentType: string,
  slug: string,
  payload: {
    title?: string;
    body?: string;
    excerpt?: string;
    tags?: string[];
  },
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/${slug}/update/`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
  return mapApiContentItem(data);
}

export async function deleteContentItem(
  contentType: string,
  slug: string,
): Promise<{ deleted: boolean }> {
  const apiType = toStudioApiContentType(contentType);
  return studioFetch<{ deleted: boolean }>(`/content/${apiType}/${slug}/delete/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function updateStage(
  contentType: string,
  slug: string,
  newStage: string,
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/${slug}/set-stage/`,
    {
      method: 'POST',
      body: JSON.stringify({ stage: newStage }),
    },
  );
  return mapApiContentItem(data);
}

/**
 * Publish content: saves, advances stage to "published", and triggers
 * the Django publisher to commit the markdown file to GitHub.
 * The Vercel git integration then auto-deploys the change.
 */
export async function publishContentItem(
  contentType: string,
  slug: string,
): Promise<StudioContentItem> {
  const apiType = toStudioApiContentType(contentType);
  const data = await studioFetch<StudioApiContentItem>(
    `/content/${apiType}/${slug}/publish/`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  );
  return mapApiContentItem(data);
}

export async function fetchTimeline(params?: {
  content_type?: string;
  limit?: number;
}): Promise<StudioTimelineEntry[]> {
  const search = new URLSearchParams();
  if (params?.content_type) {
    search.set('content_type', toStudioApiContentType(params.content_type));
  }
  if (params?.limit) search.set('limit', String(params.limit));

  const qs = search.toString();
  const data = await studioFetch<
    { results: StudioApiTimelineItem[] } | StudioApiTimelineItem[]
  >(`/timeline/${qs ? `?${qs}` : ''}`);

  const entries = Array.isArray(data) ? data : data.results ?? [];
  return entries.map(mapApiTimelineItem);
}

export async function fetchDashboardStats(): Promise<StudioDashboardStats> {
  const [items, recentActivity] = await Promise.all([
    fetchContentList(),
    fetchTimeline({ limit: 8 }),
  ]);

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
    recentActivity,
  };
}

/* ─────────────────────────────────────────────────
   Research API (separate service)
   ───────────────────────────────────────────────── */

const RESEARCH_API_BASE =
  process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? 'http://localhost:8001';

export interface ResearchTrailSource {
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
}

export interface ResearchTrailBacklink {
  contentType: string;
  contentSlug: string;
  contentTitle: string;
  sharedSources: Array<{ sourceId: number; sourceTitle: string }>;
}

export interface ResearchTrailThreadEntry {
  entryType: string;
  date: string;
  title: string;
  description: string;
  sourceTitle: string;
}

export interface ResearchTrailThread {
  title: string;
  slug: string;
  description: string;
  status: string;
  startedDate: string | null;
  entries: ResearchTrailThreadEntry[];
}

export interface ResearchTrail {
  slug: string;
  contentType: string;
  sources: ResearchTrailSource[];
  backlinks: ResearchTrailBacklink[];
  thread: ResearchTrailThread | null;
  mentions: Array<{
    sourceUrl: string;
    sourceTitle: string;
    sourceExcerpt: string;
    mentionType: string;
    createdAt: string;
  }>;
}

export class ResearchTimeoutError extends Error {
  constructor() {
    super('Research API request timed out');
    this.name = 'ResearchTimeoutError';
  }
}

export async function fetchResearchTrail(
  slug: string,
  timeoutMs = 5000,
): Promise<ResearchTrail | null> {
  try {
    const res = await fetch(`${RESEARCH_API_BASE}/api/v1/trail/${slug}/`, {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ResearchTimeoutError();
    }
    return null;
  }
}

/* ─────────────────────────────────────────────────
   Connections graph
   ───────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────
   Video production types and API functions
   ───────────────────────────────────────────────── */

export interface VideoProjectScene {
  id: number;
  order: number;
  title: string;
  sceneType: string;
  scriptText: string;
  wordCount: number;
  estimatedSeconds: number;
  scriptLocked: boolean;
  voRecorded: boolean;
  filmed: boolean;
  assembled: boolean;
  polished: boolean;
  notes: string;
}

export interface VideoProjectDeliverable {
  id: number;
  phase: string;
  deliverableType: string;
  filePath: string;
  fileUrl: string;
  notes: string;
  approved: boolean;
  createdAt: string;
}

export interface VideoProjectSession {
  id: number;
  phase: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  summary: string;
  subtasksCompleted: string[];
  nextAction: string;
  nextTool: string;
}

export interface EvidenceBoardRow {
  clue: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  nextAction: string;
  visual: string;
}

export interface VideoProject {
  slug: string;
  title: string;
  shortTitle: string;
  phase: string;
  phaseDisplay: string;
  phaseLockedThrough: string;
  thesis: string;
  sources: Array<{ title: string; url: string; type: string; role: string }>;
  researchNotes: string;
  scriptBody: string;
  scenes: VideoProjectScene[];
  deliverables: VideoProjectDeliverable[];
  sessions: VideoProjectSession[];
  evidenceBoard: EvidenceBoardRow[];
  linkedEssays: Array<{ slug: string; title: string }>;
  linkedFieldNotes: Array<{ slug: string; title: string }>;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeChapters: Array<{ timecode: string; label: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface VideoNextAction {
  video: string;
  phase: string;
  phaseName: string;
  progress: string;
  nextAction: string;
  nextTool: string;
  estimatedMinutes: number;
  doneWhen: string;
  context: string[];
}

export async function fetchVideoProjects(): Promise<VideoProject[]> {
  const data = await studioFetch<{ results: any[] }>('/api/videos/');
  return (data.results ?? []).map(mapVideoProject);
}

export async function fetchVideoProject(slug: string): Promise<VideoProject | null> {
  try {
    const data = await studioFetch<any>(`/api/videos/${slug}/`);
    return mapVideoProject(data);
  } catch {
    return null;
  }
}

export async function fetchVideoNextAction(slug: string): Promise<VideoNextAction | null> {
  try {
    return await studioFetch<VideoNextAction>(`/api/videos/${slug}/next-action/`);
  } catch {
    return null;
  }
}

export async function advanceVideoPhase(slug: string, force?: boolean): Promise<{ success: boolean; newPhase: string }> {
  return studioFetch(`/api/videos/${slug}/advance/`, {
    method: 'POST',
    body: JSON.stringify({ force: force ?? false }),
  });
}

export async function logVideoSession(
  slug: string,
  payload: {
    phase: string;
    started_at: string;
    ended_at?: string;
    summary: string;
    subtasks_completed?: string[];
    next_action?: string;
    next_tool?: string;
  },
): Promise<{ success: boolean; session: VideoProjectSession }> {
  return studioFetch(`/api/videos/${slug}/log-session/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateEvidenceBoard(
  slug: string,
  rows: EvidenceBoardRow[],
): Promise<{ success: boolean }> {
  return studioFetch(`/api/videos/${slug}/`, {
    method: 'PATCH',
    body: JSON.stringify({ evidence_board: rows }),
  });
}

function mapVideoProject(data: any): VideoProject {
  return {
    slug: data.slug,
    title: data.title,
    shortTitle: data.short_title ?? data.shortTitle ?? '',
    phase: data.phase ?? data.current_phase ?? '',
    phaseDisplay: data.phase_display ?? data.phaseDisplay ?? '',
    phaseLockedThrough: data.phase_locked_through ?? '',
    thesis: data.thesis ?? '',
    sources: data.sources ?? [],
    researchNotes: data.research_notes ?? '',
    scriptBody: data.script_body ?? '',
    scenes: (data.scenes ?? []).map((s: any) => ({
      id: s.id,
      order: s.order,
      title: s.title,
      sceneType: s.scene_type ?? s.sceneType ?? 'vo',
      scriptText: s.script_text ?? s.scriptText ?? '',
      wordCount: s.word_count ?? s.wordCount ?? 0,
      estimatedSeconds: s.estimated_seconds ?? s.estimatedSeconds ?? 0,
      scriptLocked: s.script_locked ?? s.scriptLocked ?? false,
      voRecorded: s.vo_recorded ?? s.voRecorded ?? false,
      filmed: s.filmed ?? false,
      assembled: s.assembled ?? false,
      polished: s.polished ?? false,
      notes: s.notes ?? '',
    })),
    deliverables: (data.deliverables ?? []).map((d: any) => ({
      id: d.id,
      phase: d.phase,
      deliverableType: d.deliverable_type ?? d.deliverableType ?? '',
      filePath: d.file_path ?? d.filePath ?? '',
      fileUrl: d.file_url ?? d.fileUrl ?? '',
      notes: d.notes ?? '',
      approved: d.approved ?? false,
      createdAt: d.created_at ?? d.createdAt ?? '',
    })),
    sessions: (data.sessions ?? []).map((s: any) => ({
      id: s.id,
      phase: s.phase,
      startedAt: s.started_at ?? s.startedAt ?? '',
      endedAt: s.ended_at ?? s.endedAt ?? null,
      durationMinutes: s.duration_minutes ?? s.durationMinutes ?? 0,
      summary: s.summary ?? '',
      subtasksCompleted: s.subtasks_completed ?? s.subtasksCompleted ?? [],
      nextAction: s.next_action ?? s.nextAction ?? '',
      nextTool: s.next_tool ?? s.nextTool ?? '',
    })),
    evidenceBoard: (data.evidence_board ?? data.evidenceBoard ?? []).map((r: any) => ({
      clue: r.clue ?? '',
      source: r.source ?? '',
      confidence: r.confidence ?? 'low',
      nextAction: r.nextAction ?? r.next_action ?? '',
      visual: r.visual ?? '',
    })),
    linkedEssays: data.linked_essays ?? data.linkedEssays ?? [],
    linkedFieldNotes: data.linked_field_notes ?? data.linkedFieldNotes ?? [],
    youtubeTitle: data.youtube_title ?? data.youtubeTitle ?? '',
    youtubeDescription: data.youtube_description ?? data.youtubeDescription ?? '',
    youtubeChapters: data.youtube_chapters ?? data.youtubeChapters ?? [],
    createdAt: data.created_at ?? data.createdAt ?? '',
    updatedAt: data.updated_at ?? data.updatedAt ?? '',
  };
}

/* ─────────────────────────────────────────────────
   Content search (for @mentions)
   ───────────────────────────────────────────────── */

export interface ContentSearchResult {
  id: string;
  label: string;
  contentType: string;
  slug: string;
}

export async function searchContent(query: string): Promise<ContentSearchResult[]> {
  if (query.length < 2) return [];
  try {
    const data = await studioFetch<{ results: ContentSearchResult[] }>(
      `/search/?q=${encodeURIComponent(query)}`,
    );
    return data.results ?? [];
  } catch {
    return [];
  }
}

/* ─────────────────────────────────────────────────
   Commonplace search
   ───────────────────────────────────────────────── */

export interface CommonplaceSearchResult {
  id: string;
  title: string;
  source: string;
  text: string;
  contentType: string;
}

export async function searchCommonplace(
  query: string,
): Promise<CommonplaceSearchResult[]> {
  if (!query.trim()) return [];
  try {
    const data = await studioFetch<{ results: CommonplaceSearchResult[] }>(
      `/commonplace/search/?q=${encodeURIComponent(query)}`,
    );
    return data.results ?? [];
  } catch {
    return [];
  }
}

/* ─────────────────────────────────────────────────
   Stash
   ───────────────────────────────────────────────── */

export interface ApiStashItem {
  id: number;
  text: string;
  created_at: string;
  sort_order: number;
}

export async function fetchStash(
  contentType: string,
  slug: string,
): Promise<ApiStashItem[]> {
  try {
    const data = await studioFetch<{ items: ApiStashItem[] }>(
      `/content/${contentType}/${slug}/stash/`,
    );
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function createStashItem(
  contentType: string,
  slug: string,
  text: string,
): Promise<ApiStashItem | null> {
  try {
    return await studioFetch<ApiStashItem>(
      `/content/${contentType}/${slug}/stash/`,
      { method: 'POST', body: JSON.stringify({ text }) },
    );
  } catch {
    return null;
  }
}

export async function deleteStashItem(
  contentType: string,
  slug: string,
  id: number,
): Promise<boolean> {
  try {
    await studioFetch(`/content/${contentType}/${slug}/stash/${id}/delete/`, {
      method: 'POST',
    });
    return true;
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────
   Tasks
   ───────────────────────────────────────────────── */

export interface ApiContentTask {
  id: number;
  text: string;
  done: boolean;
  done_at: string | null;
  created_at: string;
  ticktick_task_id: string;
  ticktick_project_id: string;
}

export async function fetchTasks(
  contentType: string,
  slug: string,
): Promise<ApiContentTask[]> {
  try {
    const data = await studioFetch<{ tasks: ApiContentTask[] }>(
      `/content/${contentType}/${slug}/tasks/`,
    );
    return data.tasks ?? [];
  } catch {
    return [];
  }
}

export async function createTask(
  contentType: string,
  slug: string,
  text: string,
): Promise<ApiContentTask | null> {
  try {
    return await studioFetch<ApiContentTask>(
      `/content/${contentType}/${slug}/tasks/`,
      { method: 'POST', body: JSON.stringify({ text }) },
    );
  } catch {
    return null;
  }
}

export async function updateTask(
  contentType: string,
  slug: string,
  id: number,
  payload: { done?: boolean; text?: string },
): Promise<ApiContentTask | null> {
  try {
    return await studioFetch<ApiContentTask>(
      `/content/${contentType}/${slug}/tasks/${id}/update/`,
      { method: 'POST', body: JSON.stringify(payload) },
    );
  } catch {
    return null;
  }
}

export async function deleteTask(
  contentType: string,
  slug: string,
  id: number,
): Promise<boolean> {
  try {
    await studioFetch(`/content/${contentType}/${slug}/tasks/${id}/delete/`, {
      method: 'POST',
    });
    return true;
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────
   All tasks (aggregate view)
   ───────────────────────────────────────────────── */

export interface TaskGroupItem {
  id: number;
  text: string;
  done: boolean;
  created_at: string;
}

export interface TaskGroup {
  content_type: string;
  content_slug: string;
  tasks: TaskGroupItem[];
}

export async function fetchAllTasks(
  includeDone = false,
): Promise<TaskGroup[]> {
  try {
    const qs = includeDone ? '?include_done=true' : '';
    const data = await studioFetch<{ groups: TaskGroup[] }>(
      `/tasks/all/${qs}`,
    );
    return data.groups;
  } catch {
    return [];
  }
}

/* ─────────────────────────────────────────────────
   Connections graph
   ───────────────────────────────────────────────── */

export async function fetchConnectionsGraph(params?: {
  limit?: number;
  maxEdges?: number;
}): Promise<StudioConnectionsGraph> {
  const search = new URLSearchParams();
  if (params?.limit) {
    search.set('limit', String(params.limit));
  }
  if (params?.maxEdges) {
    search.set('max_edges', String(params.maxEdges));
  }

  const query = search.toString();
  const data = await studioFetch<StudioApiConnectionsGraph>(
    `/connections/${query ? `?${query}` : ''}`,
  );

  return {
    nodes: data.nodes.map(mapApiConnectionsNode),
    edges: data.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      weight: edge.weight,
      reason: edge.reason,
    })),
    meta: {
      nodeCount: data.meta.node_count,
      edgeCount: data.meta.edge_count,
      generatedAt: data.meta.generated_at,
    },
  };
}

/* ── Mention Backlinks ────────────────────────── */

export interface MentionBacklink {
  sourceType: string;
  sourceSlug: string;
  sourceTitle: string;
}

export async function fetchMentionBacklinks(
  contentType: string,
  slug: string,
): Promise<MentionBacklink[]> {
  try {
    const data = await studioFetch<{ mentionedBy: MentionBacklink[] }>(
      `/mentions/${contentType}/${slug}/backlinks/`,
    );
    return data.mentionedBy ?? [];
  } catch {
    return [];
  }
}

/* ─────────────────────────────────────────────────
   Content Revisions
   ───────────────────────────────────────────────── */

export type RevisionSource = 'autosave' | 'manual' | 'stage' | 'restore';

export interface ContentRevisionSummary {
  id: number;
  revisionNumber: number;
  title: string;
  wordCount: number;
  label: string;
  source: RevisionSource;
  createdAt: string;
}

export interface ContentRevisionDetail extends ContentRevisionSummary {
  body: string;
}

export interface ContentRevisionDiff {
  revision: number;
  compareTo: number | null;
  diff: string[];
  wordCountDelta: number;
}

export interface RevisionRestoreResult {
  ok: boolean;
  restoredRevision: number;
  checkpointId: number;
  checkpointRevision: number;
  title: string;
  body: string;
}

export async function fetchRevisions(
  contentType: string,
  slug: string,
): Promise<ContentRevisionSummary[]> {
  try {
    const data = await studioFetch<{
      revisions: Array<{
        id: number;
        revision_number: number;
        title: string;
        word_count: number;
        label: string;
        source: RevisionSource;
        created_at: string;
      }>;
    }>(`/content/${contentType}/${slug}/revisions/`);
    return (data.revisions ?? []).map((r) => ({
      id: r.id,
      revisionNumber: r.revision_number,
      title: r.title,
      wordCount: r.word_count,
      label: r.label,
      source: r.source,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

export async function fetchRevision(
  contentType: string,
  slug: string,
  revisionId: number,
): Promise<ContentRevisionDetail | null> {
  try {
    const r = await studioFetch<{
      id: number;
      revision_number: number;
      title: string;
      body: string;
      word_count: number;
      label: string;
      source: RevisionSource;
      created_at: string;
    }>(`/content/${contentType}/${slug}/revisions/${revisionId}/`);
    return {
      id: r.id,
      revisionNumber: r.revision_number,
      title: r.title,
      body: r.body,
      wordCount: r.word_count,
      label: r.label,
      source: r.source,
      createdAt: r.created_at,
    };
  } catch {
    return null;
  }
}

export async function fetchRevisionDiff(
  contentType: string,
  slug: string,
  revisionId: number,
  compareToId?: number,
): Promise<ContentRevisionDiff | null> {
  try {
    const qs = compareToId ? `?compare_to=${compareToId}` : '';
    const data = await studioFetch<{
      revision: number;
      compare_to: number | null;
      diff: string[];
      word_count_delta: number;
    }>(`/content/${contentType}/${slug}/revisions/${revisionId}/diff/${qs}`);
    return {
      revision: data.revision,
      compareTo: data.compare_to,
      diff: data.diff,
      wordCountDelta: data.word_count_delta,
    };
  } catch {
    return null;
  }
}

export async function createRevision(
  contentType: string,
  slug: string,
  payload: {
    title: string;
    body: string;
    source?: RevisionSource;
    label?: string;
  },
): Promise<ContentRevisionSummary | null> {
  try {
    const r = await studioFetch<{
      id: number;
      revision_number: number;
      title: string;
      word_count: number;
      source: RevisionSource;
      label: string;
      created_at: string;
    }>(`/content/${contentType}/${slug}/revisions/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      id: r.id,
      revisionNumber: r.revision_number,
      title: r.title,
      wordCount: r.word_count,
      source: r.source,
      label: r.label,
      createdAt: r.created_at,
    };
  } catch {
    return null;
  }
}

export async function restoreRevision(
  contentType: string,
  slug: string,
  revisionId: number,
): Promise<RevisionRestoreResult | null> {
  try {
    const data = await studioFetch<{
      ok: boolean;
      restored_revision: number;
      checkpoint_id: number;
      checkpoint_revision: number;
      title: string;
      body: string;
    }>(`/content/${contentType}/${slug}/revisions/${revisionId}/restore/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return {
      ok: data.ok,
      restoredRevision: data.restored_revision,
      checkpointId: data.checkpoint_id,
      checkpointRevision: data.checkpoint_revision,
      title: data.title,
      body: data.body,
    };
  } catch {
    return null;
  }
}

/* ── Publish ──────────────────────────────────────────────── */

export interface PublishResult {
  success: boolean;
  commitSha: string;
  commitUrl: string;
  error: string;
}

export async function publishContent(
  contentType: string,
  slug: string,
): Promise<PublishResult> {
  try {
    const data = await studioFetch<{
      success: boolean;
      commit_sha: string;
      commit_url: string;
      error: string;
    }>(`/content/${contentType}/${slug}/publish/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return {
      success: data.success,
      commitSha: data.commit_sha,
      commitUrl: data.commit_url,
      error: data.error,
    };
  } catch (err) {
    return {
      success: false,
      commitSha: '',
      commitUrl: '',
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
