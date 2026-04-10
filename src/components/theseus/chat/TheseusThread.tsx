'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  MessagePrimitive,
  ComposerPrimitive,
} from '@assistant-ui/react';
import { MarkdownTextPrimitive } from '@assistant-ui/react-markdown';
import { useTheseusAssistantRuntime } from '@/lib/theseus-assistant-runtime';
import { useSwitchPanel } from '../PanelManager';
import type { ChatMessage as ChatMessageType } from './useChatHistory';
import VisualPreviewCard from './VisualPreviewCard';
import AskIdleHero from './AskIdleHero';
import GraphActivity from './GraphActivity';

interface TheseusThreadProps {
  messages: ChatMessageType[];
  isAsking: boolean;
  onSubmit: (query: string) => void;
}


/**
 * Context to expose raw ChatMessage data to assistant-ui rendered components.
 * assistant-ui manages its own message state; this context lets our custom
 * features (stage labels, evidence cards, actions, follow-ups) read the
 * original ChatMessage metadata that the runtime adapter preserved.
 *
 * Also tracks a render counter so each AssistantMessageComponent can
 * determine which theseus message it corresponds to.
 */
const RawMessagesContext = createContext<{
  messages: ChatMessageType[];
  claimNextIndex: () => number;
}>({ messages: [], claimNextIndex: () => 0 });

/**
 * TheseusThread: assistant-ui powered chat thread.
 *
 * Uses real assistant-ui components:
 *   - AssistantRuntimeProvider + useExternalStoreRuntime (adapter)
 *   - ThreadPrimitive.Root / Viewport / Messages / Empty
 *   - MessagePrimitive.Root / Content
 *   - ComposerPrimitive.Root / Input / Send / Cancel
 *   - MarkdownTextPrimitive from @assistant-ui/react-markdown
 *
 * Custom (not from assistant-ui):
 *   - Stage labels, evidence cards, follow-up pills, message actions
 *   - Welcome screen, "Explore in graph" button
 */
export default function TheseusThread({ messages, isAsking, onSubmit }: TheseusThreadProps) {
  const runtime = useTheseusAssistantRuntime({ messages, isAsking, onSubmit });

  // Track assistant message render index. Reset each render cycle.
  const indexRef = useRef(0);
  indexRef.current = 0;
  const claimNextIndex = useCallback(() => indexRef.current++, []);
  const ctxValue = useMemo(
    () => ({ messages, claimNextIndex }),
    [messages, claimNextIndex],
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <RawMessagesContext.Provider value={ctxValue}>
        <div className="theseus-thread">
          <ThreadPrimitive.Root>
            <ThreadPrimitive.Empty>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto' }}>
                <AskIdleHero onSubmit={onSubmit} />
                <GraphActivity />
              </div>
            </ThreadPrimitive.Empty>

            <ThreadPrimitive.Viewport className="theseus-thread-viewport">
              <div className="theseus-thread-messages">
                <ThreadPrimitive.Messages
                  components={{
                    UserMessage: UserMessageComponent,
                    AssistantMessage: AssistantMessageComponent,
                  }}
                />
              </div>
            </ThreadPrimitive.Viewport>

            {messages.length > 0 && (
              <TheseusComposerArea
                isDisabled={isAsking}
                onSubmit={onSubmit}
              />
            )}
          </ThreadPrimitive.Root>
        </div>
      </RawMessagesContext.Provider>
    </AssistantRuntimeProvider>
  );
}


/**
 * User message rendered via assistant-ui's MessagePrimitive.
 */
function UserMessageComponent() {
  return (
    <MessagePrimitive.Root className="theseus-msg theseus-msg-user">
      <div className="theseus-msg-bubble">
        <MessagePrimitive.Content
          components={{
            Text: ({ text }) => <p className="theseus-msg-text">{text}</p>,
          }}
        />
      </div>
    </MessagePrimitive.Root>
  );
}

/**
 * Assistant message rendered via assistant-ui's MessagePrimitive,
 * with custom Theseus features: stage labels, evidence cards, actions, follow-ups.
 */
