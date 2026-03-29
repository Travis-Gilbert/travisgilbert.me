'use client';

/**
 * EngineProvenance: reusable collapsible drawer showing engine scoring details.
 *
 * Displays pass badges, composite score, NLI confidence, and uncertainty.
 * Uses Motion spring animation for expand/collapse.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SPRING, useSpring } from './engine-motion';

const PURPLE = '#8B6FA0';
const PURPLE_FAINT = 'rgba(139,111,160,0.08)';

interface EngineProvenanceProps {
  passes: string[];
  score: number;
  engine: string;
  nli?: { label: string; score: number } | null;
  uncertainty?: number;
  defaultOpen?: boolean;
}

const NLI_COLOR: Record<string, string> = {
  entailment: '#5A8A5A',
  contradiction: '#B45A5A',
  neutral: '#8A8279',
};

export default function EngineProvenance({
  passes,
  score,
  engine,
  nli,
  uncertainty,
  defaultOpen = false,
}: EngineProvenanceProps) {
  const [open, setOpen] = useState(defaultOpen);
  const spring = useSpring('natural');

  return (
    <div className="ep-root">
      <style>{`
        .ep-root {
          border-top: 1px solid var(--cp-border-faint, rgba(42,37,32,0.07));
          font-family: var(--cp-font-body);
        }
        .ep-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 8px 0;
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: ${PURPLE};
          transition: color 120ms ease;
        }
        .ep-toggle:hover {
          color: #6A4F80;
        }
        .ep-chevron {
          display: inline-block;
          font-size: 8px;
          transition: transform 120ms ease;
        }
        .ep-body {
          overflow: hidden;
        }
        .ep-inner {
          padding: 0 0 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ep-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ep-label {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          color: var(--cp-text-faint, #8A8279);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          min-width: 50px;
        }
        .ep-pass-badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.03em;
        }
        .ep-pass-badge--active {
          background: rgba(139,111,160,0.10);
          color: ${PURPLE};
        }
        .ep-pass-badge--inactive {
          background: var(--cp-border-faint, rgba(42,37,32,0.07));
          color: var(--cp-text-ghost, #AEA89F);
        }
        .ep-score {
          font-family: var(--cp-font-mono);
          font-size: 13px;
          font-weight: 700;
          color: var(--cp-text, #2A2520);
          font-variant-numeric: tabular-nums;
        }
        .ep-engine-label {
          font-family: var(--cp-font-mono);
          font-size: 10px;
          color: var(--cp-text-faint, #8A8279);
        }
        .ep-nli-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: var(--cp-font-mono);
          font-size: 10px;
          font-weight: 600;
        }
        .ep-uncertainty {
          font-family: var(--cp-font-mono);
          font-size: 11px;
          color: var(--cp-text-muted, #5C554D);
          font-variant-numeric: tabular-nums;
        }
      `}</style>

      <button
        className="ep-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span
          className="ep-chevron"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          &#x25B8;
        </span>
        ENGINE PROVENANCE
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="ep-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
          >
            <div className="ep-inner">
              {/* Pass badges */}
              <div className="ep-row">
                <span className="ep-label">Passes</span>
                {ALL_PASSES.map((p) => (
                  <span
                    key={p}
                    className={`ep-pass-badge ${passes.includes(p) ? 'ep-pass-badge--active' : 'ep-pass-badge--inactive'}`}
                  >
                    {p}
                  </span>
                ))}
              </div>

              {/* Composite score + engine */}
              <div className="ep-row">
                <span className="ep-label">Score</span>
                <span className="ep-score">{score.toFixed(3)}</span>
                <span className="ep-engine-label">{engine}</span>
              </div>

              {/* NLI confidence */}
              {nli && (
                <div className="ep-row">
                  <span className="ep-label">NLI</span>
                  <span
                    className="ep-nli-badge"
                    style={{
                      background: `${NLI_COLOR[nli.label] ?? '#8A8279'}15`,
                      color: NLI_COLOR[nli.label] ?? '#8A8279',
                    }}
                  >
                    {nli.label}
                    <span style={{ opacity: 0.7 }}>{(nli.score * 100).toFixed(0)}%</span>
                  </span>
                </div>
              )}

              {/* Uncertainty (active learning) */}
              {uncertainty !== undefined && (
                <div className="ep-row">
                  <span className="ep-label">Uncert.</span>
                  <span className="ep-uncertainty">{uncertainty.toFixed(3)}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Known pass names for badge ordering */
const ALL_PASSES = ['ner', 'bm25', 'tfidf', 'sbert', 'nli', 'causal', 'scored'];
