'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useOwner } from '@/components/OwnerProvider';
import {
  COMMONPLACE_CODE_TENANT,
  buildCommonPlaceCodeBindingId,
  commonPlaceCodeRunElapsedMs,
  formatCodeElapsed,
  newCommonPlaceCodeConversationId,
  newCommonPlaceCodeRunId,
  type CommonPlaceCodeAccessLevel,
  type CommonPlaceCodeHead,
  type CommonPlaceCodeMode,
  type CommonPlaceCodeRunEvent,
  type CommonPlaceCodeRunRecord,
  type CommonPlaceCodeStatus,
} from '@/lib/commonplace-code';
import { runTheoremAgent } from '@/lib/theorem-agent';

type LoadState = 'idle' | 'loading' | 'ready' | 'locked' | 'error';

interface CodeMessage {
  id: string;
  role: 'human' | 'agent' | 'system';
  body: string;
  createdAt: string;
  runLocalId?: string;
}

const STATUS_ENDPOINT = '/api/commonplace/code/status';

export default function CommonPlaceCodeView() {
  const { isOwner } = useOwner();
  const [conversationId] = useState(() => newCommonPlaceCodeConversationId());
  const [status, setStatus] = useState<CommonPlaceCodeStatus | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [messages, setMessages] = useState<CodeMessage[]>([]);
  const [runs, setRuns] = useState<CommonPlaceCodeRunRecord[]>([]);
  const [composer, setComposer] = useState('');
  const [mode] = useState<CommonPlaceCodeMode>('plan');
  const [accessLevel, setAccessLevel] = useState<CommonPlaceCodeAccessLevel>('read');
  const [head, setHead] = useState<CommonPlaceCodeHead>('composed');
  const [now, setNow] = useState(() => Date.now());

  const activeRun = runs.find((run) => run.state === 'queued' || run.state === 'running') ?? null;
  const isRunning = Boolean(activeRun);

  const bindingId = useMemo(
    () => buildCommonPlaceCodeBindingId({
      conversationId,
      workspaceRoot: status?.workspace.root ?? 'unbound',
      branch: status?.workspace.branch,
    }),
    [conversationId, status?.workspace.branch, status?.workspace.root],
  );

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    if (!isOwner) {
      setLoadState('locked');
      setStatus(null);
      return;
    }
    setLoadState('loading');
    setLoadError(null);
    try {
      const response = await fetch(STATUS_ENDPOINT, {
        cache: 'no-store',
        signal,
      });
      if (response.status === 401) {
        setLoadState('locked');
        setStatus(null);
        return;
      }
      const payload = await response.json() as CommonPlaceCodeStatus | { error?: string };
      if (!response.ok || !('workspace' in payload)) {
        const message = 'error' in payload && payload.error
          ? payload.error
          : `Status request failed with ${response.status}`;
        throw new Error(message);
      }
      setStatus(payload);
      setLoadState('ready');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setLoadState('error');
      setStatus(null);
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [isOwner]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadStatus(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadStatus]);

  useEffect(() => {
    if (!isRunning) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const appendRunEvent = useCallback((runLocalId: string, event: Omit<CommonPlaceCodeRunEvent, 'id' | 'createdAt'>) => {
    setRuns((current) =>
      current.map((run) =>
        run.id === runLocalId
          ? {
              ...run,
              events: [
                ...run.events,
                {
                  ...event,
                  id: `${runLocalId}_event_${run.events.length + 1}`,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : run,
      ),
    );
  }, []);

  const updateRun = useCallback((runLocalId: string, updater: (run: CommonPlaceCodeRunRecord) => CommonPlaceCodeRunRecord) => {
    setRuns((current) => current.map((run) => (run.id === runLocalId ? updater(run) : run)));
  }, []);

  const submitRun = useCallback(async () => {
    const task = composer.trim();
    if (!task || isRunning || !status || !isOwner) return;

    const runLocalId = newCommonPlaceCodeRunId();
    const startedAt = new Date().toISOString();
    const run: CommonPlaceCodeRunRecord = {
      id: runLocalId,
      task,
      mode,
      accessLevel,
      head,
      state: 'queued',
      startedAt,
      heads: [],
      events: [
        {
          id: `${runLocalId}_event_1`,
          kind: 'status',
          label: 'Queued',
          detail: 'Plan mode submitted through the existing Theorem agent route.',
          createdAt: startedAt,
        },
      ],
      diffs: [],
    };

    setComposer('');
    setRuns((current) => [...current, run]);
    setMessages((current) => [
      ...current,
      {
        id: `${runLocalId}_human`,
        role: 'human',
        body: task,
        createdAt: startedAt,
        runLocalId,
      },
    ]);

    updateRun(runLocalId, (current) => ({ ...current, state: 'running' }));
    appendRunEvent(runLocalId, {
      kind: 'trace',
      label: 'Dispatch',
      detail: 'The web deployment is using Theorem agent API because no desktop RunRegistry SSE endpoint is exposed here.',
    });

    try {
      const result = await runTheoremAgent({
        task: buildDispatchedTask(task, status, mode, accessLevel, head),
        mode: 'ask',
        bindingId,
        tenant: COMMONPLACE_CODE_TENANT,
        requestTimeoutMs: 120_000,
      });
      const endedAt = new Date().toISOString();
      updateRun(runLocalId, (current) => ({
        ...current,
        state: 'done',
        endedAt,
        runId: result.runId,
        heads: result.heads,
        events: [
          ...current.events,
          {
            id: `${runLocalId}_event_${current.events.length + 1}`,
            kind: 'status',
            label: 'Done',
            detail: result.runId ? `Theorem returned run ${result.runId}.` : 'Theorem returned without a run id.',
            createdAt: endedAt,
          },
        ],
      }));
      setMessages((current) => [
        ...current,
        {
          id: `${runLocalId}_agent`,
          role: 'agent',
          body: result.answer || 'Theorem completed the run without a model answer.',
          createdAt: endedAt,
        },
      ]);
      void loadStatus();
    } catch (error) {
      const endedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      updateRun(runLocalId, (current) => ({
        ...current,
        state: 'failed',
        endedAt,
        error: message,
        events: [
          ...current.events,
          {
            id: `${runLocalId}_event_${current.events.length + 1}`,
            kind: 'status',
            label: 'Failed',
            detail: message,
            createdAt: endedAt,
          },
        ],
      }));
      setMessages((current) => [
        ...current,
        {
          id: `${runLocalId}_system`,
          role: 'system',
          body: message,
          createdAt: endedAt,
        },
      ]);
    }
  }, [
    accessLevel,
    appendRunEvent,
    bindingId,
    composer,
    head,
    isOwner,
    isRunning,
    loadStatus,
    mode,
    status,
    updateRun,
  ]);

  return (
    <div className="cp-code-screen">
      <CodeSidebar
        bindingId={bindingId}
        conversationId={conversationId}
        loadState={loadState}
        status={status}
      />

      <main className="cp-code-main" aria-label="CommonPlace code conversation">
        <header className="cp-code-header">
          <div>
            <div className="cp-code-kicker">CommonPlace Code</div>
            <h1>Code</h1>
          </div>
          <div className="cp-code-header-status">
            <span>{status?.workspace.branch ?? 'no branch'}</span>
            <code>{status?.workspace.project ?? 'workspace'}</code>
          </div>
        </header>

        <section className="cp-code-thread" aria-label="Run transcript">
          {loadState === 'locked' && (
            <div className="cp-code-empty">
              <strong>Owner access required.</strong>
              <span>Workspace branch, git status, and code runs are only exposed after owner sign in.</span>
              <Link href="/api/auth/signin">Sign in with GitHub</Link>
            </div>
          )}
          {loadState === 'error' && (
            <div className="cp-code-empty">
              <strong>Status request failed.</strong>
              <span>{loadError}</span>
              <button type="button" onClick={() => void loadStatus()}>
                Retry
              </button>
            </div>
          )}
          {loadState !== 'locked' && loadState !== 'error' && messages.length === 0 && (
            <div className="cp-code-empty">
              <strong>No code turn has started in this browser session.</strong>
              <span>Plan mode uses the existing Theorem agent route and binds the request to the workspace shown here.</span>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id}>
              <article className={`cp-code-message cp-code-message--${message.role}`}>
                <div className="cp-code-message-meta">
                  <span>{message.role === 'human' ? 'You' : message.role === 'agent' ? 'Theorem' : 'System'}</span>
                  <time>{formatClock(message.createdAt)}</time>
                </div>
                <p>{message.body}</p>
              </article>
              {message.runLocalId && (
                <RunTranscriptCard
                  run={runs.find((item) => item.id === message.runLocalId) ?? null}
                  now={now}
                  runtimeConnected={Boolean(status?.capabilities.runChannel.available)}
                />
              )}
            </div>
          ))}
        </section>

        <section className="cp-code-terminal" aria-label="Integrated terminal">
          <div>
            <span>Terminal</span>
            <strong>{status?.capabilities.terminal.available ? 'bridge configured' : 'bridge absent'}</strong>
          </div>
          <p>
            The deployed web surface has no interactive PTY bridge. The terminal belongs to the CommonPlace desktop runtime or a code server workspace.
          </p>
        </section>

        <form
          className="cp-code-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRun();
          }}
        >
          <div className="cp-code-composer-controls" aria-label="Code run controls">
            <div className="cp-code-segmented" aria-label="Run mode">
              <button type="button" className="is-active">
                Plan
              </button>
              <button type="button" disabled title="Agent mode needs the desktop run channel.">
                Agent
              </button>
            </div>

            <label>
              <span>Access</span>
              <select value={accessLevel} onChange={(event) => setAccessLevel(event.target.value as CommonPlaceCodeAccessLevel)}>
                <option value="read">Read workspace</option>
              </select>
            </label>

            <label>
              <span>Model</span>
              <select value={head} onChange={(event) => setHead(event.target.value as CommonPlaceCodeHead)}>
                <option value="composed">Composed Harness</option>
              </select>
            </label>
          </div>

          <label className="cp-code-input-label" htmlFor="cp-code-task">
            Code turn
          </label>
          <div className="cp-code-input-row">
            <textarea
              id="cp-code-task"
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void submitRun();
                }
              }}
              rows={4}
            />
            <button
              type="submit"
              disabled={!composer.trim() || isRunning || !status || !isOwner || loadState !== 'ready'}
            >
              {isRunning ? 'Running' : 'Run plan'}
            </button>
          </div>
        </form>
      </main>

      <EnvironmentPanel
        isOwner={isOwner}
        loadState={loadState}
        status={status}
        onRefresh={() => void loadStatus()}
      />
    </div>
  );
}

