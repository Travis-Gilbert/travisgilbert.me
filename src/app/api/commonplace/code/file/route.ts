import { execFile } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, open, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { auth } from '@/lib/auth';
import { confineToWorkspace } from '@/lib/commonplace-code-git';

/**
 * CommonPlace code workspace file API (HANDOFF-CODE-SURFACE-UI D7 seam).
 *
 * GET  ?path=<relative path>  -> { ok, path, content, truncated }
 * PUT  { path, content }      -> { ok, path, gitStatus }
 *
 * Reads and writes stay inside the workspace root (same resolution as the
 * status route: COMMONPLACE_CODE_WORKSPACE_ROOT or process.cwd(), realpathed).
 * Reads over the byte budget come back truncated (and the editor opens them
 * read-only). The write path is what makes notify re-ingest: the desktop
 * runtime's watcher sees the write; no extra call is made here.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 4_000;
const GIT_MAX_BUFFER = 1024 * 1024;
const MAX_READ_BYTES = 2 * 1024 * 1024; // 2MB read budget

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function GET(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  const rel = new URL(request.url).searchParams.get('path') ?? '';
  const root = resolveWorkspaceRoot();
  const confined = confineToWorkspace(root, rel);
  if (!confined) {
    return Response.json(
      { ok: false, error: 'Path must stay inside the workspace root.' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const stats = await stat(confined.abs);
    if (!stats.isFile()) {
      return Response.json(
        { ok: false, error: 'Path is not a regular file.' },
        { status: 400, headers: NO_STORE },
      );
    }

    if (stats.size > MAX_READ_BYTES) {
      // Refuse the full read: hand back only the first budgeted bytes and flag it.
      const handle = await open(confined.abs, 'r');
      try {
        const buffer = Buffer.alloc(MAX_READ_BYTES);
        const { bytesRead } = await handle.read(buffer, 0, MAX_READ_BYTES, 0);
        return Response.json(
          {
            ok: true,
            path: confined.rel,
            content: buffer.subarray(0, bytesRead).toString('utf8'),
            truncated: true,
          },
          { headers: NO_STORE },
        );
      } finally {
        await handle.close();
      }
    }

    const content = await readFile(confined.abs, 'utf8');
    return Response.json(
      { ok: true, path: confined.rel, content, truncated: false },
      { headers: NO_STORE },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: errorMessage(error) },
      { status: isNotFound(error) ? 404 : 500, headers: NO_STORE },
    );
  }
}

export async function PUT(request: Request) {
  const denied = await requireOwner();
  if (denied) return denied;

  let body: { path?: unknown; content?: unknown };
  try {
    body = (await request.json()) as { path?: unknown; content?: unknown };
  } catch {
    return Response.json(
      { ok: false, error: 'Request body must be JSON with path and content.' },
      { status: 400, headers: NO_STORE },
    );
  }

  const rel = typeof body.path === 'string' ? body.path : '';
  const content = typeof body.content === 'string' ? body.content : null;
  const root = resolveWorkspaceRoot();
  const confined = confineToWorkspace(root, rel);
  if (!confined || content === null) {
    return Response.json(
      { ok: false, error: 'Path must stay inside the workspace root and content must be a string.' },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    await mkdir(path.dirname(confined.abs), { recursive: true });
    // This write IS the notify re-ingest trigger: the desktop runtime watcher
    // sees the file change on disk. No extra ingest call belongs here.
    return Response.json(
      { ok: true, path: confined.rel, gitStatus: await gitShortStatusLine(root, confined.rel) },
      { headers: NO_STORE },
    );
  } catch (error) {
    return Response.json(
      { ok: false, error: errorMessage(error) },
      { status: 500, headers: NO_STORE },
    );
  }
}

async function requireOwner(): Promise<Response | null> {
  const session = await auth();
  const isOwner = (session?.user as { isOwner?: boolean } | undefined)?.isOwner === true;
  if (isOwner) return null;
  return Response.json(
    { ok: false, error: 'Owner authentication is required for CommonPlace code workspace files.' },
    { status: 401, headers: NO_STORE },
  );
}

/** Same resolution the status route uses (commonplace-code-server). */
function resolveWorkspaceRoot(): string {
  const configured = process.env.COMMONPLACE_CODE_WORKSPACE_ROOT?.trim();
  const candidate = configured || process.cwd();
  if (!existsSync(candidate)) return candidate;
  return realpathSync(candidate);
}

/** The refreshed `git status --porcelain=v1` line for one file ('' = clean). */
async function gitShortStatusLine(root: string, relFromRoot: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', root, 'status', '--porcelain=v1', '--', relFromRoot],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER },
    );
    return stdout.split(/\r?\n/).find((line) => line.trim().length > 0)?.trimEnd() ?? '';
  } catch {
    return null; // not a git tree (or git absent): the save still succeeded
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
}
