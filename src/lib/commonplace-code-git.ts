/**
 * Server-side git helpers shared by the CommonPlace code diff and revert
 * routes (HANDOFF-CODE-SURFACE-UI D5). Uses the same workspace-root
 * resolution as the status route (COMMONPLACE_CODE_WORKSPACE_ROOT or the
 * process cwd, realpathed, then the git toplevel) and confines every
 * requested path to that root via normalization plus a realpath check so a
 * route can never read or mutate files outside the workspace.
 */

import { execFile } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 4_000;
const GIT_MAX_BUFFER = 8 * 1024 * 1024;

export type EnvLike = Record<string, string | undefined>;

export async function runWorkspaceGit(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
  });
  return stdout;
}

export async function runWorkspaceGitBuffer(cwd: string, args: string[]): Promise<Buffer> {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
    encoding: 'buffer',
  });
  return stdout;
}

/** Mirror of the status route's root resolution, settled to the git toplevel. */
export async function resolveWorkspaceGitRoot(
  env: EnvLike = process.env,
  cwd: string = process.cwd(),
): Promise<string> {
  const configured = env.COMMONPLACE_CODE_WORKSPACE_ROOT?.trim();
  let candidate = configured || cwd;
  if (existsSync(candidate)) candidate = realpathSync(candidate);
  const toplevel = await runWorkspaceGit(candidate, ['rev-parse', '--show-toplevel'])
    .then((value) => value.trim())
    .catch(() => '');
  return toplevel || candidate;
}

export interface ConfinedPath {
  /** Absolute filesystem path inside the workspace root. */
  abs: string;
  /** Repo-relative path with forward slashes, usable in git pathspecs. */
  rel: string;
}

/**
 * Normalize a requested path and refuse anything that escapes the workspace
 * root: absolute paths, `..` traversal, NUL bytes, `.git` internals, and
 * symlinks whose real location is outside the root.
 */
export function confineToWorkspace(root: string, requested: unknown): ConfinedPath | null {
  if (typeof requested !== 'string') return null;
  const trimmed = requested.trim();
  if (!trimmed || trimmed.includes('\0')) return null;
  if (path.isAbsolute(trimmed)) return null;

  const abs = path.resolve(root, trimmed);
  const rel = path.relative(root, abs);
  if (!rel || rel === '.' || rel.startsWith('..') || path.isAbsolute(rel)) return null;

  const relPosix = rel.split(path.sep).join('/');
  if (relPosix === '.git' || relPosix.startsWith('.git/')) return null;

  if (existsSync(abs)) {
    try {
      const realRoot = realpathSync(root);
      const realAbs = realpathSync(abs);
      if (realAbs !== realRoot && !realAbs.startsWith(realRoot + path.sep)) return null;
    } catch {
      return null;
    }
  }

  return { abs, rel: relPosix };
}

const BINARY_SNIFF_BYTES = 8_192;

export function looksBinary(buffer: Buffer): boolean {
  const window = buffer.subarray(0, BINARY_SNIFF_BYTES);
  return window.includes(0);
}
