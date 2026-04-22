'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { ChatMessage } from '@/components/theseus/chat/useChatHistory';
import { dispatchTheseusEvent } from '@/lib/theseus/events';
import AtlasFolio, {
  CitationRef,
  FolioAction,
  type AtlasFolioSidenote,
} from './AtlasFolio';
import AtlasSidenoteRail from './AtlasSidenoteRail';
import AtlasBlueprintPlate, {
  type BlueprintNode,
} from './AtlasBlueprintPlate';

interface FolioArtifact {
  kind: 'blueprint-plate';
  figure: string;
  title: string;
  caption?: string;
  nodes?: BlueprintNode[];
  height?: number;
}

interface AtlasFolioThreadProps {
  messages: ChatMessage[];
  isAsking: boolean;
  onSubmit: (query: string) => void;
  /** Writes the active folio index back to the surface so the folio rail
   *  can show which dash is current. */
  onActiveFolioChange?: (index: number) => void;
}

interface FolioModel {
  id: string;
  index: number;
  meta: string;
  question: string;
  paragraphs: string[];
  sidenotes: AtlasFolioSidenote[];
  artifact: FolioArtifact | null;
  isStreaming: boolean;
  stageLabel?: string;
  error?: string;
}

function formatMeta(ts: number): string {
  const d = new Date(ts);
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `Threads \u00B7 ${month} ${day} \u00B7 ${hours}:${minutes}`;
}

function toFolios(messages: ChatMessage[]): FolioModel[] {
  const folios: FolioModel[] = [];
  let current: FolioModel | null = null;
  for (const m of messages) {
    if (m.role === 'user') {
      if (current) folios.push(current);
      current = {
        id: m.id,
        index: folios.length + 1,
        meta: formatMeta(m.timestamp),
        question: m.text,
        paragraphs: [],
        sidenotes: [],
        artifact: null,
        isStreaming: false,
      };
    } else if (m.role === 'theseus') {
      if (!current) continue;
      if (m.text) {
        current.paragraphs = m.text
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);
      }
      current.isStreaming = Boolean(m.isStreaming);
      current.stageLabel = m.stageLabel;
      current.error = m.error;

      const resp = m.response as unknown as
        | {
            citations?: Array<{ ref?: number; text?: string; label?: string; kind?: string }>;
            artifact?: FolioArtifact;
          }
        | undefined;
      if (resp?.citations && Array.isArray(resp.citations)) {
        current.sidenotes = resp.citations
          .map((c, i) => {
            const ref = typeof c.ref === 'number' ? c.ref : i + 1;
            const title = c.label ?? `Citation ${ref}`;
            const body = c.text ?? '';
            const kind = (c.kind ?? 'evidence').toUpperCase();
            return { ref, kind, title, body } as AtlasFolioSidenote;
          })
          .filter((s) => s.title || s.body);
      }
      if (resp?.artifact && resp.artifact.kind === 'blueprint-plate') {
        current.artifact = resp.artifact;
      }
    }
  }
  if (current) folios.push(current);
  return folios;
}

