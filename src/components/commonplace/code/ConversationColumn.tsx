'use client';

/**
 * ConversationColumn (HANDOFF-CODE-SURFACE-UI D3): the assistant-ui thread
 * and composer for the code surface, bound to the shared zustand store
 * (store.messages / store.runs). Follows CommonPlaceChatView's
 * ExternalStoreAdapter + AssistantRuntimeProvider pattern.
 *
 * Dispatch: on send it addMessage(user), creates a CommonPlaceCodeRunRecord
 * (queued, carrying the three composer controls mode/accessLevel/head),
 * calls runTheoremAgent the way CommonPlaceCodeView does today (mode 'ask',
 * composer mode embedded in the dispatched task), upsertRun through
 * running -> done/failed, then addMessage(assistant with the answer).
 * Invocation receipts from the result render as compact collapsible tool
 * rows registered through makeAssistantToolUI. Below each assistant turn
 * with a run, RunTranscript and DiffCards render inline in the thread flow.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FC,
} from 'react';
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  CompositeAttachmentAdapter,
  MessagePrimitive,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  ThreadPrimitive,
  makeAssistantToolUI,
  useAuiState,
  useExternalStoreRuntime,
  type AppendMessage,
  type ExternalStoreAdapter,
  type ThreadMessageLike,
  type ToolCallMessagePartComponent,
} from '@assistant-ui/react';
import * as Select from '@radix-ui/react-select';
import { ArrowUp, Check, ChevronDown, ChevronRight, Square } from 'lucide-react';
import { MarkdownText } from '@/components/assistant-ui/markdown-text';
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from '@/components/assistant-ui/attachment';
import { WeaveSpinner } from '@/components/commonplace/views/WeaveSpinner';
import { useCodeSurfaceStore, type CodeChatMessage } from '@/lib/code-surface-store';
import {
  COMMONPLACE_CODE_TENANT,
  buildCommonPlaceCodeBindingId,
  newCommonPlaceCodeRunId,
  type CommonPlaceCodeAccessLevel,
  type CommonPlaceCodeHead,
  type CommonPlaceCodeMode,
  type CommonPlaceCodeRunRecord,
  type CommonPlaceCodeStatus,
} from '@/lib/commonplace-code';
import { runTheoremAgent } from '@/lib/theorem-agent';
import { RunTranscript, stopRunLocally } from './RunTranscript';
import { DiffCards } from './DiffCards';

const DISPATCH_TIMEOUT_MS = 120_000;
const MAX_TOOL_ROWS = 24;

/* ------------------------------------------------------------------ */
/* Tool rows: compact collapsible monospace rows (rows, not cards).     */
/* ------------------------------------------------------------------ */

interface CodeToolReceipt {
  toolCallId: string;
  toolName: string;
  argsText?: string;
  result?: unknown;
}

const CodeToolRow: ToolCallMessagePartComponent = ({ toolName, argsText, result }) => {
  const [open, setOpen] = useState(false);
  const summary = toolRowSummary(result, argsText);

  return (
    <div
      style={{
        borderTop: 'var(--hairline)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text--1)',
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: 'var(--space-2) 0',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 'inherit',
          textAlign: 'left',
        }}
      >
        <ChevronRight
          aria-hidden
          style={{
            width: 'var(--space-3)',
            height: 'var(--space-3)',
            flexShrink: 0,
            color: 'var(--text-faint)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform var(--motion-fast) var(--ease)',
          }}
        />
        <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>{toolName}</span>
        <span
          style={{
            color: 'var(--text-faint)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {summary}
        </span>
      </button>
      {open && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            padding: '0 0 var(--space-2) var(--space-5)',
          }}
        >
          {argsText && <ToolRowBlock label="input" text={argsText} />}
          {result !== undefined && <ToolRowBlock label="result" text={toolRowText(result)} />}
        </div>
      )}
    </div>
  );
};

function ToolRowBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div style={{ color: 'var(--text-faint)', fontSize: 'var(--text--2)' }}>{label}</div>
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text--2)',
          color: 'var(--text-dim)',
          maxHeight: 'calc(var(--space-13) * 3)',
          overflow: 'auto',
        }}
      >
        {text}
      </pre>
    </div>
  );
}

