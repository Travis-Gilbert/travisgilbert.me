import { execFile } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  parseConnectorSourcesJson,
  parseGitPorcelainStatus,
  parseLastCommit,
  type CommonPlaceCodeCapabilities,
  type CommonPlaceCodeChecks,
  type CommonPlaceCodeGitState,
  type CommonPlaceCodeReviewState,
  type CommonPlaceCodeSource,
  type CommonPlaceCodeStatus,
  type CommonPlaceCodeWorkspace,
} from '@/lib/commonplace-code';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 4_000;
const GIT_MAX_BUFFER = 1024 * 1024;

export interface CommonPlaceCodeStatusOptions {
  cwd?: string;
  env?: EnvLike;
  now?: Date;
  git?: GitRunner;
}

export type EnvLike = Record<string, string | undefined>;
export type GitRunner = (cwd: string, args: string[]) => Promise<string>;

export async function buildCommonPlaceCodeStatus(
  options: CommonPlaceCodeStatusOptions = {},
): Promise<CommonPlaceCodeStatus> {
  const env = options.env ?? process.env;
  const now = options.now ?? new Date();
  const workspaceRoot = resolveWorkspaceRoot(env, options.cwd ?? process.cwd());
  const git = options.git ?? runGit;
  const capabilities = buildCodeCapabilities(env);
  const sources = parseConnectorSourcesJson(env.COMMONPLACE_CODE_SOURCES_JSON);

  const gitState = await readGitState(workspaceRoot, git);
  const rootForWorkspace = gitState.available
    ? await git(workspaceRoot, ['rev-parse', '--show-toplevel']).catch(() => workspaceRoot)
    : workspaceRoot;

  return {
    ok: true,
    generatedAt: now.toISOString(),
    workspace: buildWorkspace(rootForWorkspace.trim() || workspaceRoot, gitState),
    git: gitState,
    checks: buildChecks(env),
    review: buildReviewState(env),
    capabilities,
    sources,
  };
}

export function buildCodeCapabilities(env: EnvLike = process.env): CommonPlaceCodeCapabilities {
  const runChannelUrl = firstEnv(env, [
    'COMMONPLACE_RUN_CHANNEL_SSE_URL',
    'COMMONPLACE_DESKTOP_RUNTIME_URL',
    'NEXT_PUBLIC_COMMONPLACE_RUN_CHANNEL_URL',
  ]);
  const headAdapterUrl = firstEnv(env, [
    'COMMONPLACE_HEAD_ADAPTER_URL',
    'THEOREM_HEAD_ADAPTER_URL',
  ]);
  const terminalUrl = firstEnv(env, [
    'COMMONPLACE_TERMINAL_WS_URL',
    'NEXT_PUBLIC_COMMONPLACE_TERMINAL_WS_URL',
  ]);
  const hasSources = Boolean(env.COMMONPLACE_CODE_SOURCES_JSON?.trim());

  return {
    runChannel: {
      available: Boolean(runChannelUrl),
      label: runChannelUrl ? 'Desktop run channel configured' : 'Desktop run channel absent',
      detail: runChannelUrl ? 'Trace, Diff, Status events can be proxied.' : 'This web deployment can only call the Theorem agent API.',
    },
    headAdapter: {
      available: Boolean(headAdapterUrl),
      label: headAdapterUrl ? 'Head adapter configured' : 'Head adapter absent',
      detail: headAdapterUrl ? 'Selected heads may be dispatched by the runtime.' : 'The web route does not expose CommandFactory wiring.',
    },
    terminal: {
      available: Boolean(terminalUrl),
      label: terminalUrl ? 'Terminal bridge configured' : 'Terminal bridge absent',
      detail: terminalUrl ? 'A PTY websocket is configured for this deployment.' : 'No interactive PTY bridge is exposed here.',
    },
    commitPush: {
      available: false,
      label: 'Git write actions absent',
      detail: 'Commit and push need an owner only mutation endpoint for this workspace.',
    },
    diffReviewUndo: {
      available: false,
      label: 'Diff mutation actions absent',
      detail: 'Review and undo need run channel Diff events plus file scoped git actions.',
    },
    connectorRegistry: {
      available: hasSources,
      label: hasSources ? 'Connector registry loaded' : 'Connector registry absent',
      detail: hasSources ? 'Sources came from COMMONPLACE_CODE_SOURCES_JSON.' : 'No connector registry is exposed to this web route.',
    },
  };
}

