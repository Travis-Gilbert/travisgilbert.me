'use client';

/**
 * The omnibar: the 21st.dev ai-input wired to Theorem's agent + RustyRed.
 *   - plain text  -> ask  : Theorem's GL-Fusion-free agent (commonplace-api),
 *                    grounded retrieval over the substrate (vector + lexical +
 *                    graph, reciprocal-rank fused) with an honest answer and
 *                    per-item provenance. No model dependency.
 *   - web         -> search: RustyWeb external search acquisition.
 *   - fractal     -> expand: graph frontier + RustyWeb fractal expansion.
 *   - attach      -> capture the file into CommonPlace.
 *
 * (The Theorem gateway -- src/lib/theorem-gateway.ts -- remains wired for the
 * federated full-Theseus surfaces Codex is growing; the omnibar uses the
 * GL-Fusion-free agent so it answers for real now.)
 */

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AiInputBar, type AiInputMode, type AiInputSize } from './AiInputBar';
import { gqlIngest, type AskResultGql } from '@/lib/commonplace-graphql';
import { askCommonPlaceAgent } from '@/lib/local-agent';
import {
  searchRustyWeb,
  type RustyWebSearchHit,
  type RustyWebSearchResponse,
} from '@/lib/rustyweb-search';

interface OmnibarProps {
  bottomOffset?: string;
  frameClassName?: string;
  shellClassName?: string;
  inputSize?: AiInputSize;
}