function CodeSidebar({
  bindingId,
  conversationId,
  loadState,
  status,
}: {
  bindingId: string;
  conversationId: string;
  loadState: LoadState;
  status: CommonPlaceCodeStatus | null;
}) {
  return (
    <aside className="cp-code-sidebar" aria-label="Code projects and sessions">
      <div className="cp-code-sidebar-title">Project</div>
      <div className="cp-code-project-card">
        <span>{status?.workspace.project ?? 'Workspace'}</span>
        <strong>{status?.workspace.branch ?? loadState}</strong>
        {status?.workspace.root && <code>{status.workspace.root}</code>}
      </div>

      <div className="cp-code-sidebar-title">Conversation</div>
      <div className="cp-code-session-card">
        <span>Current code thread</span>
        <code>{conversationId}</code>
        <small>{bindingId}</small>
      </div>
    </aside>
  );
}

function RunTranscriptCard({
  run,
  now,
  runtimeConnected,
}: {
  run: CommonPlaceCodeRunRecord | null;
  now: number;
  runtimeConnected: boolean;
}) {
  if (!run) return null;
  const elapsed = formatCodeElapsed(commonPlaceCodeRunElapsedMs(run, now));

  return (
    <article className={`cp-code-run cp-code-run--${run.state}`}>
      <div className="cp-code-run-header">
        <div>
          <span>Run transcript</span>
          <strong>{run.state}</strong>
        </div>
        <time>{elapsed}</time>
      </div>
      <dl className="cp-code-run-facts">
        <div>
          <dt>Mode</dt>
          <dd>{run.mode}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>{run.accessLevel}</dd>
        </div>
        <div>
          <dt>Head</dt>
          <dd>{run.head}</dd>
        </div>
      </dl>
      <div className="cp-code-event-list">
        {run.events.map((event) => (
          <div key={event.id} className={`cp-code-event cp-code-event--${event.kind}`}>
            <span>{event.kind}</span>
            <strong>{event.label}</strong>
            {event.detail && <p>{event.detail}</p>}
          </div>
        ))}
      </div>
      <div className="cp-code-diff-list">
        <div className="cp-code-diff-title">Diff events</div>
        {run.diffs.length ? (
          run.diffs.map((diff) => (
            <article key={diff.path} className="cp-code-diff-card">
              <strong>{diff.path}</strong>
              <span>{diff.added} added, {diff.removed} removed</span>
              <p>{diff.summary}</p>
            </article>
          ))
        ) : (
          <p>{runtimeConnected ? 'No Diff event arrived for this run.' : 'No desktop Diff stream is connected in this web deployment.'}</p>
        )}
      </div>
    </article>
  );
}