function toolRowText(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toolRowSummary(result: unknown, argsText?: string): string {
  const source = typeof result === 'string' && result.trim() ? result : argsText ?? '';
  const line = source.split('\n').find((entry) => entry.trim().length > 0);
  return line?.trim() ?? 'invocation receipt';
}

// makeAssistantToolUI is per-tool-name; receipts carry dynamic affordance
// names, so tool UI components are created lazily per name and cached.
const toolUiCache = new Map<string, FC>();
function getToolUi(toolName: string): FC {
  let ui = toolUiCache.get(toolName);
  if (!ui) {
    ui = makeAssistantToolUI({ toolName, render: CodeToolRow });
    toolUiCache.set(toolName, ui);
  }
  return ui;
}

/* ------------------------------------------------------------------ */
/* Invocation receipt extraction from the Theorem agent raw response.   */
/* Only real receipts render; when none are found, nothing renders.     */
/* ------------------------------------------------------------------ */

function extractToolReceipts(raw: unknown): CodeToolReceipt[] {
  return findInvocationReceipts(raw, 0)
    .slice(0, MAX_TOOL_ROWS)
    .map((entry, index): CodeToolReceipt | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const toolName = firstString(record, [
        'affordance_id',
        'affordance',
        'tool_name',
        'tool',
        'name',
        'capability',
        'skill',
      ]);
      if (!toolName) return null;
      const args = record.input ?? record.args ?? record.arguments ?? record.request;
      const payload = asRecord(record.payload);
      const result =
        record.output_summary ??
        (typeof payload?.text === 'string' ? payload.text : undefined) ??
        record.output ??
        record.result;
      return {
        toolCallId: `receipt_${index}`,
        toolName,
        argsText: args === undefined ? undefined : toolRowText(args),
        result,
      };
    })
    .filter((entry): entry is CodeToolReceipt => entry !== null);
}

