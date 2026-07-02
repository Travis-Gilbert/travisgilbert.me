'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  acpAgentLabel,
  acpWorkspaceCwd,
  buildAcpWebSocketUrl,
  diffFromAcpUpdate,
  textFromAcpUpdate,
  type AcpAgentId,
  type AcpCommandApproval,
  type AcpCommandOutput,
  type AcpConnectionStatus,
  type AcpFileWriteReview,
  type AcpFrontendEvent,
} from '@/lib/commonplace-acp';
import {
  searchRustyWeb,
  type RustyWebSearchHit,
} from '@/lib/rustyweb-search';
import {
  runTheoremAgent,
  type TheoremAgentClaim,
  type TheoremAgentRunResult,
} from '@/lib/theorem-agent';
import AgentThreadOmnibar from './AgentThreadOmnibar';
import styles from './AgentThreadView.module.css';
import { WeaveSpinner } from './WeaveSpinner';

type ThreadItem =
  | {
      id: string;
      kind: 'message';
      role: 'user' | 'agent' | 'system';
      markdown: string;
    }
  | {
      id: string;
      kind: 'diff';
      title: string;
      diff: string;
    }
  | {
      id: string;
      kind: 'file_write';
      event: AcpFileWriteReview;
    }
  | {
      id: string;
      kind: 'command';
      event: AcpCommandApproval;
      output?: AcpCommandOutput['output'];
    }
  | {
      id: string;
      kind: 'tool';
      title: string;
      payload: unknown;
    };

interface AgentThreadViewProps {
  agentId?: AcpAgentId | string;
  agentMode?: 'api' | 'acp';
}

