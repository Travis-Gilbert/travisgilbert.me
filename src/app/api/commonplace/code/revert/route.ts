/**
 * Undo a working tree change for one file (D5). Owner gated, path confined
 * to the workspace root. Tracked files revert via a HEAD based git restore;
 * untracked added files are deleted (only plain files, and only when git
 * itself reports the path as untracked). The working tree change is what
 * re-triggers notify ingestion, so no extra call is made here.
 */

import { stat, unlink } from 'node:fs/promises';
import { auth } from '@/lib/auth';
import {
  confineToWorkspace,
  resolveWorkspaceGitRoot,
  runWorkspaceGit,
} from '@/lib/commonplace-code-git';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const session = await auth();
  const isOwner = (session?.user as { isOwner?: boolean } | undefined)?.isOwner === true;
  if (!isOwner) {
    return Response.json(
      { ok: false, error: 'Owner authentication is required to revert workspace files.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const body = (await request.json().catch(() => null)) as { path?: unknown } | null;

  try {
    const root = await resolveWorkspaceGitRoot();
    const confined = confineToWorkspace(root, body?.path);
    if (!confined) {
      return Response.json(
        { ok: false, error: 'The requested path is missing or resolves outside the workspace root.' },
        { status: 400, headers: NO_STORE },
      );
    }

    const porcelain = await runWorkspaceGit(root, ['status', '--porcelain=v1', '--', confined.rel]);
    const statusLine = porcelain.split(/\r?\n/).find((line) => line.trim().length > 0);
    if (!statusLine) {
      return Response.json(
        { ok: false, path: confined.rel, error: 'Git reports no working tree change for this path.' },
        { status: 409, headers: NO_STORE },
      );
    }

    const untracked = statusLine.startsWith('??');
    const stagedAddition = statusLine[0] === 'A';
    if (untracked) {
      const info = await stat(confined.abs).catch(() => null);
      if (!info || !info.isFile()) {
        return Response.json(
          { ok: false, path: confined.rel, error: 'Only plain untracked files can be deleted by revert.' },
          { status: 400, headers: NO_STORE },
        );
      }
      await unlink(confined.abs);
      return Response.json({ ok: true, path: confined.rel, action: 'deleted' }, { headers: NO_STORE });
    }

    if (stagedAddition) {
      await runWorkspaceGit(root, ['restore', '--staged', '--', confined.rel]);
      const info = await stat(confined.abs).catch(() => null);
      if (info && !info.isFile()) {
        return Response.json(
          { ok: false, path: confined.rel, error: 'Only plain added files can be deleted by revert.' },
          { status: 400, headers: NO_STORE },
        );
      }
      if (info) await unlink(confined.abs);
      return Response.json({ ok: true, path: confined.rel, action: 'deleted' }, { headers: NO_STORE });
    }

    await runWorkspaceGit(root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', confined.rel]);
    return Response.json({ ok: true, path: confined.rel, action: 'restore' }, { headers: NO_STORE });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: NO_STORE },
    );
  }
}
