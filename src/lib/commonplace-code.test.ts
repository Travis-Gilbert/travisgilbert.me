import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildCommonPlaceCodeBindingId,
  commonPlaceCodeRunElapsedMs,
  formatCodeElapsed,
  parseConnectorSourcesJson,
  parseGitPorcelainStatus,
  parseLastCommit,
  type CommonPlaceCodeRunRecord,
} from './commonplace-code';
import { confineToWorkspace } from './commonplace-code-git';
import { buildCodeCapabilities, buildCommonPlaceCodeStatus, type GitRunner } from './commonplace-code-server';

describe('commonplace code contract', () => {
  it('parses git porcelain status into file cards', () => {
    expect(parseGitPorcelainStatus(' M src/a.ts\nA  src/b.ts\n?? notes/new.md\nR  old.ts -> new.ts\n')).toEqual([
      {
        path: 'src/a.ts',
        status: 'modified',
        indexStatus: ' ',
        worktreeStatus: 'M',
        staged: false,
        unstaged: true,
        untracked: false,
      },
      {
        path: 'src/b.ts',
        status: 'added',
        indexStatus: 'A',
        worktreeStatus: ' ',
        staged: true,
        unstaged: false,
        untracked: false,
      },
      {
        path: 'notes/new.md',
        status: 'untracked',
        indexStatus: '?',
        worktreeStatus: '?',
        staged: false,
        unstaged: false,
        untracked: true,
      },
      {
        path: 'old.ts -> new.ts',
        status: 'renamed',
        indexStatus: 'R',
        worktreeStatus: ' ',
        staged: true,
        unstaged: false,
        untracked: false,
      },
    ]);
  });

  it('builds a stable code binding without leaking the raw root path', () => {
    const first = buildCommonPlaceCodeBindingId({
      conversationId: 'conversation 1',
      workspaceRoot: '/Users/travisgilbert/site',
      branch: 'Travis-Gilbert/code-surface',
    });
    const second = buildCommonPlaceCodeBindingId({
      conversationId: 'conversation 1',
      workspaceRoot: '/Users/travisgilbert/site',
      branch: 'Travis-Gilbert/code-surface',
    });

    expect(first).toBe(second);
    expect(first).toContain('commonplace:code:');
    expect(first).not.toContain('/Users/travisgilbert/site');
  });

  it('normalizes last commit and connector source records', () => {
    expect(parseLastCommit(['abc123', 'ship code surface', '2026-06-30T20:00:00Z'].join('\0'))).toEqual({
      hash: 'abc123',
      subject: 'ship code surface',
      authoredAt: '2026-06-30T20:00:00Z',
    });
    expect(parseConnectorSourcesJson(JSON.stringify([
      { id: 'github', label: 'GitHub', kind: 'connector', available: true, detail: 'installed' },
      { id: 'bad', label: 'Bad', kind: 'other', available: true },
    ]))).toEqual([
      { id: 'github', label: 'GitHub', kind: 'connector', available: true, detail: 'installed' },
    ]);
  });

  it('reports elapsed run time from real timestamps', () => {
    const run: CommonPlaceCodeRunRecord = {
      id: 'run',
      task: 'inspect',
      mode: 'plan',
      accessLevel: 'read',
      head: 'composed',
      state: 'running',
      startedAt: '2026-06-30T20:00:00.000Z',
      heads: [],
      events: [],
      diffs: [],
    };

    const elapsed = commonPlaceCodeRunElapsedMs(run, Date.parse('2026-06-30T20:01:09.000Z'));
    expect(elapsed).toBe(69_000);
    expect(formatCodeElapsed(elapsed)).toBe('1m 09s');
  });
});

describe('commonplace code server status', () => {
  it('reads git state through the injected git runner', async () => {
    const git: GitRunner = async (_cwd, args) => {
      const key = args.join(' ');
      if (key === 'rev-parse --is-inside-work-tree') return 'true\n';
      if (key === 'rev-parse --show-toplevel') return '/repo/commonplace\n';
      if (key === 'rev-parse --abbrev-ref HEAD') return 'main\n';
      if (key === 'status --porcelain=v1') return ' M src/app.ts\n';
      if (key === 'log -1 --pretty=format:%h%x00%s%x00%aI') return ['abc123', 'latest work', '2026-06-30T20:00:00Z'].join('\0');
      throw new Error(`unexpected git args ${key}`);
    };

    const status = await buildCommonPlaceCodeStatus({
      cwd: '/repo/commonplace',
      env: {},
      now: new Date('2026-06-30T21:00:00.000Z'),
      git,
    });

    expect(status.workspace).toMatchObject({
      root: '/repo/commonplace',
      project: 'commonplace',
      branch: 'main',
    });
    expect(status.git.changedFiles).toHaveLength(1);
    expect(status.git.lastCommit?.subject).toBe('latest work');
    expect(status.capabilities.runChannel.available).toBe(false);
    expect(status.capabilities.commitPush.available).toBe(true);
    expect(status.sources).toEqual([]);
  });

  it('marks runtime capabilities available only when configured', () => {
    const capabilities = buildCodeCapabilities({
      COMMONPLACE_RUN_CHANNEL_SSE_URL: 'http://runtime.local/runs',
      COMMONPLACE_HEAD_ADAPTER_URL: 'http://runtime.local/heads',
      COMMONPLACE_TERMINAL_WS_URL: 'ws://runtime.local/terminal',
      COMMONPLACE_CODE_SOURCES_JSON: '[]',
    });

    expect(capabilities.runChannel.available).toBe(true);
    expect(capabilities.headAdapter.available).toBe(true);
    expect(capabilities.terminal.available).toBe(true);
    expect(capabilities.connectorRegistry.available).toBe(true);
    expect(capabilities.commitPush.available).toBe(false);
  });

  it('marks commit and push available when git is available', () => {
    const capabilities = buildCodeCapabilities({}, true);
    expect(capabilities.commitPush.available).toBe(true);
  });
});

describe('commonplace code workspace confinement', () => {
  it('rejects symlink targets outside the workspace for existing files and creates', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cp_code_root_'));
    const outside = mkdtempSync(path.join(tmpdir(), 'cp_code_outside_'));
    try {
      mkdirSync(path.join(root, 'safe'));
      writeFileSync(path.join(root, 'safe', 'kept.txt'), 'inside');
      writeFileSync(path.join(outside, 'secret.txt'), 'outside');
      symlinkSync(outside, path.join(root, 'out'));

      expect(confineToWorkspace(root, 'safe/new.txt')?.rel).toBe('safe/new.txt');
      expect(confineToWorkspace(root, 'safe/kept.txt')?.rel).toBe('safe/kept.txt');
      expect(confineToWorkspace(root, 'out/secret.txt')).toBeNull();
      expect(confineToWorkspace(root, 'out/new.txt')).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});
