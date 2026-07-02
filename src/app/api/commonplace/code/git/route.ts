/**
 * Owner-only git write actions for the CommonPlace code surface
 * (HANDOFF-CODE-SURFACE-UI D6). Modeled on ../status/route.ts.
 *
 * POST { action: "commit" | "push", message?: string }
 *   commit: git add -A && git commit -m <message> in the workspace root
 *   push:   git push
 * Returns the refreshed porcelain short status on success.
 */

import { execFile } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { promisify } from 'node:util';
import { auth } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 30_000;
const GIT_MAX_BUFFER = 1024 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

type GitAction = 'commit' | 'push';

interface GitActionBody {
  action?: unknown;
  message?: unknown;
}

export async function POST(request: Request) {
  const session = await auth();
  const isOwner = (session?.user as { isOwner?: boolean } | undefined)?.isOwner === true;
  if (!isOwner) {
    return Response.json(
      { ok: false, error: 'Owner authentication is required for CommonPlace code git actions.' },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: GitActionBody;
  try {
    body = (await request.json()) as GitActionBody;
  } catch {
    return Response.json(
      { ok: false, error: 'Request body must be JSON.' },
      { status: 400, headers: NO_STORE },
    );
  }

  const action = body.action;
  if (action !== 'commit' && action !== 'push') {
    return Response.json(
      { ok: false, error: 'action must be "commit" or "push".' },
      { status: 400, headers: NO_STORE },
    );
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (action === 'commit' && !message) {
    return Response.json(
      { ok: false, error: 'commit requires a non-empty message.' },
      { status: 400, headers: NO_STORE },
    );
  }

  const root = resolveWorkspaceRoot();

  try {
    const inside = (await git(root, ['rev-parse', '--is-inside-work-tree'])).trim();
    if (inside !== 'true') throw new Error('Workspace is not inside a git tree.');
    const topLevel = (await git(root, ['rev-parse', '--show-toplevel'])).trim() || root;

    if (action === 'commit') {
      await git(topLevel, ['add', '-A']);
      await git(topLevel, ['commit', '-m', message]);
    } else {
      await git(topLevel, ['push']);
    }

    const statusOutput = await git(topLevel, ['status', '--porcelain=v1']);
    return Response.json(
      {
        ok: true,
        action: action as GitAction,
        shortStatus: statusOutput.split(/\r?\n/).filter(Boolean),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: describeGitError(error) },
      { status: 500, headers: NO_STORE },
    );
  }
}

function resolveWorkspaceRoot(): string {
  const configured = process.env.COMMONPLACE_CODE_WORKSPACE_ROOT?.trim();
  const candidate = configured || process.cwd();
  if (!existsSync(candidate)) return candidate;
  return realpathSync(candidate);
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: GIT_MAX_BUFFER,
  });
  return stdout;
}

function describeGitError(error: unknown): string {
  if (error && typeof error === 'object') {
    const withStreams = error as { stderr?: unknown; stdout?: unknown; message?: unknown };
    const stderr = typeof withStreams.stderr === 'string' ? withStreams.stderr.trim() : '';
    const stdout = typeof withStreams.stdout === 'string' ? withStreams.stdout.trim() : '';
    if (stderr) return stderr;
    if (stdout) return stdout;
    if (typeof withStreams.message === 'string') return withStreams.message;
  }
  return String(error);
}