async function readGitState(root: string, git: GitRunner): Promise<CommonPlaceCodeGitState> {
  try {
    const inside = (await git(root, ['rev-parse', '--is-inside-work-tree'])).trim();
    if (inside !== 'true') throw new Error('Workspace is not inside a git tree.');
    const [branch, status, lastCommit] = await Promise.all([
      readBranch(root, git),
      git(root, ['status', '--porcelain=v1']),
      git(root, ['log', '-1', '--pretty=format:%h%x00%s%x00%aI']).catch(() => ''),
    ]);
    const shortStatus = status.split(/\r?\n/).filter(Boolean);
    return {
      available: true,
      branch,
      changedFiles: parseGitPorcelainStatus(status),
      shortStatus,
      lastCommit: parseLastCommit(lastCommit),
    };
  } catch (error) {
    return {
      available: false,
      branch: null,
      changedFiles: [],
      shortStatus: [],
      lastCommit: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readBranch(root: string, git: GitRunner): Promise<string | null> {
  const branch = (await git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  if (branch && branch !== 'HEAD') return branch;
  const commit = (await git(root, ['rev-parse', '--short', 'HEAD']).catch(() => '')).trim();
  return commit ? `detached ${commit}` : null;
}

function buildWorkspace(root: string, gitState: CommonPlaceCodeGitState): CommonPlaceCodeWorkspace {
  const project = path.basename(root) || 'workspace';
  return {
    root,
    project,
    worktree: project,
    branch: gitState.branch,
  };
}

function buildChecks(env: EnvLike): CommonPlaceCodeChecks {
  const label = env.COMMONPLACE_CODE_CHECKS_LABEL?.trim();
  const status = env.COMMONPLACE_CODE_CHECKS_STATUS?.trim();
  if (label && isCheckStatus(status)) {
    return {
      available: true,
      status,
      label,
      detail: env.COMMONPLACE_CODE_CHECKS_DETAIL?.trim() || undefined,
    };
  }
  return {
    available: false,
    status: 'unavailable',
    label: 'No CI provider configured',
    detail: 'The web deployment has no check status provider for this working tree.',
  };
}

function buildReviewState(env: EnvLike): CommonPlaceCodeReviewState {
  const rawCount = env.COMMONPLACE_CODE_REVIEW_COUNT?.trim();
  const count = rawCount ? Number.parseInt(rawCount, 10) : Number.NaN;
  if (Number.isFinite(count)) {
    return {
      available: true,
      count,
      detail: env.COMMONPLACE_CODE_REVIEW_DETAIL?.trim() || undefined,
    };
  }
  return {
    available: false,
    count: null,
    detail: 'No review comment provider is configured for this workspace.',
  };
}

function resolveWorkspaceRoot(env: EnvLike, cwd: string): string {
  const configured = env.COMMONPLACE_CODE_WORKSPACE_ROOT?.trim();
  const candidate = configured || cwd;
  if (!existsSync(candidate)) return candidate;
  return realpathSync(candidate);
}

function firstEnv(env: EnvLike, names: string[]): string | undefined {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

function isCheckStatus(value: string | undefined): value is CommonPlaceCodeChecks['status'] {
  return value === 'unknown' || value === 'passing' || value === 'failing' || value === 'unavailable';
}

async function runGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
  });
  return stdout;
}
