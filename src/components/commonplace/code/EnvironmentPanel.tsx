'use client';

/**
 * EnvironmentPanel (HANDOFF-CODE-SURFACE-UI D6): the right panel of the code
 * surface. Radix Collapsible sections over CommonPlaceCodeStatus. Every row
 * is dot/icon + text; an absent value collapses to nothing and an all-absent
 * section renders no header. Plumbing (binding id, worktree paths, bridge
 * state, capability details) renders only behind the developer toggle.
 */

import { useCallback, useState, type ReactNode } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';
import { Bot, ChevronRight, Cpu, Folder, MessageSquare, Plug, Server } from 'lucide-react';
import { useCodeSurfaceStore } from '@/lib/code-surface-store';
import {
  buildCommonPlaceCodeBindingId,
  type CommonPlaceCodeCapability,
  type CommonPlaceCodeChangedFile,
  type CommonPlaceCodeSource,
  type CommonPlaceCodeStatus,
} from '@/lib/commonplace-code';

const STATUS_ENDPOINT = '/api/commonplace/code/status';
const GIT_ENDPOINT = '/api/commonplace/code/git';

type GitAction = 'commit' | 'push';

export default function EnvironmentPanel() {
  const status = useCodeSurfaceStore((s) => s.status);
  const conversationId = useCodeSurfaceStore((s) => s.conversationId);
  const devToggle = useCodeSurfaceStore((s) => s.devToggle);
  const runtimeAvailable = useCodeSurfaceStore((s) => s.runtimeAvailable);
  const setDevToggle = useCodeSurfaceStore((s) => s.setDevToggle);
  const setStatus = useCodeSurfaceStore((s) => s.setStatus);
  const openTab = useCodeSurfaceStore((s) => s.openTab);

  const changedFiles = status?.git.changedFiles ?? [];
  const showWorktree = Boolean(status?.workspace.project || status?.git.branch);
  const showCommitPush = Boolean(status?.capabilities.commitPush.available);
  const showChecks = Boolean(status?.checks.available);
  const showComments = Boolean(status?.review.available && status.review.count !== null);
  const sources = status?.sources ?? [];

  return (
    <div className="cpcs-env">
      {showWorktree && status ? (
        <Section title="worktree">
          {status.workspace.project ? (
            <div className="cpcs-row">
              <span className="cpcs-dot" style={{ background: 'var(--accent)' }} aria-hidden />
              <span className="cpcs-mono">{status.workspace.project}</span>
            </div>
          ) : null}
          {status.git.branch ? (
            <div className="cpcs-row">
              <span className="cpcs-dot" style={{ background: 'var(--accent-agent)' }} aria-hidden />
              <span className="cpcs-mono">{status.git.branch}</span>
            </div>
          ) : null}
        </Section>
      ) : null}

      {changedFiles.length > 0 ? (
        <Section title="pending changes">
          {changedFiles.map((file) => (
            <button
              key={`${file.status}:${file.path}`}
              type="button"
              className="cpcs-row cpcs-row-btn"
              onClick={() =>
                openTab({ id: file.path, kind: 'file', label: fileBasename(file.path) })
              }
            >
              <span
                className="cpcs-dot"
                style={{ background: changeDotColor(file) }}
                aria-hidden
              />
              <span className="cpcs-mono" title={`${file.status}: ${file.path}`}>
                {file.path}
              </span>
            </button>
          ))}
        </Section>
      ) : null}

      {showCommitPush && status ? (
        <Section title="commit or push">
          <CommitPushRow onStatus={setStatus} />
        </Section>
      ) : null}

      {showChecks && status ? (
        <Section title="checks">
          <div className="cpcs-row">
            <span className="cpcs-dot" style={{ background: checksDotColor(status) }} aria-hidden />
            <span>{status.checks.status}</span>
          </div>
        </Section>
      ) : null}

      {showComments && status ? (
        <Section title="comments">
          <div className="cpcs-row">
            <MessageSquare className="cpcs-icon" aria-hidden />
            <span>{status.review.count} comments</span>
          </div>
        </Section>
      ) : null}

      {sources.length > 0 ? (
        <Section title="sources">
          {sources.map((source) => (
            <div key={source.id} className={source.available ? 'cpcs-row' : 'cpcs-row cpcs-row-dim'}>
              <SourceIcon kind={source.kind} />
              <span>{source.label}</span>
            </div>
          ))}
        </Section>
      ) : null}

      <div className="cpcs-env-foot">
        <button
          type="button"
          className="cpcs-quiet-btn"
          aria-pressed={devToggle}
          onClick={() => setDevToggle(!devToggle)}
        >
          developer
        </button>
        {devToggle ? (
          <div className="cpcs-plumbing">
            <span>
              binding{' '}
              {buildCommonPlaceCodeBindingId({
                conversationId,
                workspaceRoot: status?.workspace.root ?? 'unbound',
                branch: status?.workspace.branch ?? null,
              })}
            </span>
            {status?.workspace.root ? <span>root {status.workspace.root}</span> : null}
            {status?.workspace.worktree ? <span>worktree {status.workspace.worktree}</span> : null}
            <span>
              runtime{' '}
              {runtimeAvailable === null ? 'probing' : runtimeAvailable ? 'available' : 'unreachable'}
            </span>
            {status
              ? capabilityEntries(status).map(([key, capability]) => (
                  <span key={key}>
                    {key} {capability.available ? 'available' : 'absent'}
                    {capability.detail ? `: ${capability.detail}` : ''}
                  </span>
                ))
              : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- pieces */

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="cpcs-env-section">
      <Collapsible.Trigger className="cpcs-env-head">
        <ChevronRight className="cpcs-icon cpcs-env-chevron" aria-hidden />
        {title}
      </Collapsible.Trigger>
      <Collapsible.Content>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

function CommitPushRow({
  onStatus,
}: {
  onStatus: (status: CommonPlaceCodeStatus | null, error?: string | null) => void;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<GitAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAction = useCallback(
    async (action: GitAction) => {
      setBusy(action);
      setError(null);
      try {
        const response = await fetch(GIT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, message }),
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? `git ${action} failed (${response.status})`);
        }
        if (action === 'commit') setMessage('');
        const refreshed = await fetch(STATUS_ENDPOINT, { cache: 'no-store' });
        if (refreshed.ok) {
          const next = (await refreshed.json()) as CommonPlaceCodeStatus | { error?: string };
          if ('workspace' in next) onStatus(next);
        }
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : String(actionError));
      } finally {
        setBusy(null);
      }
    },
    [message, onStatus],
  );

  return (
    <div>
      <label className="cpcs-vh" htmlFor="cpcs-commit-message">
        Commit message
      </label>
      <input
        id="cpcs-commit-message"
        className="cpcs-commit-input"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="commit message"
        autoComplete="off"
      />
      <div className="cpcs-row">
        <button
          type="button"
          className="cpcs-quiet-btn"
          disabled={busy !== null || !message.trim()}
          onClick={() => void runAction('commit')}
        >
          {busy === 'commit' ? 'committing' : 'commit'}
        </button>
        <button
          type="button"
          className="cpcs-quiet-btn"
          disabled={busy !== null}
          onClick={() => void runAction('push')}
        >
          {busy === 'push' ? 'pushing' : 'push'}
        </button>
      </div>
      {error ? <p className="cpcs-quiet-line">{error}</p> : null}
    </div>
  );
}

function SourceIcon({ kind }: { kind: CommonPlaceCodeSource['kind'] }) {
  const Icon =
    kind === 'connector'
      ? Plug
      : kind === 'mcp'
        ? Server
        : kind === 'agent'
          ? Bot
          : kind === 'runtime'
            ? Cpu
            : Folder;
  return <Icon className="cpcs-icon" aria-hidden />;
}

/* --------------------------------------------------------------- helpers */

function fileBasename(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] || path;
}

/**
 * Status dot semantics: modifications on the surface accent, additions on the
 * memory accent, deletions on the danger tone (token optional in this seed;
 * the strong accent is the tokenized fallback).
 */
function changeDotColor(file: CommonPlaceCodeChangedFile): string {
  if (file.status === 'deleted' || file.status === 'unmerged') {
    return 'var(--danger, var(--accent-strong))';
  }
  if (file.untracked || file.status === 'added') return 'var(--accent-memory)';
  return 'var(--accent)';
}

function checksDotColor(status: CommonPlaceCodeStatus): string {
  if (status.checks.status === 'passing') return 'var(--accent-memory)';
  if (status.checks.status === 'failing') return 'var(--danger, var(--accent-strong))';
  return 'var(--text-faint)';
}

function capabilityEntries(
  status: CommonPlaceCodeStatus,
): [string, CommonPlaceCodeCapability][] {
  return Object.entries(status.capabilities) as [string, CommonPlaceCodeCapability][];
}