export default function AgentThreadView({
  agentId = 'theorem',
  agentMode,
}: AgentThreadViewProps) {
  const resolvedMode = agentMode ?? (agentId === 'theorem' || agentId === 'agent' ? 'api' : 'acp');
  const agentLabel = useMemo(
    () => (resolvedMode === 'api' ? 'CommonPlace' : acpAgentLabel(agentId)),
    [agentId, resolvedMode],
  );
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<AcpConnectionStatus>(
    resolvedMode === 'api' ? 'connected' : 'connecting',
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [composer, setComposer] = useState('');
  const [isSending, setIsSending] = useState(false);

  const addItem = useCallback((item: ThreadItem) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const send = useCallback((payload: unknown) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  const handleEvent = useCallback(
    (event: AcpFrontendEvent) => {
      if (event.type === 'session_started') {
        setSessionId(event.session_id);
        setStatus('connected');
        addItem({
          id: `started-${event.session_id}`,
          kind: 'message',
          role: 'system',
          markdown: `${acpAgentLabel(event.agent_id)} joined the workspace.`,
        });
        return;
      }

      if (event.type === 'session_update') {
        const diff = diffFromAcpUpdate(event.update);
        if (diff) {
          addItem({
            id: `diff-${Date.now()}`,
            kind: 'diff',
            title: 'Proposed change',
            diff,
          });
          return;
        }

        const text = textFromAcpUpdate(event.update);
        if (text) {
          setItems((prev) => {
            const last = prev[prev.length - 1];
            if (last?.kind === 'message' && last.role === 'agent') {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  markdown: `${last.markdown}${text}`,
                },
              ];
            }
            return [
              ...prev,
              {
                id: `agent-${Date.now()}`,
                kind: 'message',
                role: 'agent',
                markdown: text,
              },
            ];
          });
          return;
        }

        addItem({
          id: `tool-${Date.now()}`,
          kind: 'tool',
          title: 'Session update',
          payload: event.update,
        });
        return;
      }

      if (event.type === 'file_write_review') {
        addItem({
          id: `file-${event.review.request_id}`,
          kind: 'file_write',
          event,
        });
        return;
      }

      if (event.type === 'command_approval') {
        addItem({
          id: `cmd-${event.approval.terminal_id}`,
          kind: 'command',
          event,
        });
        return;
      }

      if (event.type === 'command_output') {
        setItems((prev) =>
          prev.map((item) =>
            item.kind === 'command' &&
            item.event.approval.terminal_id === event.output.terminal_id
              ? { ...item, output: event.output }
              : item,
          ),
        );
        return;
      }

      if (event.type === 'error') {
        addItem({
          id: `error-${Date.now()}`,
          kind: 'message',
          role: 'system',
          markdown: event.message,
        });
      }
    },
    [addItem],
  );

  useEffect(() => {
    if (resolvedMode === 'api') {
      wsRef.current = null;
      return;
    }

    const socket = new WebSocket(buildAcpWebSocketUrl());
    wsRef.current = socket;

    socket.onopen = () => {
      setStatus('connected');
      socket.send(
        JSON.stringify({
          type: 'start_session',
          agent_id: agentId,
          cwd: acpWorkspaceCwd(),
        }),
      );
    };
    socket.onmessage = (message) => {
      try {
        handleEvent(JSON.parse(message.data) as AcpFrontendEvent);
      } catch {
        addItem({
          id: `malformed-${Date.now()}`,
          kind: 'message',
          role: 'system',
          markdown: 'Received an unreadable ACP event.',
        });
      }
    };
    socket.onerror = () => {
      setStatus('offline');
    };
    socket.onclose = () => {
      setStatus((current) => (current === 'connected' ? 'offline' : current));
    };

    return () => {
      wsRef.current = null;
      socket.close();
    };
  }, [addItem, agentId, handleEvent, resolvedMode]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [items]);

  const sendPrompt = useCallback(async (options: { webSearch?: boolean; file?: File } = {}) => {
    if (isSending) return;
    const text = composer.trim();
    if (!text) return;
    const promptText = options.file
      ? `${text}\n\nAttached file: ${options.file.name}`
      : text;
    const activeSession = sessionId ?? 'pending';
    addItem({
      id: `user-${Date.now()}`,
      kind: 'message',
      role: 'user',
      markdown: promptText,
    });
    setComposer('');
    if (resolvedMode === 'api') {
      setStatus('connecting');
      setIsSending(true);
      try {
        const result = options.webSearch
          ? await runResearchPrompt(promptText)
          : await runTheoremAgent({ task: promptText, mode: 'ask' });
        addItem({
          id: `agent-${Date.now()}`,
          kind: 'message',
          role: 'agent',
          markdown: result.answer || 'I did not get an answer back.',
        });
      } catch (err) {
        addItem({
          id: `error-${Date.now()}`,
          kind: 'message',
          role: 'system',
          markdown:
            resolvedMode === 'api'
              ? 'I could not reach the agent right now. Check Accounts when you are ready to reconnect.'
              : err instanceof Error ? err.message : String(err),
        });
      } finally {
        setIsSending(false);
        setStatus('connected');
      }
      return;
    }

    const delivered = send({
      type: 'prompt',
      session_id: activeSession,
      text: options.webSearch ? `Search the web if available, then answer:\n\n${promptText}` : promptText,
    });
    if (!delivered) {
      addItem({
        id: `offline-${Date.now()}`,
        kind: 'message',
        role: 'system',
        markdown: 'ACP host is offline.',
      });
    }
  }, [addItem, composer, isSending, resolvedMode, send, sessionId]);

  const displayStatus =
    resolvedMode === 'api' && status !== 'connecting' ? 'connected' : status;

  return (
    <section className={`cp-agent-thread ${styles.thread}`} aria-label={`${agentLabel} agent thread`}>
      {resolvedMode === 'acp' ? (
        <header className="cp-agent-thread-header">
          <div>
            <h2>{agentLabel}</h2>
            <span className={`cp-agent-thread-status cp-agent-thread-status--${displayStatus}`}>
              {displayStatus}
            </span>
          </div>
          {sessionId && <code>{sessionId}</code>}
        </header>
      ) : null}

      <div ref={listRef} className={`cp-agent-thread-list ${styles.threadList}`}>
        {items.map((item) => (
          <ThreadCard
            key={item.id}
            item={item}
            onApproveCommand={(terminalId) =>
              send({ type: 'approve_command', session_id: sessionId, terminal_id: terminalId })
            }
            onDenyCommand={(terminalId) =>
              send({ type: 'deny_command', session_id: sessionId, terminal_id: terminalId })
            }
            onApproveFile={(requestId) =>
              send({ type: 'approve_file_write', session_id: sessionId, request_id: requestId })
            }
            onDenyFile={(requestId) =>
              send({ type: 'deny_file_write', session_id: sessionId, request_id: requestId })
            }
          />
        ))}
        {isSending ? (
          <article className={`cp-agent-message cp-agent-message--agent ${styles.pendingMessage}`}>
            <WeaveSpinner size="compact" />
          </article>
        ) : null}
      </div>

      <div className={styles.composerDock}>
        <AgentThreadOmnibar
          busy={isSending}
          value={composer}
          onChange={setComposer}
          onSubmit={(options) => sendPrompt(options)}
        />
      </div>
    </section>
  );
}

async function runResearchPrompt(task: string): Promise<TheoremAgentRunResult> {
  const search = await searchRustyWeb(task, {
    mode: 'web',
    limit: 8,
    providerLimit: 4,
    providerTimeoutMs: 4_000,
    requestTimeoutMs: 12_000,
  });
  return runTheoremAgent({
    mode: 'research',
    task: `Answer this question using the attached search evidence where it is useful. Question: ${task}`,
    claims: searchHitsToClaims(search.hits),
    requestTimeoutMs: 75_000,
  });
}

function searchHitsToClaims(hits: RustyWebSearchHit[]): TheoremAgentClaim[] {
  return hits.slice(0, 8).map((hit, index) => ({
    text: [hit.title, hit.snippet].filter(Boolean).join(': '),
    provenance: hit.url || hit.id || `search:${index + 1}`,
  }));
}

function ThreadCard({
  item,
  onApproveCommand,
  onDenyCommand,
  onApproveFile,
  onDenyFile,
}: {
  item: ThreadItem;
  onApproveCommand: (terminalId: string) => void;
  onDenyCommand: (terminalId: string) => void;
  onApproveFile: (requestId: string) => void;
  onDenyFile: (requestId: string) => void;
}) {
  if (item.kind === 'message') {
    return (
      <article className={`cp-agent-message cp-agent-message--${item.role}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.markdown}</ReactMarkdown>
      </article>
    );
  }

  if (item.kind === 'diff') {
    return (
      <article className="cp-agent-card cp-agent-card--diff">
        <div className="cp-agent-card-title">{item.title}</div>
        <pre>{item.diff}</pre>
      </article>
    );
  }

  if (item.kind === 'file_write') {
    const { review } = item.event;
    return (
      <article className="cp-agent-card cp-agent-card--file">
        <div className="cp-agent-card-title">File write</div>
        <code>{review.path}</code>
        <details>
          <summary>Proposed content</summary>
          <pre>{review.content}</pre>
        </details>
        <div className="cp-agent-card-actions">
          <button type="button" onClick={() => onApproveFile(review.request_id)}>
            Approve
          </button>
          <button type="button" onClick={() => onDenyFile(review.request_id)}>
            Deny
          </button>
        </div>
      </article>
    );
  }

  if (item.kind === 'command') {
    const { approval } = item.event;
    const commandLine = [approval.command, ...(approval.args ?? [])].join(' ');
    return (
      <article className="cp-agent-card cp-agent-card--command">
        <div className="cp-agent-card-title">Command request</div>
        <code>{commandLine}</code>
        {approval.cwd && <span className="cp-agent-card-meta">{approval.cwd}</span>}
        {!item.output ? (
          <div className="cp-agent-card-actions">
            <button type="button" onClick={() => onApproveCommand(approval.terminal_id)}>
              Approve
            </button>
            <button type="button" onClick={() => onDenyCommand(approval.terminal_id)}>
              Deny
            </button>
          </div>
        ) : (
          <details open>
            <summary>Output</summary>
            <pre>{[item.output.stdout, item.output.stderr].filter(Boolean).join('\n')}</pre>
          </details>
        )}
      </article>
    );
  }

  return (
    <article className="cp-agent-card">
      <div className="cp-agent-card-title">{item.title}</div>
      <pre>{JSON.stringify(item.payload, null, 2)}</pre>
    </article>
  );
}
