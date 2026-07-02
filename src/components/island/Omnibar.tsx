'use client';

/**
 * The omnibar: the 21st.dev ai-input wired to CommonPlace's agent + RustyRed.
 *   - plain text  -> ask     : The composed CommonPlace API agent.
 *   - web         -> search  : RustyWeb external search acquisition.
 *   - research    -> search + composed CommonPlace API agent over the evidence bundle.
 *   - fractal     -> expand  : graph frontier + RustyWeb fractal expansion.
 *   - attach      -> capture the file into CommonPlace.
 *
 * The browser path uses a same-origin proxy so model-provider credentials stay
 * server-side; the desktop path can use the local MCP loopback directly.
 */

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AiInputBar, type AiInputMode, type AiInputSize } from './AiInputBar';
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
  const [agentResult, setAgentResult] = React.useState<TheoremAgentRunResult | null>(null);
  const [searchResult, setSearchResult] = React.useState<RustyWebSearchResponse | null>(null);
  const [researchResult, setResearchResult] = React.useState<{
    search: RustyWebSearchResponse;
    agent: TheoremAgentRunResult;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = React.useCallback(async () => {
    const q = value.trim();
    if (!q || busy) return;
    setBusy(true);
    setAgentResult(null);
    setSearchResult(null);
    setResearchResult(null);
    setError(null);
    try {
      if (mode === 'ask') {
        setAgentResult(await runTheoremAgent({ task: q, mode: 'ask' }));
      } else if (mode === 'research') {
        const search = await searchRustyWeb(q, {
          mode: 'web',
          limit: 8,
          providerLimit: 4,
          providerTimeoutMs: 4_000,
          requestTimeoutMs: 12_000,
        });
        const claims = searchHitsToClaims(search.hits);
        const agent = await runTheoremAgent({
          mode: 'research',
          task: `Answer this question using the attached search evidence where it is useful. Question: ${q}`,
          claims,
          requestTimeoutMs: 75_000,
        });
        setResearchResult({ search, agent });
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

  const showPanel =
    busy || agentResult !== null || searchResult !== null || researchResult !== null || error !== null;
  const busyText =
    mode === 'ask'
      ? 'Thinking...'
      : mode === 'research'
        ? 'Searching, then thinking...'
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
              ) : agentResult ? (
                <AgentAnswerView result={agentResult} />
              ) : researchResult ? (
                <ResearchResultView result={researchResult} />
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

function AgentAnswerView({ result }: { result: TheoremAgentRunResult }) {
  const allowed = verdictAllowed(result.alignmentVerdict);
  return (
    <div>
      <p className="whitespace-pre-wrap text-[15px] leading-[1.6]" style={{ color: 'var(--cp-text)' }}>
        {result.answer || 'I did not get an answer back.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px]" style={{ color: 'var(--cp-text-faint)' }}>
        <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--cp-red-soft)', color: 'var(--cp-red)' }}>
          CommonPlace
        </span>
        <span>{result.heads.length || 1} head{result.heads.length === 1 ? '' : 's'}</span>
        <span>{allowed ? 'alignment passed' : 'alignment pending'}</span>
        {result.evidenceCount ? (
          <span>{result.evidenceCount} evidence item{result.evidenceCount === 1 ? '' : 's'}</span>
        ) : null}
      </div>
      {result.claims.length ? (
        <ul className="mt-3 space-y-1.5">
          {result.claims.slice(0, 6).map((claim, index) => (
            <li key={`${claim.provenance}-${index}`} className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm" style={{ color: 'var(--cp-text)' }}>{claim.text}</span>
              <span
                className="rounded px-1 py-0.5 font-mono text-[10px]"
                style={{ background: 'var(--cp-surface-hover)', color: 'var(--cp-text-muted)' }}
              >
                {claim.provenance}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ResearchResultView({
  result,
}: {
  result: { search: RustyWebSearchResponse; agent: TheoremAgentRunResult };
}) {
  return (
    <div className="space-y-4">
      <AgentAnswerView result={result.agent} />
      <div className="border-t pt-3" style={{ borderColor: 'var(--cp-border)' }}>
        <SearchResultView result={result.search} label="Evidence bundle" />
      </div>
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
          {label ?? (result.mode === 'fractal' ? 'fractal expansion' : 'web search')}
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