function findInvocationReceipts(value: unknown, depth: number): unknown[] {
  if (depth > 6 || value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findInvocationReceipts(item, depth + 1);
      if (found.length) return found;
    }
    return [];
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.invocation_receipts)) return record.invocation_receipts;
  for (const [key, entry] of Object.entries(record)) {
    if (key === 'text' && typeof entry === 'string' && entry.includes('invocation_receipts')) {
      try {
        const found = findInvocationReceipts(JSON.parse(entry) as unknown, depth + 1);
        if (found.length) return found;
      } catch {
        // Not JSON; skip.
      }
      continue;
    }
    const found = findInvocationReceipts(entry, depth + 1);
    if (found.length) return found;
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function ConversationColumn() {
  const conversationId = useCodeSurfaceStore((s) => s.conversationId);
  const messages = useCodeSurfaceStore((s) => s.messages);
  const status = useCodeSurfaceStore((s) => s.status);
  const mode = useCodeSurfaceStore((s) => s.mode);
  const accessLevel = useCodeSurfaceStore((s) => s.accessLevel);
  const head = useCodeSurfaceStore((s) => s.head);
  const setComposerControl = useCodeSurfaceStore((s) => s.setComposerControl);
  const activeRun = useCodeSurfaceStore(
    (s) => s.runs.find((run) => run.state === 'queued' || run.state === 'running') ?? null,
  );

  // Receipts and attachments live outside the store (its shape is frozen);
  // both are written before addMessage so conversion always sees them.
  const receiptsRef = useRef(new Map<string, CodeToolReceipt[]>());
  const attachmentsRef = useRef(new Map<string, AppendMessage['attachments']>());
  const [toolNames, setToolNames] = useState<string[]>([]);

  const bindingId = useMemo(
    () =>
      buildCommonPlaceCodeBindingId({
        conversationId,
        workspaceRoot: status?.workspace.root ?? 'unbound',
        branch: status?.workspace.branch,
      }),
    [conversationId, status?.workspace.branch, status?.workspace.root],
  );

  const onNew = useCallback(
    async (append: AppendMessage) => {
      const task = append.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join(' ')
        .trim();
      if (!task) return;

      const store = useCodeSurfaceStore.getState();
      if (store.runs.some((run) => run.state === 'queued' || run.state === 'running')) return;

      const runLocalId = newCommonPlaceCodeRunId();
      const startedAt = new Date().toISOString();
      // The three composer controls attach to the run.
      const run: CommonPlaceCodeRunRecord = {
        id: runLocalId,
        task,
        mode: store.mode,
        accessLevel: store.accessLevel,
        head: store.head as CommonPlaceCodeHead,
        state: 'queued',
        startedAt,
        heads: [],
        events: [
          {
            id: `${runLocalId}_event_1`,
            kind: 'status',
            label: 'Queued',
            detail: `mode=${store.mode} access=${store.accessLevel} head=${store.head}`,
            createdAt: startedAt,
          },
        ],
        diffs: [],
      };
      store.upsertRun(run);

      const userMessageId = `${runLocalId}_user`;
      if (append.attachments?.length) attachmentsRef.current.set(userMessageId, append.attachments);
      store.addMessage({
        id: userMessageId,
        role: 'user',
        content: task,
        createdAt: startedAt,
        runId: runLocalId,
      });

      const freshRun = () => useCodeSurfaceStore.getState().runs.find((r) => r.id === runLocalId);
      const running = freshRun();
      if (running) {
        useCodeSurfaceStore.getState().upsertRun({
          ...running,
          state: 'running',
          events: [
            ...running.events,
            {
              id: `${runLocalId}_event_2`,
              kind: 'trace',
              label: 'Dispatch',
              detail: 'Dispatched through the Theorem agent route.',
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }

      try {
        const result = await runTheoremAgent({
          task: buildDispatchedTask(task, status, store.mode, store.accessLevel, store.head),
          mode: 'ask',
          bindingId,
          tenant: COMMONPLACE_CODE_TENANT,
          requestTimeoutMs: DISPATCH_TIMEOUT_MS,
        });
        const settled = freshRun();
        if (!settled || settled.state === 'stopped') return; // stopped locally; drop the late result
        const endedAt = new Date().toISOString();
        useCodeSurfaceStore.getState().upsertRun({
          ...settled,
          state: 'done',
          endedAt,
          runId: result.runId ?? settled.runId,
          heads: result.heads.length ? result.heads : settled.heads,
          events: [
            ...settled.events,
            {
              id: `${runLocalId}_event_done`,
              kind: 'status',
              label: 'Done',
              detail: result.runId
                ? `Theorem returned run ${result.runId}.`
                : 'Theorem returned without a run id.',
              createdAt: endedAt,
            },
          ],
        });

        const receipts = extractToolReceipts(result.raw);
        if (receipts.length) {
          receiptsRef.current.set(runLocalId, receipts);
          setToolNames((prev) => {
            const merged = new Set(prev);
            for (const receipt of receipts) merged.add(receipt.toolName);
            return merged.size === prev.length ? prev : Array.from(merged);
          });
        }

        useCodeSurfaceStore.getState().addMessage({
          id: `${runLocalId}_assistant`,
          role: 'assistant',
          content: result.answer || 'Theorem completed the run without a model answer.',
          createdAt: endedAt,
          runId: runLocalId,
        });
      } catch (error) {
        const settled = freshRun();
        if (!settled || settled.state === 'stopped') return;
        const endedAt = new Date().toISOString();
        const message = error instanceof Error ? error.message : String(error);
        useCodeSurfaceStore.getState().upsertRun({
          ...settled,
          state: 'failed',
          endedAt,
          error: message,
          events: [
            ...settled.events,
            {
              id: `${runLocalId}_event_failed`,
              kind: 'status',
              label: 'Failed',
              detail: message,
              createdAt: endedAt,
            },
          ],
        });
        useCodeSurfaceStore.getState().addMessage({
          id: `${runLocalId}_assistant`,
          role: 'assistant',
          content: `Theorem agent error: ${message}`,
          createdAt: endedAt,
          runId: runLocalId,
        });
      }
    },
    [bindingId, status],
  );

  const onCancel = useCallback(async () => {
    const running = useCodeSurfaceStore
      .getState()
      .runs.find((run) => run.state === 'queued' || run.state === 'running');
    if (running) stopRunLocally(running.id);
  }, []);

  const convertMessage = useCallback((message: CodeChatMessage): ThreadMessageLike => {
    const receipts = message.runId ? receiptsRef.current.get(message.runId) : undefined;
    const content: ThreadMessageLike['content'] = [
      ...(message.role === 'assistant' && receipts
        ? receipts.map((receipt) => ({
            type: 'tool-call' as const,
            toolCallId: `${message.id}_${receipt.toolCallId}`,
            toolName: receipt.toolName,
            argsText: receipt.argsText,
            result: receipt.result,
          }))
        : []),
      { type: 'text' as const, text: message.content },
    ];
    return {
      role: message.role,
      id: message.id,
      createdAt: new Date(message.createdAt),
      content,
      attachments:
        message.role === 'user'
          ? (attachmentsRef.current.get(message.id) as ThreadMessageLike['attachments'])
          : undefined,
      metadata: { custom: { runLocalId: message.runId ?? null } },
      ...(message.role === 'assistant'
        ? { status: { type: 'complete' as const, reason: 'stop' as const } }
        : {}),
    };
  }, []);

  const attachmentAdapter = useMemo(
    () =>
      new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
      ]),
    [],
  );

  const adapter: ExternalStoreAdapter<CodeChatMessage> = useMemo(
    () => ({
      messages,
      isRunning: Boolean(activeRun),
      convertMessage,
      onNew,
      onCancel,
      adapters: { attachments: attachmentAdapter },
    }),
    [messages, activeRun, convertMessage, onNew, onCancel, attachmentAdapter],
  );
  const runtime = useExternalStoreRuntime(adapter);

  // CodeOmnibox prefill: cp-code-omnibox-task carries { task } to the composer.
  useEffect(() => {
    const handler = (event: Event) => {
      const task = (event as CustomEvent<{ task?: string }>).detail?.task;
      if (typeof task === 'string' && task.trim()) {
        runtime.thread.composer.setText(task);
      }
    };
    window.addEventListener('cp-code-omnibox-task', handler);
    return () => window.removeEventListener('cp-code-omnibox-task', handler);
  }, [runtime]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {toolNames.map((name) => {
        const ToolUi = getToolUi(name);
        return <ToolUi key={name} />;
      })}
      <ThreadPrimitive.Root
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
        }}
      >
        <ThreadPrimitive.Viewport
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            padding: 'var(--space-4) var(--space-4) var(--space-2)',
          }}
        >
          <ThreadPrimitive.Messages components={{ Message: ThreadMessage }} />

          {activeRun && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <WeaveSpinner size="compact" />
              <RunTranscript runId={activeRun.id} />
              <DiffCards runId={activeRun.id} />
            </div>
          )}
        </ThreadPrimitive.Viewport>

        <CodeComposer
          mode={mode}
          accessLevel={accessLevel}
          head={head}
          onControl={setComposerControl}
        />
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

