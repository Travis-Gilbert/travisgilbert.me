'use client';

import { useMemo } from 'react';
import type { ChatMessage as ChatMessageType } from './useChatHistory';
import VisualPreviewCard from './VisualPreviewCard';

const BRAILLE_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

function StreamingIndicator({ label }: { label?: string }) {
  return (
    <span className="theseus-chat-streaming" role="status" aria-live="polite">
      <span className="theseus-chat-spinner" aria-hidden="true">
        {BRAILLE_FRAMES[0]}
      </span>
      {label && <span className="theseus-chat-stage-label">{label}</span>}
    </span>
  );
}

export default function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';

  // Extract evidence data for visual preview cards
  const evidenceSection = useMemo(() => {
    if (!message.response) return null;
    return message.response.sections.find((s) => s.type === 'evidence_path') ?? null;
  }, [message.response]);

  const objectsSection = useMemo(() => {
    if (!message.response) return null;
    return message.response.sections.find((s) => s.type === 'objects') ?? null;
  }, [message.response]);

  const followUps = message.response?.follow_ups;

  if (isUser) {
    return (
      <div className="theseus-chat-msg theseus-chat-msg-user">
        <p className="theseus-chat-msg-text">{message.text}</p>
      </div>
    );
  }

  return (
    <div className="theseus-chat-msg theseus-chat-msg-theseus">
      {/* Streaming indicator */}
      {message.isStreaming && !message.text && (
        <StreamingIndicator label={message.stageLabel} />
      )}

      {/* Message text */}
      {message.text && (
        <div className="theseus-chat-msg-text">
          {message.text.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      )}

      {/* Streaming indicator after partial text */}
      {message.isStreaming && message.text && (
        <StreamingIndicator />
      )}

      {/* Error state */}
      {message.error && (
        <p className="theseus-chat-msg-error">{message.error}</p>
      )}

      {/* Visual preview cards (after streaming completes) */}
      {!message.isStreaming && evidenceSection && 'nodes' in evidenceSection && (
        <VisualPreviewCard
          type="evidence"
          nodes={evidenceSection.nodes}
          edges={'edges' in evidenceSection ? evidenceSection.edges : []}
          query={message.response?.query}
        />
      )}

      {!message.isStreaming && objectsSection && 'objects' in objectsSection && objectsSection.objects.length > 0 && (
        <VisualPreviewCard
          type="objects"
          objects={objectsSection.objects}
          query={message.response?.query}
        />
      )}

      {/* Follow-up suggestions */}
      {!message.isStreaming && followUps && followUps.length > 0 && (
        <div className="theseus-chat-followups">
          {followUps.slice(0, 3).map((fu) => (
            <button
              key={fu.query}
              type="button"
              className="theseus-chat-followup-pill"
              onClick={() => {
                // Dispatch custom event that ChatInput listens for
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
    </div>
  );
}