function ParagraphWithRefs({
  text,
  onRefClick,
}: {
  text: string;
  onRefClick: (n: number) => void;
}) {
  const parts: Array<string | number> = [];
  let last = 0;
  const pattern = /\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(Number(match[1]));
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <p style={{ margin: '0 0 18px' }}>
      {parts.map((p, i) =>
        typeof p === 'number' ? (
          <CitationRef key={i} n={p} onClick={onRefClick} />
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </p>
  );
}

export default function AtlasFolioThread({
  messages,
  isAsking,
  onSubmit,
  onActiveFolioChange,
}: AtlasFolioThreadProps) {
  const folios = useMemo(() => toFolios(messages), [messages]);
  const total = folios.length;
  const [query, setQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const latestId = folios[total - 1]?.id;
  useEffect(() => {
    if (onActiveFolioChange) onActiveFolioChange(Math.max(0, total - 1));
  }, [total, onActiveFolioChange]);
  useEffect(() => {
    if (!latestId) return;
    const el = document.getElementById(`atlas-folio-${latestId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [latestId]);

  const scrollToSidenote = useCallback((n: number) => {
    const el = document.getElementById(`sidenote-${n}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const submit = useCallback(() => {
    const q = query.trim();
    if (!q || isAsking) return;
    onSubmit(q);
    setQuery('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [query, isAsking, onSubmit]);

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const hasAnySidenote = folios.some((f) => f.sidenotes.length > 0);
  const gridStyle = hasAnySidenote
    ? { display: 'grid' as const, gridTemplateColumns: 'minmax(0, 1fr) 280px', columnGap: 40 }
    : { display: 'block' as const };

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '60px 72px 260px 72px',
          ...gridStyle,
        }}
      >
        {total === 0 && (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: '160px 32px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                font: '500 10px/1 var(--font-mono)',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--paper-pencil)',
              }}
            >
              Threads · start a new one
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 20,
                lineHeight: 1.35,
                color: 'var(--paper-ink)',
                maxWidth: 460,
              }}
            >
              Ask, think out loud, or @cite a node. Each question opens a new folio.
            </div>
          </div>
        )}

        <div>
          {folios.map((f, i) => {
            const body = f.error ? (
              <p role="alert" style={{ margin: 0, color: 'var(--paper-pencil)' }}>
                {f.error}
              </p>
            ) : f.paragraphs.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  color: 'var(--paper-ink-3)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                {f.stageLabel ?? (f.isStreaming ? 'Composing\u2026' : 'No response yet.')}
              </p>
            ) : (
              <>
                {f.paragraphs.map((p, j) => (
                  <ParagraphWithRefs
                    key={`${f.id}-p${j}`}
                    text={p}
                    onRefClick={scrollToSidenote}
                  />
                ))}
                {f.artifact && (
                  <AtlasBlueprintPlate
                    figure={f.artifact.figure}
                    title={f.artifact.title}
                    caption={f.artifact.caption}
                    nodes={f.artifact.nodes}
                    height={f.artifact.height}
                  />
                )}
              </>
            );

            const actions = !f.isStreaming && !f.error ? (
              <>
                <FolioAction
                  label="Open in Explorer"
                  primary
                  onClick={() =>
                    dispatchTheseusEvent('theseus:switch-panel', {
                      panel: 'explorer',
                      source: 'chat-directive',
                    })
                  }
                />
                {f.sidenotes.length > 0 && (
                  <FolioAction
                    label="Trace citations"
                    onClick={() => scrollToSidenote(1)}
                    title="Jump to the first sidenote"
                  />
                )}
                <FolioAction
                  label="Follow up"
                  onClick={() => textareaRef.current?.focus()}
                />
              </>
            ) : null;

            const complete = !f.isStreaming && !f.error && f.paragraphs.length > 0;
            return (
              <AtlasFolio
                key={f.id}
                domId={`atlas-folio-${f.id}`}
                index={f.index}
                total={total}
                meta={f.meta}
                question={f.question}
                active={i === total - 1}
                actions={actions}
                complete={complete}
              >
                {body}
              </AtlasFolio>
            );
          })}
        </div>

        {hasAnySidenote && (
          <AtlasSidenoteRail
            sidenotes={folios.flatMap((f) => f.sidenotes)}
          />
        )}
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '24px 72px 32px',
          background:
            'linear-gradient(180deg, transparent, rgba(243, 239, 230, 0.88) 45%, rgba(243, 239, 230, 0.98) 100%)',
          pointerEvents: 'none',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          style={{
            pointerEvents: 'auto',
            maxWidth: 900,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '80px 1fr auto',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(243, 239, 230, 0.95)',
            border: '1px solid var(--paper-rule)',
            borderRadius: 4,
            padding: '10px 16px',
            boxShadow: '0 12px 32px -12px rgba(30, 22, 18, 0.28)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <span
            style={{
              font: '500 10px/1 var(--font-mono)',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--paper-ink-3)',
            }}
          >
            Reply
          </span>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onComposerKey}
            placeholder={
              total === 0
                ? 'Ask, think out loud, or @cite a node\u2026'
                : 'Continue the correspondence, or @cite a node\u2026'
            }
            rows={1}
            disabled={isAsking}
            style={{
              outline: 'none',
              border: 'none',
              background: 'transparent',
              resize: 'none',
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              color: 'var(--paper-ink)',
              minHeight: 24,
              maxHeight: 160,
            }}
          />
          <button
            type="submit"
            className="atlas-chat-send"
            disabled={!query.trim() || isAsking}
          >
            {isAsking ? 'Sending' : 'Send \u21B5'}
          </button>
        </form>
      </div>
    </div>
  );
}