export default ConversationColumn;

/* ------------------------------------------------------------------ */
/* Thread messages                                                      */
/* ------------------------------------------------------------------ */

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  if (role === 'user') return <UserMessage />;
  return <AssistantMessage />;
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-role="user"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 'var(--space-2)',
      }}
    >
      <UserMessageAttachments />
      <div
        style={{
          maxWidth: '85%',
          background: 'var(--surface-1)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-2) var(--space-3)',
          fontSize: 'var(--text-0)',
          color: 'var(--text)',
          overflowWrap: 'break-word',
        }}
      >
        <MessagePrimitive.Parts />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantMessage: FC = () => {
  const runLocalId = useAuiState(
    (s) => (s.message.metadata?.custom?.runLocalId as string | null | undefined) ?? null,
  );

  return (
    <MessagePrimitive.Root data-role="assistant" style={{ minWidth: 0 }}>
      <div style={{ color: 'var(--text)', fontSize: 'var(--text-0)', overflowWrap: 'break-word' }}>
        <MessagePrimitive.Parts
          components={{ Text: MarkdownText, tools: { Fallback: CodeToolRow } }}
        />
      </div>
      {runLocalId && (
        <>
          <RunTranscript runId={runLocalId} />
          <DiffCards runId={runLocalId} />
        </>
      )}
    </MessagePrimitive.Root>
  );
};

/* ------------------------------------------------------------------ */
/* Composer: quiet chrome, three Radix selects, attachments, send/stop. */
/* ------------------------------------------------------------------ */

