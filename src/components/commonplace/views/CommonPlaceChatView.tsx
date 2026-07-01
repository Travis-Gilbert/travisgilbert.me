'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ExternalStoreAdapter,
} from '@assistant-ui/react';
import { Thread } from '@/components/assistant-ui/thread';
import {
  COMMONPLACE_CHAT_TENANT,
  buildCommonPlaceChatBindingId,
  createCommonPlaceChatMessage,
  latestRunMessage,
  messageToThreadMessage,
  newConversationId,
  runMetadataFromResult,
  type CommonPlaceChatMessage,
} from '@/lib/commonplace-chat';
import { runTheoremAgent } from '@/lib/theorem-agent';

const SUGGESTED_TASKS = [
  'Summarize recent repository ingestion state for CommonPlace.',
  'What should I inspect next in this workspace?',
  'Turn the current CommonPlace thread into action items.',
];

export default function CommonPlaceChatView() {
  const [conversationId] = useState(() => newConversationId());
  const [messages, setMessages] = useState<CommonPlaceChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);

  const bindingId = useMemo(() => buildCommonPlaceChatBindingId(conversationId), [conversationId]);

  const submitTask = useCallback(
    async (task: string) => {
      const cleanTask = task.trim();
      if (!cleanTask || isRunningRef.current) return;

      isRunningRef.current = true;
      setIsRunning(true);

      const userMessage = createCommonPlaceChatMessage({
        role: 'user',
        content: cleanTask,
        conversationId,
        bindingId,
        tenant: COMMONPLACE_CHAT_TENANT,
      });
      setMessages((prev) => [...prev, userMessage]);

      try {
        const result = await runTheoremAgent({
          task: cleanTask,
          mode: 'ask',
          bindingId,
          tenant: COMMONPLACE_CHAT_TENANT,
        });
        const assistantMessage = createCommonPlaceChatMessage({
          role: 'assistant',
          content: result.answer || 'Theorem completed the run without a model answer.',
          conversationId,
          bindingId,
          tenant: COMMONPLACE_CHAT_TENANT,
          run: runMetadataFromResult(result, {
            bindingId,
            tenant: COMMONPLACE_CHAT_TENANT,
          }),
        });
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Theorem agent request failed.';
        setMessages((prev) => [
          ...prev,
          createCommonPlaceChatMessage({
            role: 'assistant',
            content: `Theorem agent error: ${message}`,
            conversationId,
            bindingId,
            tenant: COMMONPLACE_CHAT_TENANT,
            status: 'error',
          }),
        ]);
      } finally {
        isRunningRef.current = false;
        setIsRunning(false);
      }
    },
    [bindingId, conversationId],
  );

  const adapter: ExternalStoreAdapter<CommonPlaceChatMessage> = useMemo(
    () => ({
      messages,
      isRunning,
      convertMessage: messageToThreadMessage,
      onNew: async (appendMessage) => {
        const textParts = appendMessage.content.filter(
          (part): part is { type: 'text'; text: string } => part.type === 'text',
        );
        await submitTask(textParts.map((part) => part.text).join(' ').trim());
      },
      onCancel: async () => {
        isRunningRef.current = false;
        setIsRunning(false);
      },
    }),
    [isRunning, messages, submitTask],
  );
  const runtime = useExternalStoreRuntime(adapter);
  const latestRun = latestRunMessage(messages)?.run ?? null;

  return (
    <div className="cp-chat-screen">
      <header className="cp-chat-header">
        <div>
          <div className="cp-chat-kicker">Theorem Chat</div>
          <h1>CommonPlace</h1>
        </div>
        <div className="cp-chat-binding" aria-label="Current chat binding">
          <span>{COMMONPLACE_CHAT_TENANT}</span>
          <code>{bindingId}</code>
        </div>
      </header>

      <div className="cp-chat-layout">
        <section className="cp-chat-thread-shell theseus-root" aria-label="CommonPlace chat thread">
          <AssistantRuntimeProvider runtime={runtime}>
            <Thread />
          </AssistantRuntimeProvider>
        </section>

        <aside className="cp-chat-audit" aria-label="Run metadata">
          <div className="cp-chat-audit-section">
            <div className="cp-chat-audit-title">Run Channel</div>
            <dl className="cp-chat-run-list">
              <div>
                <dt>Tenant</dt>
                <dd>{COMMONPLACE_CHAT_TENANT}</dd>
              </div>
              <div>
                <dt>Binding</dt>
                <dd>{bindingId}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{isRunning ? 'running' : latestRun ? 'complete' : 'idle'}</dd>
              </div>
            </dl>
          </div>

          <div className="cp-chat-audit-section">
            <div className="cp-chat-audit-title">Latest Run</div>
            {latestRun ? (
              <dl className="cp-chat-run-list">
                <div>
                  <dt>Run ID</dt>
                  <dd>{latestRun.runId ?? 'not returned'}</dd>
                </div>
                <div>
                  <dt>Heads</dt>
                  <dd>{latestRun.heads.length ? latestRun.heads.join(', ') : 'not returned'}</dd>
                </div>
                <div>
                  <dt>Evidence</dt>
                  <dd>{latestRun.evidenceCount}</dd>
                </div>
                <div>
                  <dt>Claims</dt>
                  <dd>{latestRun.claimsCount}</dd>
                </div>
                <div>
                  <dt>Answer</dt>
                  <dd>{latestRun.answerKind ?? 'not returned'}</dd>
                </div>
              </dl>
            ) : (
              <p className="cp-chat-empty-note">No Theorem run has returned yet.</p>
            )}
          </div>

          <div className="cp-chat-audit-section">
            <div className="cp-chat-audit-title">Starts</div>
            <div className="cp-chat-suggestion-list">
              {SUGGESTED_TASKS.map((task) => (
                <button
                  key={task}
                  type="button"
                  onClick={() => void submitTask(task)}
                  disabled={isRunning}
                >
                  {task}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