function EnvironmentPanel({
  isOwner,
  loadState,
  status,
  onRefresh,
}: {
  isOwner: boolean;
  loadState: LoadState;
  status: CommonPlaceCodeStatus | null;
  onRefresh: () => void;
}) {
  const changedFiles = status?.git.changedFiles ?? [];

  return (
    <aside className="cp-code-env" aria-label="Code environment">
      <div className="cp-code-env-header">
        <div>
          <span>Environment</span>
          <strong>{status?.git.available ? 'git ready' : loadState}</strong>
        </div>
        <button type="button" onClick={onRefresh} disabled={!isOwner || loadState === 'loading'}>
          Refresh
        </button>
      </div>

      <section className="cp-code-env-section">
        <h2>Workspace</h2>
        <dl>
          <div>
            <dt>Worktree</dt>
            <dd>{status?.workspace.worktree ?? 'unavailable'}</dd>
          </div>
          <div>
            <dt>Branch</dt>
            <dd>{status?.workspace.branch ?? 'unavailable'}</dd>
          </div>
          <div>
            <dt>Last commit</dt>
            <dd>{status?.git.lastCommit ? `${status.git.lastCommit.hash} ${status.git.lastCommit.subject}` : 'unavailable'}</dd>
          </div>
        </dl>
      </section>

      <section className="cp-code-env-section">
        <h2>Pending Changes</h2>
        {changedFiles.length ? (
          <ul className="cp-code-change-list">
            {changedFiles.map((file) => (
              <li key={`${file.status}:${file.path}`}>
                <span>{file.status}</span>
                <code>{file.path}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>{status?.git.available ? 'Working tree clean.' : status?.git.error ?? 'Git status unavailable.'}</p>
        )}
      </section>

      <section className="cp-code-env-section">
        <h2>Checks</h2>
        <p>{status?.checks.label ?? 'No check status.'}</p>
        {status?.checks.detail && <small>{status.checks.detail}</small>}
      </section>

      <section className="cp-code-env-section">
        <h2>Actions</h2>
        <p>{status?.capabilities.commitPush.detail ?? 'Commit and push need the desktop or owner git write path.'}</p>
        <p>{status?.capabilities.diffReviewUndo.detail ?? 'Review and undo need run Diff events.'}</p>
      </section>

      <section className="cp-code-env-section">
        <h2>Sources</h2>
        {status?.sources.length ? (
          <ul className="cp-code-source-list">
            {status.sources.map((source) => (
              <li key={source.id}>
                <span>{source.kind}</span>
                <strong>{source.label}</strong>
                <small>{source.available ? 'available' : 'unavailable'}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p>{status?.capabilities.connectorRegistry.detail ?? 'No connector registry loaded.'}</p>
        )}
      </section>

      <section className="cp-code-env-section">
        <h2>Review Comments</h2>
        <p>{status?.review.available ? `${status.review.count ?? 0} comments` : status?.review.detail ?? 'No review provider configured.'}</p>
      </section>
    </aside>
  );
}

function buildDispatchedTask(
  task: string,
  status: CommonPlaceCodeStatus,
  mode: CommonPlaceCodeMode,
  accessLevel: CommonPlaceCodeAccessLevel,
  head: CommonPlaceCodeHead,
): string {
  return [
    'CommonPlace Code turn',
    `Workspace: ${status.workspace.root}`,
    `Branch: ${status.workspace.branch ?? 'unknown'}`,
    `Mode: ${mode}`,
    `Access level: ${accessLevel}`,
    `Selected head: ${head}`,
    '',
    task,
  ].join('\n');
}

function formatClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
