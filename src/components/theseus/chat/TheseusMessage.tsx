'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import type { ChatMessage as ChatMessageType } from './useChatHistory';
import VisualPreviewCard from './VisualPreviewCard';

interface TheseusMessageProps {
  message: ChatMessageType;
}

/**
 * Parse a line of markdown into React elements for inline formatting.
 * Handles: **bold**, *italic*, `code`, [links](url)
 *
 * Content comes from the Theseus backend (trusted source).
 */
function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partKey = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${partKey++}`;

    if (match[2]) {
      parts.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(<code key={key}>{match[4]}</code>);
    } else if (match[5] && match[6]) {
      parts.push(
        <a key={key} href={match[6]} target="_blank" rel="noopener noreferrer">
          {match[5]}
        </a>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function MarkdownContent({ text }: { text: string }) {
  const elements = useMemo(() => {
    const blocks = text.split('\n\n');
    const result: ReactNode[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const trimmed = blocks[i].trim();
      if (!trimmed) continue;

      const key = `block-${i}`;

      if (trimmed.startsWith('### ')) {
        result.push(<h3 key={key}>{parseInline(trimmed.slice(4), key)}</h3>);
        continue;
      }
      if (trimmed.startsWith('## ')) {
        result.push(<h2 key={key}>{parseInline(trimmed.slice(3), key)}</h2>);
        continue;
      }
      if (trimmed.startsWith('# ')) {
        result.push(<h1 key={key}>{parseInline(trimmed.slice(2), key)}</h1>);
        continue;
      }

      if (trimmed.startsWith('```')) {
        const lines = trimmed.split('\n');
        const code = lines.slice(1, lines[lines.length - 1] === '```' ? -1 : undefined).join('\n');
        result.push(<pre key={key}><code>{code}</code></pre>);
        continue;
      }

      const listLines = trimmed.split('\n');
      if (listLines.every((line) => /^[-*]\s/.test(line.trim()))) {
        result.push(
          <ul key={key}>
            {listLines.map((line, li) => (
              <li key={`${key}-li-${li}`}>{parseInline(line.replace(/^[-*]\s/, ''), `${key}-li-${li}`)}</li>
            ))}
          </ul>,
        );
        continue;
      }

      if (listLines.every((line) => /^\d+\.\s/.test(line.trim()))) {
        result.push(
          <ol key={key}>
            {listLines.map((line, li) => (
              <li key={`${key}-li-${li}`}>{parseInline(line.replace(/^\d+\.\s/, ''), `${key}-li-${li}`)}</li>
            ))}
          </ol>,
        );
        continue;
      }

      if (trimmed.startsWith('> ')) {
        const quoteLines = trimmed.split('\n').map((line) => line.replace(/^>\s?/, ''));
        result.push(
          <blockquote key={key}>
            {quoteLines.map((line, qi) => (
              <span key={`${key}-q-${qi}`}>
                {parseInline(line, `${key}-q-${qi}`)}
                {qi < quoteLines.length - 1 && <br />}
              </span>
            ))}
          </blockquote>,
        );
        continue;
      }

      const paraLines = trimmed.split('\n');
      result.push(
        <p key={key}>
          {paraLines.map((line, pi) => (
            <span key={`${key}-p-${pi}`}>
              {parseInline(line, `${key}-p-${pi}`)}
              {pi < paraLines.length - 1 && <br />}
            </span>
          ))}
        </p>,
      );
    }

    return result;
  }, [text]);

  return <div className="theseus-msg-content">{elements}</div>;
}

export default function TheseusMessage({ message }: TheseusMessageProps) {
  const isUser = message.role === 'user';

  const evidenceSection = useMemo(() => {
    if (!message.response) return null;
    return message.response.sections.find((s) => s.type === 'evidence_path') ?? null;
  }, [message.response]);

  const objectsSection = useMemo(() => {
    if (!message.response) return null;
    return message.response.sections.find((s) => s.type === 'objects') ?? null;
  }, [message.response]);

  const followUps = message.response?.follow_ups;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.text);
  }, [message.text]);

  const handleExplore = useCallback(() => {
    if (!message.response) return;
    const evidencePath = message.response.sections.find((s) => s.type === 'evidence_path');
    if (evidencePath && 'nodes' in evidencePath) {
      const pks = evidencePath.nodes.map((n) => n.object_id).join(',');
      window.location.href = `/theseus/explorer?focus=${pks}`;
    }
  }, [message.response]);

  const handleFeedback = useCallback((positive: boolean) => {
    window.dispatchEvent(
      new CustomEvent('theseus:feedback', {
        detail: { query: message.response?.query, positive },
      }),
    );
  }, [message.response]);

  if (isUser) {
    return (
      <div className="theseus-msg theseus-msg-user">
        <div className="theseus-msg-bubble">
          <p className="theseus-msg-text">{message.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="theseus-msg theseus-msg-assistant">
      {message.isStreaming && !message.text && message.stageLabel && (
        <div className="theseus-stage-label">{message.stageLabel}</div>
      )}

      {message.text && <MarkdownContent text={message.text} />}

      {message.isStreaming && message.text && (
        <div className="theseus-stage-label">{message.stageLabel || '\u2588'}</div>
      )}

      {message.error && (
        <p style={{ color: 'var(--vie-type-person)', fontSize: 13, margin: '4px 0' }}>
          {message.error}
        </p>
      )}

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

      {!message.isStreaming && message.text && (
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

      {!message.isStreaming && followUps && followUps.length > 0 && (
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
    </div>
  );
}
