'use client';

/**
 * The omnibar: the 21st.dev ai-input wired to Theorem's agent + RustyRed.
 *   - plain text  -> ask  : Theorem's GL-Fusion-free agent (commonplace-api),
 *                    grounded retrieval over the substrate (vector + lexical +
 *                    graph, reciprocal-rank fused) with an honest answer and
 *                    per-item provenance. No model dependency.
 *   - search mode -> search : RustyRed retrieval over the substrate.
 *   - attach      -> capture the file into CommonPlace.
 *
 * (The Theorem gateway -- src/lib/theorem-gateway.ts -- remains wired for the
 * federated full-Theseus surfaces Codex is growing; the omnibar uses the
 * GL-Fusion-free agent so it answers for real now.)
 */

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AiInputBar } from './AiInputBar';
import { gqlSearchObjects, gqlIngest, type AskResultGql } from '@/lib/commonplace-graphql';
import { askCommonPlaceAgent } from '@/lib/local-agent';
import type { ObjectSearchResult } from '@/lib/commonplace-api';

export default function Omnibar({ bottomOffset = '20vh' }: { bottomOffset?: string } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = React.useState('');
  const [searchOn, setSearchOn] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [answer, setAnswer] = React.useState<AskResultGql | null>(null);
  const [hits, setHits] = React.useState<ObjectSearchResult[] | null>(null);

  const submit = React.useCallback(async () => {
    const q = value.trim();
    if (!q || busy) return;
    setBusy(true);
    setAnswer(null);
    setHits(null);
    try {
      if (searchOn) setHits(await gqlSearchObjects(q, 12));
      else setAnswer(await askCommonPlaceAgent(q, 8));
    } finally {
      setBusy(false);
    }
  }, [value, busy, searchOn]);

  async function attach(file: File) {
    try {
      await gqlIngest({ title: file.name, text: '', kind: 'file', tags: ['attach'] });
    } catch {
      /* capture is best-effort from the omnibar */
    }
  }

  const showPanel = busy || answer !== null || hits !== null;

  return (
    /* Fixed in the bottom third so it never shifts page content; results grow
       upward above the bar (chat-style). */
    <div
      className="pointer-events-none fixed left-0 right-0 z-40 flex justify-center px-4 md:left-[256px]"
      style={{ bottom: bottomOffset }}
    >
      <div className="pointer-events-auto w-full max-w-2xl">
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
                  {searchOn ? 'Searching the substrate...' : 'Asking the agent...'}
                </p>
              ) : answer ? (
                <AnswerView answer={answer} />
              ) : hits ? (
                <HitsView hits={hits} />
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AiInputBar
          value={value}
          onChange={setValue}
          onSubmit={submit}
          searchOn={searchOn}
          onToggleSearch={() => setSearchOn((v) => !v)}
          onAttach={attach}
          busy={busy}
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

function HitsView({ hits }: { hits: ObjectSearchResult[] }) {
  if (!hits.length) {
    return (
      <p className="text-sm" style={{ color: 'var(--cp-text-muted)' }}>
        Nothing in your substrate matches that yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {hits.slice(0, 12).map((h) => (
        <li key={h.slug} className="flex items-baseline gap-2">
          <span className="text-[15px]" style={{ color: 'var(--cp-text)' }}>{h.display_title || h.title}</span>
          <span className="font-mono text-[11px]" style={{ color: h.object_type_color || 'var(--cp-text-faint)' }}>
            {h.object_type_name}
          </span>
        </li>
      ))}
    </ul>
  );
}
