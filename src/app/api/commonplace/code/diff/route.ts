/**
 * Per-file diff content for the CommonPlace code surface (D5).
 * Modeled on the status route: owner gated, git executed server-side from
 * the same workspace root. Returns the committed content (git show HEAD:path)
 * as `original` and the working tree file as `modified`. Binary or oversized
 * content answers { supported: false } instead of pretending a text diff.
 */

import { readFile } from 'node:fs/promises';
import { auth } from '@/lib/auth';
import {
  confineToWorkspace,
  looksBinary,
  resolveWorkspaceGitRoot,
  runWorkspaceGitBuffer,
} from '@/lib/commonplace-code-git';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DIFF_BYTES = 1_572_864; // 1.5 MiB per side; larger content is not reviewable inline.
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const session = await auth();
  const isOwner = (session?.user as { isOwner?: boolean } | undefined)?.isOwner === true;
  if (!isOwner) {
    return Response.json(
      { supported: false, error: 'Owner authentication is required for CommonPlace code diffs.' },
      { status: 401, headers: NO_STORE },
    );
  }

  const requested = new URL(request.url).searchParams.get('path');

  try {
    const root = await resolveWorkspaceGitRoot();
    const confined = confineToWorkspace(root, requested);
    if (!confined) {
      return Response.json(
        { supported: false, error: 'The requested path is missing or resolves outside the workspace root.' },
        { status: 400, headers: NO_STORE },
      );
    }

    const [original, modified] = await Promise.all([
      runWorkspaceGitBuffer(root, ['show', `HEAD:${confined.rel}`]).catch(() => null),
      readFile(confined.abs).catch(() => null),
    ]);

    if (!original && !modified) {
      return Response.json(
        { supported: false, path: confined.rel, reason: 'The path has neither committed nor working tree content.' },
        { headers: NO_STORE },
      );
    }
    if ((original && looksBinary(original)) || (modified && looksBinary(modified))) {
      return Response.json(
        { supported: false, path: confined.rel, reason: 'Binary content; no text diff is available.' },
        { headers: NO_STORE },
      );
    }
    if ((original?.byteLength ?? 0) > MAX_DIFF_BYTES || (modified?.byteLength ?? 0) > MAX_DIFF_BYTES) {
      return Response.json(
        { supported: false, path: confined.rel, reason: 'The file is too large for an inline text diff.' },
        { headers: NO_STORE },
      );
    }

    return Response.json(
      {
        supported: true,
        path: confined.rel,
        original: original ? original.toString('utf8') : '',
        modified: modified ? modified.toString('utf8') : '',
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return Response.json(
      { supported: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: NO_STORE },
    );
  }
}
