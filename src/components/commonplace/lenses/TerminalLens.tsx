'use client';

/**
 * Terminal lens — the engine's epistemic read of an object, plus an
 * object-scoped REPL (P2 / FR-010..013, SC-010).
 *
 * Internal read: gqlAsk seeded by the object returns an answer + provenance;
 * each provenance item is evidence, scored (confidence) and tagged with the
 * arms that surfaced it (semantic / lexical / graph — the fusion is the read).
 * The readout streams (the lines-appearing aesthetic) and the prompt accepts
 * an object-scoped question, rendering each answer as structured blocks rather
 * than monospace text.
 *
 * External / web context has no browser-reachable endpoint yet, so that block
 * states so honestly; an object with no graph neighbors still gets its answer,
 * and an object with no answer still shows its evidence (SC-010).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import TerminalBlock from '../engine/TerminalBlock';
import {
  askObject,
  provenanceToNeighbors,
  armLabel,
  confidencePct,
  WEB_CONTEXT_AVAILABLE,
  type LensNeighbor,
} from './lens-data';
import { useApplyLens } from './use-apply-lens';
import type { LensViewProps } from './lens-types';

interface Exchange {
  id: number;
  question?: string;
  status: 'running' | 'complete' | 'error';
  answer: string;
  empty: boolean;
  neighbors: LensNeighbor[];
}

function useTypewriter(text: string, on: boolean, speed = 14): string {
  const [n, setN] = useState(on ? 0 : text.length);
  useEffect(() => {
    if (!on) { setN(text.length); return; }
    setN(0);
    if (!text) return;
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) { clearInterval(id); return v; }
        return Math.min(text.length, v + 3);
      });
    }, speed);
    return () => clearInterval(id);
  }, [text, on, speed]);
  return text.slice(0, n);
}

function ArmBadge({ arm }: { arm: string }) {
  const color =
    armLabel(arm) === 'semantic' ? '#4A9EC4' :
    armLabel(arm) === 'lexical' ? '#C49A4A' :
    '#7050A0';
  return (
    <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.05em', color, border: `1px solid ${color}`, borderRadius: 3, padding: '0 4px', opacity: 0.85 }}>
      {armLabel(arm)}
    </span>
  );
}

function EvidenceRow({ n, index, onOpen }: { n: LensNeighbor; index: number; onOpen: (n: LensNeighbor) => void }) {
  const pct = confidencePct(n.score);
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(n)}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.6) }}
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', borderBottom: '1px solid var(--cp-term-border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--cp-term-text)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {n.object.display_title ?? n.object.title}
        </span>
        {n.arms.slice(0, 3).map((a) => <ArmBadge key={a} arm={a} />)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <div style={{ flex: 1, height: 3, background: 'var(--cp-term-border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--cp-term-green)' }} />
        </div>
        <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 8, color: 'var(--cp-term-muted)' }}>{pct}%</span>
      </div>
    </motion.button>
  );
}

function ExchangeView({ ex, onOpen }: { ex: Exchange; onOpen: (n: LensNeighbor) => void }) {
  const streaming = ex.status === 'complete';
  const shown = useTypewriter(ex.answer, streaming);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ex.question && (
        <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 11, color: 'var(--cp-term-amber)' }}>
          <span style={{ opacity: 0.7 }}>&gt; </span>{ex.question}
        </div>
      )}
      <TerminalBlock
        title={ex.question ? 'ANSWER' : 'EPISTEMIC READ'}
        status={ex.status === 'running' ? 'running' : ex.status === 'error' ? 'error' : 'complete'}
      >
        {ex.status === 'running' && <span style={{ color: 'var(--cp-term-muted)' }}>reading the graph…</span>}
        {ex.status === 'error' && <span style={{ color: 'var(--cp-term-red)' }}>The engine could not be reached.</span>}
        {ex.status === 'complete' && (
          <div>
            {ex.answer
              ? <div style={{ whiteSpace: 'pre-wrap' }}>{shown}{shown.length < ex.answer.length && <span style={{ opacity: 0.6 }}>▍</span>}</div>
              : <div style={{ color: 'var(--cp-term-muted)', fontStyle: 'italic' }}>No synthesized answer; see evidence below.</div>}
          </div>
        )}
      </TerminalBlock>

      {ex.status === 'complete' && (
        <TerminalBlock title={`EVIDENCE · ${ex.neighbors.length}`} status={ex.neighbors.length ? 'complete' : 'degraded'}>
          {ex.neighbors.length === 0
            ? <span style={{ color: 'var(--cp-term-muted)', fontStyle: 'italic' }}>No graph neighbors surfaced for this object.</span>
            : ex.neighbors.map((n, i) => <EvidenceRow key={n.object.slug} n={n} index={i} onOpen={onOpen} />)}
        </TerminalBlock>
      )}
    </div>
  );
}

let exchangeId = 0;

export default function TerminalLens({ ctx }: LensViewProps) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [input, setInput] = useState('');
  const applyLens = useApplyLens();
  const scrollRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (question?: string) => {
    const id = ++exchangeId;
    setExchanges((prev) => [...prev, { id, question, status: 'running', answer: '', empty: false, neighbors: [] }]);
    try {
      const result = await askObject(ctx.objectTitle, question, 8);
      const neighbors = provenanceToNeighbors(result.provenance, ctx.objectSlug);
      setExchanges((prev) => prev.map((e) => e.id === id
        ? { ...e, status: 'complete', answer: result.answer ?? '', empty: result.answerKind === 'EMPTY', neighbors }
        : e));
    } catch {
      setExchanges((prev) => prev.map((e) => e.id === id ? { ...e, status: 'error' } : e));
    }
  }, [ctx.objectTitle, ctx.objectSlug]);

  // Auto-run the open read when the lens opens / re-targets.
  useEffect(() => { setExchanges([]); void run(undefined); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ctx.objectSlug]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [exchanges]);

  const openNeighbor = useCallback((n: LensNeighbor) => {
    applyLens('terminal', {
      objectRef: n.object.id,
      objectSlug: n.object.slug,
      objectType: n.object.object_type_slug,
      objectTitle: n.object.display_title ?? n.object.title,
    });
  }, [applyLens]);

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    void run(q);
  }, [input, run]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div ref={scrollRef} className="cp-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {exchanges.map((ex) => <ExchangeView key={ex.id} ex={ex} onOpen={openNeighbor} />)}

        <TerminalBlock title="WEB" status="degraded">
          {WEB_CONTEXT_AVAILABLE
            ? <span>Web context loaded.</span>
            : <span style={{ color: 'var(--cp-term-muted)', fontStyle: 'italic' }}>No web context wired — internal read only. (Upgrade path: a /web-context route over rustyweb search.)</span>}
        </TerminalBlock>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--cp-term-border)', background: 'var(--cp-term)' }}>
        <span style={{ fontFamily: 'var(--cp-font-mono)', color: 'var(--cp-term-green)', fontSize: 12, alignSelf: 'center' }}>&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about "${ctx.objectTitle}"…`}
          aria-label="Ask this object a question"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--cp-term-text)', fontFamily: 'var(--cp-font-mono)', fontSize: 12 }}
        />
        <button type="submit" style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--cp-term-green)', background: 'none', border: '1px solid var(--cp-term-border)', borderRadius: 3, padding: '2px 8px', cursor: 'pointer' }}>
          Ask
        </button>
      </form>
    </div>
  );
}
