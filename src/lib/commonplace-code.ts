export const COMMONPLACE_CODE_TENANT = 'Travis-Gilbert';
export const COMMONPLACE_CODE_BINDING_PREFIX = 'commonplace:code';

export type CommonPlaceCodeMode = 'plan' | 'agent';
export type CommonPlaceCodeAccessLevel = 'read';
export type CommonPlaceCodeHead = 'composed';
export type CommonPlaceCodeRunState = 'idle' | 'queued' | 'running' | 'done' | 'failed' | 'stopped';
export type CommonPlaceCodeEventKind = 'status' | 'trace' | 'diff';

export interface CommonPlaceCodeWorkspace {
  root: string;
  project: string;
  worktree: string;
  branch: string | null;
}

export interface CommonPlaceCodeChangedFile {
  path: string;
  status: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface CommonPlaceCodeCommit {
  hash: string;
  subject: string;
  authoredAt: string;
}

export interface CommonPlaceCodeGitState {
  available: boolean;
  branch: string | null;
  changedFiles: CommonPlaceCodeChangedFile[];
  shortStatus: string[];
  lastCommit: CommonPlaceCodeCommit | null;
  error?: string;
}

export interface CommonPlaceCodeChecks {
  available: boolean;
  status: 'unavailable' | 'unknown' | 'passing' | 'failing';
  label: string;
  detail?: string;
}

export interface CommonPlaceCodeReviewState {
  available: boolean;
  count: number | null;
  detail?: string;
}

export interface CommonPlaceCodeCapability {
  available: boolean;
  label: string;
  detail?: string;
}

export interface CommonPlaceCodeSource {
  id: string;
  label: string;
  kind: 'connector' | 'mcp' | 'agent' | 'runtime' | 'workspace';
  available: boolean;
  detail?: string;
}

export interface CommonPlaceCodeCapabilities {
  runChannel: CommonPlaceCodeCapability;
  headAdapter: CommonPlaceCodeCapability;
  terminal: CommonPlaceCodeCapability;
  commitPush: CommonPlaceCodeCapability;
  diffReviewUndo: CommonPlaceCodeCapability;
  connectorRegistry: CommonPlaceCodeCapability;
}

export interface CommonPlaceCodeStatus {
  ok: boolean;
  generatedAt: string;
  workspace: CommonPlaceCodeWorkspace;
  git: CommonPlaceCodeGitState;
  checks: CommonPlaceCodeChecks;
  review: CommonPlaceCodeReviewState;
  capabilities: CommonPlaceCodeCapabilities;
  sources: CommonPlaceCodeSource[];
}

export interface CommonPlaceCodeDiffCard {
  path: string;
  added: number;
  removed: number;
  summary: string;
}

export interface CommonPlaceCodeRunEvent {
  id: string;
  kind: CommonPlaceCodeEventKind;
  label: string;
  detail?: string;
  createdAt: string;
}

export interface CommonPlaceCodeRunRecord {
  id: string;
  task: string;
  mode: CommonPlaceCodeMode;
  accessLevel: CommonPlaceCodeAccessLevel;
  head: CommonPlaceCodeHead;
  state: CommonPlaceCodeRunState;
  startedAt: string;
  endedAt?: string;
  runId?: string;
  heads: string[];
  events: CommonPlaceCodeRunEvent[];
  diffs: CommonPlaceCodeDiffCard[];
  error?: string;
}

export function newCommonPlaceCodeConversationId(): string {
  return uniqueCodeId('cp_code_conversation');
}

export function newCommonPlaceCodeRunId(): string {
  return uniqueCodeId('cp_code_run');
}

export function buildCommonPlaceCodeBindingId(input: {
  conversationId: string;
  workspaceRoot: string;
  branch: string | null | undefined;
}): string {
  const workspaceHash = stableHash(input.workspaceRoot || 'unbound');
  const branch = compactSegment(input.branch || 'detached');
  const conversation = compactSegment(input.conversationId);
  return `${COMMONPLACE_CODE_BINDING_PREFIX}:${workspaceHash}:${branch}:${conversation}`;
}

export function parseGitPorcelainStatus(output: string): CommonPlaceCodeChangedFile[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const indexStatus = line[0] || ' ';
      const worktreeStatus = line[1] || ' ';
      const path = line.slice(3).trim();
      const untracked = indexStatus === '?' && worktreeStatus === '?';
      const staged = !untracked && indexStatus !== ' ';
      const unstaged = !untracked && worktreeStatus !== ' ';
      return {
        path,
        status: gitStatusLabel(indexStatus, worktreeStatus),
        indexStatus,
        worktreeStatus,
        staged,
        unstaged,
        untracked,
      };
    });
}

export function parseLastCommit(output: string): CommonPlaceCodeCommit | null {
  const [hash, subject, authoredAt] = output.trim().split('\0');
  if (!hash || !subject || !authoredAt) return null;
  return { hash, subject, authoredAt };
}

export function parseConnectorSourcesJson(raw: string | undefined): CommonPlaceCodeSource[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeSource(item))
      .filter((item): item is CommonPlaceCodeSource => item !== null);
  } catch {
    return [];
  }
}

export function formatCodeElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${remainder.toString().padStart(2, '0')}s`;
}

export function commonPlaceCodeRunElapsedMs(run: CommonPlaceCodeRunRecord, now = Date.now()): number {
  const started = Date.parse(run.startedAt);
  const ended = run.endedAt ? Date.parse(run.endedAt) : now;
  if (Number.isNaN(started) || Number.isNaN(ended)) return 0;
  return Math.max(0, ended - started);
}

function normalizeSource(item: unknown): CommonPlaceCodeSource | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const id = stringValue(record.id);
  const label = stringValue(record.label);
  const kind = sourceKind(record.kind);
  if (!id || !label || !kind) return null;
  return {
    id,
    label,
    kind,
    available: Boolean(record.available),
    detail: stringValue(record.detail),
  };
}

function sourceKind(value: unknown): CommonPlaceCodeSource['kind'] | null {
  if (
    value === 'connector' ||
    value === 'mcp' ||
    value === 'agent' ||
    value === 'runtime' ||
    value === 'workspace'
  ) {
    return value;
  }
  return null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function gitStatusLabel(indexStatus: string, worktreeStatus: string): string {
  if (indexStatus === '?' && worktreeStatus === '?') return 'untracked';
  const joined = `${indexStatus}${worktreeStatus}`;
  if (joined.includes('R')) return 'renamed';
  if (joined.includes('C')) return 'copied';
  if (joined.includes('D')) return 'deleted';
  if (joined.includes('A')) return 'added';
  if (joined.includes('M')) return 'modified';
  if (joined.includes('T')) return 'type changed';
  if (joined.includes('U')) return 'unmerged';
  return 'changed';
}

function compactSegment(value: string): string {
  const compact = value
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return compact || 'value';
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

function uniqueCodeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '_')}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