function AssistantMessageComponent() {
  const ctx = useContext(RawMessagesContext);

  // Claim this assistant message's index. Each AssistantMessageComponent
  // calls this once during render to get its position in the theseus
  // message sequence. The counter resets each render cycle of TheseusThread.
  const indexRef = useRef(-1);
  if (indexRef.current === -1) {
    indexRef.current = ctx.claimNextIndex();
  }

  const theseusMessages = useMemo(
    () => ctx.messages.filter((m) => m.role === 'theseus'),
    [ctx.messages],
  );
  const rawMsg = theseusMessages[indexRef.current] ?? null;

  return (
    <MessagePrimitive.Root className="theseus-msg theseus-msg-assistant">
      <AssistantMessageInner rawMsg={rawMsg} />
    </MessagePrimitive.Root>
  );
}

/**
 * Inner assistant message content. Renders the assistant-ui markdown
 * plus all custom Theseus features (stage labels, evidence, actions, follow-ups).
 */
function AssistantMessageInner({ rawMsg }: { rawMsg: ChatMessageType | null }) {
  const switchPanel = useSwitchPanel();

  const isStreaming = rawMsg?.isStreaming ?? false;
  const stageLabel = rawMsg?.stageLabel;
  const response = rawMsg?.response;
  const error = rawMsg?.error;

  const evidenceSection = useMemo(() => {
    if (!response) return null;
    return response.sections.find((s) => s.type === 'evidence_path') ?? null;
  }, [response]);

  const objectsSection = useMemo(() => {
    if (!response) return null;
    return response.sections.find((s) => s.type === 'objects') ?? null;
  }, [response]);

  const followUps = response?.follow_ups;

  const handleCopy = useCallback(() => {
    if (rawMsg) navigator.clipboard.writeText(rawMsg.text);
  }, [rawMsg]);

  const handleExplore = useCallback(() => {
    if (!response) return;
    const ep = response.sections.find((s) => s.type === 'evidence_path');
    if (ep && 'nodes' in ep) {
      const pks = ep.nodes.map((n) => n.object_id).join(',');
      switchPanel('explorer');
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('explorer:focus-nodes', { detail: { nodeIds: pks.split(',') } }),
        );
      });
    }
  }, [response, switchPanel]);

  const handleFeedback = useCallback((positive: boolean) => {
    window.dispatchEvent(
      new CustomEvent('theseus:feedback', {
        detail: { query: response?.query, positive },
      }),
    );
  }, [response]);

  return (
    <>
      {/* Stage label: above content when no text yet, below when streaming */}
      {isStreaming && !rawMsg?.text && stageLabel && (
        <div className="theseus-stage-label">{stageLabel}</div>
      )}

      {/* Markdown content via assistant-ui */}
      <div className="theseus-msg-content">
        <MessagePrimitive.Content
          components={{
            Text: TheseusMarkdownText,
          }}
        />
      </div>

      {/* Stage label below content while still streaming */}
      {isStreaming && rawMsg?.text && (
        <div className="theseus-stage-label">{stageLabel || '\u2588'}</div>
      )}

      {/* Error */}
      {error && (
        <p style={{ color: 'var(--vie-type-person)', fontSize: 13, margin: '4px 0' }}>
          {error}
        </p>
      )}

      {/* Evidence preview cards (only on completed messages) */}
      {!isStreaming && evidenceSection && 'nodes' in evidenceSection && (
        <VisualPreviewCard
          type="evidence"
          nodes={evidenceSection.nodes}
          edges={'edges' in evidenceSection ? evidenceSection.edges : []}
          query={response?.query}
        />
      )}

      {!isStreaming && objectsSection && 'objects' in objectsSection && objectsSection.objects.length > 0 && (
        <VisualPreviewCard
          type="objects"
          objects={objectsSection.objects}
          query={response?.query}
        />
      )}

      {/* Action bar (only on completed messages with text) */}
      {!isStreaming && rawMsg?.text && (
        <div className="theseus-msg-actions">
          <button type="button" className="theseus-msg-action" onClick={handleCopy} title="Copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button type="button" className="theseus-msg-action" onClick={() => handleFeedback(true)} title="Helpful">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 22V11l-5 1v9l5 1zm2-11l4-9a2 2 0 012-2h.5a2 2 0 012 2v5h4.5a2 2 0 012 2.1l-1.5 9a2 2 0 01-2 1.9H9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="theseus-msg-action" onClick={() => handleFeedback(false)} title="Not helpful">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: 'rotate(180deg)' }}>
              <path d="M7 22V11l-5 1v9l5 1zm2-11l4-9a2 2 0 012-2h.5a2 2 0 012 2v5h4.5a2 2 0 012 2.1l-1.5 9a2 2 0 01-2 1.9H9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </button>
          {evidenceSection && 'nodes' in evidenceSection && evidenceSection.nodes.length > 0 && (
            <button type="button" className="theseus-msg-action" onClick={handleExplore} title="Explore in graph">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="18" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8.5 7.5L10.5 16M15.5 7.5L13.5 16" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Follow-up pills (only on completed messages) */}
      {!isStreaming && followUps && followUps.length > 0 && (
        <div className="theseus-followups">
          {followUps.slice(0, 3).map((fu) => (
            <button
              key={fu.query}
              type="button"
              className="theseus-followup-pill"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('theseus:chat-followup', { detail: { query: fu.query } }),
                );
              }}
            >
              {fu.query}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Text part component wrapping MarkdownTextPrimitive.
 * assistant-ui passes text content via internal context;
 * MarkdownTextPrimitive reads it automatically.
 */
function TheseusMarkdownText() {
  return <MarkdownTextPrimitive className="theseus-markdown" />;
}

/**
 * Composer area using assistant-ui's ComposerPrimitive, augmented with
 * Theseus-specific suggestion pills and styling.
 */
function TheseusComposerArea({
  isDisabled,
  onSubmit,
}: {
  isDisabled: boolean;
  onSubmit: (q: string) => void;
}) {
  // Listen for follow-up suggestions
  useEffect(() => {
    function handleFollowUp(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      if (detail?.query) onSubmit(detail.query);
    }
    window.addEventListener('theseus:chat-followup', handleFollowUp);
    return () => window.removeEventListener('theseus:chat-followup', handleFollowUp);
  }, [onSubmit]);

  // Listen for "Ask about this" pre-fill
  useEffect(() => {
    function handlePrefill(event: Event) {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      if (detail?.query) {
        const input = document.querySelector<HTMLTextAreaElement>('.theseus-composer-input');
        if (input) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype, 'value',
          )?.set;
          if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, detail.query);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          input.focus();
        }
      }
    }
    window.addEventListener('theseus:prefill-ask', handlePrefill);
    return () => window.removeEventListener('theseus:prefill-ask', handlePrefill);
  }, []);

  // Focus on mount
  useEffect(() => {
    const input = document.querySelector<HTMLTextAreaElement>('.theseus-composer-input');
    input?.focus();
  }, []);

  useEffect(() => {
    function handleFocus() {
      const input = document.querySelector<HTMLTextAreaElement>('.theseus-composer-input');
      input?.focus();
    }
    window.addEventListener('theseus:focus-ask-input', handleFocus);
    return () => window.removeEventListener('theseus:focus-ask-input', handleFocus);
  }, []);

  return (
    <div className="theseus-composer">
      <ComposerPrimitive.Root className="theseus-composer-inner">
        <ComposerPrimitive.Input
          className="theseus-composer-input"
          placeholder="Ask Theseus anything..."
          aria-label="Ask Theseus a question"
          autoComplete="off"
          spellCheck={false}
          rows={1}
          disabled={isDisabled}
        />

        {isDisabled ? (
          <ComposerPrimitive.Cancel className="theseus-composer-cancel" aria-label="Stop">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </ComposerPrimitive.Cancel>
        ) : (
          <ComposerPrimitive.Send className="theseus-composer-send" aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 20V4M12 4L6 10M12 4L18 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ComposerPrimitive.Send>
        )}
      </ComposerPrimitive.Root>

    </div>
  );
}

/**
 * Export chat conversation as markdown.
 * Collects all messages and produces downloadable markdown file.
 */
export function exportChatAsMarkdown(messages: ChatMessageType[]) {
  const lines: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push(`## User\n\n${msg.text}\n`);
    } else {
      lines.push(`## Theseus\n\n${msg.text}\n`);
    }
  }
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `theseus-chat-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