function CodeComposer({
  mode,
  accessLevel,
  head,
  onControl,
}: {
  mode: CommonPlaceCodeMode;
  accessLevel: CommonPlaceCodeAccessLevel;
  head: string;
  onControl: (patch: {
    mode?: CommonPlaceCodeMode;
    accessLevel?: CommonPlaceCodeAccessLevel;
    head?: string;
  }) => void;
}) {
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const headOptions = useMemo(() => Array.from(new Set(['composed', head])), [head]);

  return (
    <ComposerPrimitive.Root
      style={{
        borderTop: 'var(--hairline)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-2) var(--space-4) var(--space-3)',
      }}
    >
      <div
        role="group"
        aria-label="Code run controls"
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
      >
        <ComposerSelect
          label="model"
          value={head}
          options={headOptions}
          onValueChange={(value) => onControl({ head: value })}
        />
        <ControlSeparator />
        <ComposerSelect
          label="access"
          value={accessLevel}
          options={['read']}
          onValueChange={(value) => onControl({ accessLevel: value as CommonPlaceCodeAccessLevel })}
        />
        <ControlSeparator />
        <ComposerSelect
          label="mode"
          value={mode}
          options={['plan', 'agent']}
          onValueChange={(value) => onControl({ mode: value as CommonPlaceCodeMode })}
        />
      </div>

      <ComposerAttachments />

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-2)' }}>
        <ComposerAddAttachment />
        <ComposerPrimitive.Input
          rows={1}
          maxRows={8}
          autoFocus
          aria-label="Code task input"
          placeholder="Describe the code task"
          style={{
            flex: 1,
            minWidth: 0,
            resize: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text--1)',
            color: 'var(--text)',
            lineHeight: 1.5,
            padding: 'var(--space-2) 0',
          }}
        />
        {!isRunning ? (
          <ComposerPrimitive.Send asChild>
            <button type="button" aria-label="Send code task" style={composerIconButtonStyle}>
              <ArrowUp aria-hidden style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
            </button>
          </ComposerPrimitive.Send>
        ) : (
          <ComposerPrimitive.Cancel asChild>
            <button
              type="button"
              aria-label="Stop run (local record only)"
              style={composerIconButtonStyle}
            >
              <Square
                aria-hidden
                fill="currentColor"
                style={{ width: 'var(--space-3)', height: 'var(--space-3)' }}
              />
            </button>
          </ComposerPrimitive.Cancel>
        )}
      </div>
    </ComposerPrimitive.Root>
  );
}

function ControlSeparator() {
  return <span aria-hidden style={{ alignSelf: 'stretch', borderLeft: 'var(--hairline)' }} />;
}

function ComposerSelect({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: string[];
  onValueChange: (value: string) => void;
}) {
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text--2)',
        color: 'var(--text-faint)',
      }}
    >
      {label}
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger
          aria-label={label}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            background: 'none',
            border: 'none',
            padding: 'var(--space-1) 0',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text--1)',
            color: 'var(--text-dim)',
          }}
        >
          <Select.Value />
          <Select.Icon asChild>
            <ChevronDown
              aria-hidden
              style={{
                width: 'var(--space-3)',
                height: 'var(--space-3)',
                color: 'var(--text-faint)',
              }}
            />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            style={{
              background: 'var(--surface-1)',
              border: 'var(--hairline)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-1)',
              zIndex: 60,
            }}
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  key={option}
                  value={option}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--text--1)',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <Select.ItemText>{option}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check
                      aria-hidden
                      style={{ width: 'var(--space-3)', height: 'var(--space-3)' }}
                    />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </label>
  );
}

const composerIconButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'var(--space-8)',
  height: 'var(--space-8)',
  flexShrink: 0,
  background: 'none',
  border: 'var(--hairline)',
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
  color: 'var(--text-dim)',
};

/* ------------------------------------------------------------------ */
/* Dispatch preamble: same shape as CommonPlaceCodeView today.          */
/* ------------------------------------------------------------------ */

function buildDispatchedTask(
  task: string,
  status: CommonPlaceCodeStatus | null,
  mode: CommonPlaceCodeMode,
  accessLevel: CommonPlaceCodeAccessLevel,
  head: string,
): string {
  return [
    'CommonPlace Code turn',
    `Workspace: ${status?.workspace.root ?? 'unbound'}`,
    `Branch: ${status?.workspace.branch ?? 'unknown'}`,
    `Mode: ${mode}`,
    `Access level: ${accessLevel}`,
    `Selected head: ${head}`,
    '',
    task,
  ].join('\n');
}
