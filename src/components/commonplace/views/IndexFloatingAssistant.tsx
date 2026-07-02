'use client';

import * as React from 'react';
import {
  Bot,
  Code2,
  Info,
  Link as LinkIcon,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { gqlIngest } from '@/lib/commonplace-graphql';
import {
  searchRustyWeb,
  type RustyWebSearchHit,
  type RustyWebSearchResponse,
} from '@/lib/rustyweb-search';
import {
  runTheoremAgent,
  type TheoremAgentClaim,
  type TheoremAgentRunResult,
} from '@/lib/theorem-agent';
import styles from './IndexFloatingAssistant.module.css';

type AssistantMode = 'ask' | 'web' | 'research' | 'fractal';

type AssistantResult =
  | { kind: 'agent'; result: TheoremAgentRunResult }
  | { kind: 'search'; result: RustyWebSearchResponse }
  | { kind: 'research'; search: RustyWebSearchResponse; agent: TheoremAgentRunResult };

const MAX_CHARS = 2000;

const MODE_COPY: Record<
  AssistantMode,
  { label: string; status: string; placeholder: string; busy: string }
> = {
  ask: {
    label: 'Ask',
    status: 'CommonPlace agent',
    placeholder: 'What should CommonPlace make sense of next?',
    busy: 'Thinking...',
  },
  web: {
    label: 'Web',
    status: 'RustyWeb search',
    placeholder: 'Search the web from Index...',
    busy: 'Searching the web...',
  },
  research: {
    label: 'Research',
    status: 'Search + answer',
    placeholder: 'Gather evidence, then answer...',
    busy: 'Searching, then thinking...',
  },
  fractal: {
    label: 'Graph',
    status: 'Graph expansion',
    placeholder: 'Start from your graph and expand outward...',
    busy: 'Expanding from graph to web...',
  },
};

export default function IndexFloatingAssistant() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [mode, setMode] = React.useState<AssistantMode>('ask');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<AssistantResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!isOpen || !rootRef.current || !(target instanceof Node)) return;
      if (!rootRef.current.contains(target)) setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => textareaRef.current?.focus(), 40);
  }, [isOpen]);

  const submit = React.useCallback(async () => {
    const task = message.trim();
    if (!task || busy) return;

    setBusy(true);
    setResult(null);
    setError(null);
    setNotice(null);
    setMessage('');

    try {
      if (mode === 'ask') {
        const agent = await runTheoremAgent({ task, mode: 'ask' });
        setResult({ kind: 'agent', result: agent });
      } else if (mode === 'research') {
        const search = await searchRustyWeb(task, {
          mode: 'web',
          limit: 8,
          providerLimit: 4,
          providerTimeoutMs: 4_000,
          requestTimeoutMs: 12_000,
        });
        const agent = await runTheoremAgent({
          mode: 'research',
          task: `Answer this question using the attached search evidence where it is useful. Question: ${task}`,
          claims: searchHitsToClaims(search.hits),
          requestTimeoutMs: 75_000,
        });
        setResult({ kind: 'research', search, agent });
      } else {
        const search = await searchRustyWeb(task, {
          mode: mode === 'fractal' ? 'fractal' : 'web',
          limit: mode === 'web' ? 12 : 8,
          providerLimit: mode === 'web' ? 4 : 8,
          providerTimeoutMs: mode === 'web' ? 4_000 : 8_000,
        });
        setResult({ kind: 'search', result: search });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessage(task);
    } finally {
      setBusy(false);
    }
  }, [busy, message, mode]);

  async function attach(file: File) {
    setError(null);
    setNotice(null);
    try {
      await gqlIngest({ title: file.name, text: '', kind: 'file', tags: ['attach'] });
      setNotice(`${file.name} captured into Index.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const activeCopy = MODE_COPY[mode];
  const charCount = message.length;
  const canSubmit = message.trim().length > 0 && !busy;
  const showActivity = busy || result !== null || error !== null || notice !== null;

  return (
    <div ref={rootRef} className={styles.root} data-open={isOpen ? 'true' : 'false'}>
      {isOpen ? (
        <section className={styles.panel} role="dialog" aria-label="CommonPlace Index assistant">
          <header className={styles.header}>
            <div className={styles.headerIdentity}>
              <span className={styles.liveDot} aria-hidden="true" />
              <span className={styles.headerLabel}>CommonPlace</span>
            </div>
            <div className={styles.headerActions}>
              <span className={styles.modeBadge}>{activeCopy.label}</span>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                aria-label="Close assistant"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {showActivity ? (
            <div className={styles.activity} aria-live="polite">
              {busy ? (
                <p className={styles.busyText}>{activeCopy.busy}</p>
              ) : error ? (
                <p className={styles.errorText}>{error}</p>
              ) : notice ? (
                <p className={styles.noticeText}>{notice}</p>
              ) : result ? (
                <AssistantResultView result={result} />
              ) : null}
            </div>
          ) : null}

          <div className={styles.inputWrap}>
            <textarea
              ref={textareaRef}
              value={message}
              maxLength={MAX_CHARS}
              rows={4}
              className={styles.textarea}
              placeholder={activeCopy.placeholder}
              aria-label={activeCopy.placeholder}
              onChange={(event) => setMessage(event.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
            />
          </div>

          <div className={styles.controls}>
            <div className={styles.toolCluster}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => fileRef.current?.click()}
                aria-label="Attach file"
                title="Attach file"
              >
                <Paperclip size={17} />
              </button>
              <input
                ref={fileRef}
                className={styles.fileInput}
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void attach(file);
                  event.target.value = '';
                }}
              />
              <ModeButton
                icon={<LinkIcon size={17} />}
                label="Web search"
                mode="web"
                activeMode={mode}
                onChange={setMode}
              />
              <ModeButton
                icon={<Code2 size={17} />}
                label="Graph expansion"
                mode="fractal"
                activeMode={mode}
                onChange={setMode}
              />
              <ModeButton
                icon={<Sparkles size={17} />}
                label="Research"
                mode="research"
                activeMode={mode}
                onChange={setMode}
              />
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setNotice('Voice capture is not available on this surface yet.')}
                aria-label="Voice input"
                title="Voice input"
              >
                <Mic size={17} />
              </button>
            </div>

            <div className={styles.submitCluster}>
              <span className={styles.charCount}>
                {charCount}/{MAX_CHARS}
              </span>
              <button
                type="button"
                className={styles.sendButton}
                onClick={() => void submit()}
                disabled={!canSubmit}
                aria-label={busy ? 'Sending' : 'Send'}
                title="Send"
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          <footer className={styles.footer}>
            <span className={styles.footerItem}>
              <Info size={13} />
              {activeCopy.status}
            </span>
            <span className={styles.footerItem}>
              <span className={styles.statusDot} aria-hidden="true" />
              Index path ready
            </span>
          </footer>
        </section>
      ) : null}

      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen((value) => !value)}
        aria-label={isOpen ? 'Close Index assistant' : 'Open Index assistant'}
        aria-expanded={isOpen}
        title={isOpen ? 'Close assistant' : 'Open assistant'}
      >
        <span className={styles.triggerSheen} aria-hidden="true" />
        <span className={styles.triggerIcon}>{isOpen ? <X size={28} /> : <Bot size={30} />}</span>
        <span className={styles.triggerPulse} aria-hidden="true" />
      </button>
    </div>
  );
}

function ModeButton({
  icon,
  label,
  mode,
  activeMode,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  mode: Exclude<AssistantMode, 'ask'>;
  activeMode: AssistantMode;
  onChange: (mode: AssistantMode) => void;
}) {
  const active = activeMode === mode;
  return (
    <button
      type="button"
      className={cn(styles.iconButton, active && styles.iconButtonActive)}
      onClick={() => onChange(active ? 'ask' : mode)}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {icon}
    </button>
  );
}

function AssistantResultView({ result }: { result: AssistantResult }) {
  if (result.kind === 'agent') return <AgentAnswerView result={result.result} />;
  if (result.kind === 'research') {
    return (
      <div className={styles.resultStack}>
        <AgentAnswerView result={result.agent} />
        <SearchResultView result={result.search} label="Evidence" />
      </div>
    );
  }
  return <SearchResultView result={result.result} />;
}

function AgentAnswerView({ result }: { result: TheoremAgentRunResult }) {
  return (
    <div className={styles.answerBlock}>
      <p className={styles.answerText}>
        {result.answer || 'I did not get an answer back.'}
      </p>
      <div className={styles.metaRow}>
        <span>CommonPlace</span>
        <span>
          {result.heads.length || 1} head{result.heads.length === 1 ? '' : 's'}
        </span>
        <span>{verdictAllowed(result.alignmentVerdict) ? 'alignment passed' : 'alignment pending'}</span>
        {result.evidenceCount ? (
          <span>
            {result.evidenceCount} evidence item{result.evidenceCount === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {result.claims.length ? (
        <ul className={styles.claimList}>
          {result.claims.slice(0, 4).map((claim, index) => (
            <li key={`${claim.provenance}-${index}`}>
              <span>{claim.text}</span>
              <em>{claim.provenance}</em>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SearchResultView({
  result,
  label,
}: {
  result: RustyWebSearchResponse;
  label?: string;
}) {
  const hits = result.hits.slice(0, 6);
  if (!hits.length) {
    return <p className={styles.emptyText}>No results yet.</p>;
  }

  return (
    <div className={styles.searchBlock}>
      <div className={styles.metaRow}>
        <span>{label ?? (result.mode === 'fractal' ? 'Graph expansion' : 'Web search')}</span>
        <span>
          {hits.length} result{hits.length === 1 ? '' : 's'}
        </span>
        {result.stats.frontier ? <span>{result.stats.frontier} graph seeds</span> : null}
      </div>
      <ul className={styles.hitList}>
        {hits.map((hit) => (
          <li key={hit.id}>
            {hit.url ? (
              <a href={hit.url} target="_blank" rel="noreferrer">
                <SearchHitContent hit={hit} />
              </a>
            ) : (
              <SearchHitContent hit={hit} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchHitContent({ hit }: { hit: RustyWebSearchHit }) {
  return (
    <>
      <span className={styles.hitTitle}>{hit.title}</span>
      {hit.url ? <span className={styles.hitUrl}>{hit.url}</span> : null}
      {hit.snippet ? <span className={styles.hitSnippet}>{hit.snippet}</span> : null}
    </>
  );
}

function searchHitsToClaims(hits: RustyWebSearchHit[]): TheoremAgentClaim[] {
  return hits.slice(0, 8).map((hit, index) => ({
    text: [hit.title, hit.snippet].filter(Boolean).join(': '),
    provenance: hit.url || hit.id || `search:${index + 1}`,
  }));
}

function verdictAllowed(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'allowed' in value &&
    (value as { allowed?: unknown }).allowed === true
  );
}