export default function Omnibar({
  bottomOffset = '20vh',
  frameClassName,
  shellClassName,
  inputSize = 'default',
}: OmnibarProps = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = React.useState('');
  const [mode, setMode] = React.useState<AiInputMode>('ask');
  const [busy, setBusy] = React.useState(false);
  const [answer, setAnswer] = React.useState<AskResultGql | null>(null);
  const [searchResult, setSearchResult] = React.useState<RustyWebSearchResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = React.useCallback(async () => {
    const q = value.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer(null);
    setSearchResult(null);
    setError(null);
    try {
      if (mode === 'ask') {
        setAnswer(await askCommonPlaceAgent(q, 8));
      } else {
        setSearchResult(
          await searchRustyWeb(q, {
            mode,
            limit: mode === 'web' ? 12 : 8,
            providerLimit: mode === 'web' ? 4 : 8,
            providerTimeoutMs: mode === 'web' ? 4_000 : 8_000,
          }),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [value, busy, mode]);

  async function attach(file: File) {
    try {
      await gqlIngest({ title: file.name, text: '', kind: 'file', tags: ['attach'] });
    } catch {
      /* capture is best-effort from the omnibar */
    }
  }

  const showPanel = busy || answer !== null || searchResult !== null || error !== null;
  const busyText =
    mode === 'ask'
      ? 'Asking the agent...'
      : mode === 'fractal'
        ? 'Expanding from graph to web...'
        : 'Searching the web...';

  return (
    /* Fixed in the bottom third so it never shifts page content; results grow
       upward above the bar (chat-style). */
    <div
      className={frameClassName ?? 'pointer-events-none fixed left-0 right-0 z-40 flex justify-center px-4 md:left-[256px]'}
      style={{ bottom: bottomOffset }}
    >
      <div className={shellClassName ?? 'pointer-events-auto w-full max-w-2xl'}>
        <AnimatePresence>
          {showPanel ? (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="mb-3 max-h-[42vh] overflow-y-auto rounded-xl p-4"
              style={{ background: 'var(--cp-card)', border: '1px solid var(--cp-border)', boxShadow: 'var(--cp-shadow-lg)' }}
            >
              {busy ? (
                <p className="font-mono text-sm" style={{ color: 'var(--cp-text-muted)' }}>
                  {busyText}
                </p>
              ) : error ? (
                <p className="text-sm" style={{ color: 'var(--cp-red)' }}>
                  {error}
                </p>
              ) : answer ? (
                <AnswerView answer={answer} />
              ) : searchResult ? (
                <SearchResultView result={searchResult} />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AiInputBar
          value={value}
          onChange={setValue}
          onSubmit={submit}
          mode={mode}
          onModeChange={setMode}
          onAttach={attach}
          busy={busy}
          size={inputSize}
        />
      </div>
    </div>
  );
}

const ARM_LABEL: Record<string, string> = { vector: 'semantic', lexical: 'text', graph: 'graph' };

function AnswerView({ answer }: { answer: AskResultGql }) {
  const kind = answer.answerKind.toLowerCase();
  return (
    <div>
      <p className="whitespace-pre-wrap text-[15px] leading-[1.6]" style={{ color: 'var(--cp-text)' }}>
        {answer.answer || 'No grounding found in your substrate yet.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]" style={{ color: 'var(--cp-text-faint)' }}>
        <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--cp-red-soft)', color: 'var(--cp-red)' }}>
          {kind === 'model' ? 'agent' : kind === 'extractive' ? 'grounded (extractive)' : 'no match'}
        </span>
        <span>{answer.provenance.length} source{answer.provenance.length === 1 ? '' : 's'}</span>
      </div>
      {answer.provenance.length ? (
        <ul className="mt-3 space-y-1.5">
          {answer.provenance.slice(0, 6).map((p) => (
            <li key={p.item.id} className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm" style={{ color: 'var(--cp-text)' }}>{p.item.title}</span>
              {p.arms.map((a) => (
                <span
                  key={a}
                  className="rounded px-1 py-0.5 font-mono text-[10px]"
                  style={{ background: 'var(--cp-surface-hover)', color: 'var(--cp-text-muted)' }}
                >
                  {ARM_LABEL[a] ?? a}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SearchResultView({ result }: { result: RustyWebSearchResponse }) {
  const hits = result.hits.slice(0, 12);
  if (!hits.length) {
    return (
      <p className="text-sm" style={{ color: 'var(--cp-text-muted)' }}>
        {result.mode === 'fractal'
          ? 'No graph-guided web results yet.'
          : 'No web results yet.'}
      </p>
    );
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px]" style={{ color: 'var(--cp-text-faint)' }}>
        <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--cp-red-soft)', color: 'var(--cp-red)' }}>
          {result.mode === 'fractal' ? 'fractal expansion' : 'web search'}
        </span>
        <span>{hits.length} result{hits.length === 1 ? '' : 's'}</span>
        {result.stats.frontier ? <span>{result.stats.frontier} graph seed{result.stats.frontier === 1 ? '' : 's'}</span> : null}
        {result.stats.seedUrls ? <span>{result.stats.seedUrls} web seed{result.stats.seedUrls === 1 ? '' : 's'}</span> : null}
      </div>
      <ul className="space-y-3">
        {hits.map((hit) => (
          <SearchHitItem key={hit.id} hit={hit} />
        ))}
      </ul>
    </div>
  );
}

function SearchHitItem({ hit }: { hit: RustyWebSearchHit }) {
  const content = (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[15px] leading-tight" style={{ color: 'var(--cp-text)' }}>{hit.title}</span>
        <span
          className="rounded px-1 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
          style={{
            background: hit.kind === 'graph' ? 'rgba(34, 105, 115, 0.12)' : 'var(--cp-surface-hover)',
            color: hit.kind === 'graph' ? 'var(--cp-teal)' : 'var(--cp-text-muted)',
          }}
        >
          {hit.kind}
        </span>
        {hit.sources.slice(0, 3).map((source) => (
          <span key={source} className="font-mono text-[10px]" style={{ color: 'var(--cp-text-faint)' }}>
            {source}
          </span>
        ))}
      </div>
      {hit.url ? (
        <div className="mt-0.5 truncate font-mono text-[11px]" style={{ color: 'var(--cp-text-faint)' }}>
          {hit.url}
        </div>
      ) : null}
      {hit.snippet ? (
        <p className="mt-1 line-clamp-2 text-sm leading-[1.45]" style={{ color: 'var(--cp-text-muted)' }}>
          {hit.snippet}
        </p>
      ) : null}
    </>
  );
  return (
    <li>
      {hit.url ? (
        <a href={hit.url} target="_blank" rel="noreferrer" className="block rounded-md p-1.5 transition-colors hover:bg-black/5">
          {content}
        </a>
      ) : (
        <div className="rounded-md p-1.5">{content}</div>
      )}
    </li>
  );
}
