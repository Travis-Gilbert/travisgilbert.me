'use client';

import { useEffect, useState } from 'react';
import type { ImpactSymbol } from '@/lib/theseus-types';
import {
  EDGE_COLORS,
  EDGE_LABELS,
  ENTITY_COLORS,
  ENTITY_LABELS,
} from './codeColors';

interface Props {
  symbol: ImpactSymbol | null;
  x: number;
  y: number;
  onExplain?: (symbolName: string) => void;
}

const CARD_WIDTH = 260;
const CARD_HEIGHT = 180;
const CURSOR_OFFSET = 20;

/**
 * Floating card that appears near the cursor when hovering a node
 * on the ImpactCanvas. Auto-flips to avoid viewport clipping.
 */
export default function SymbolHoverCard({ symbol, x, y, onExplain }: Props) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  if (!symbol) return null;

  const flipX = x + CURSOR_OFFSET + CARD_WIDTH > viewport.width;
  const flipY = y + CURSOR_OFFSET + CARD_HEIGHT > viewport.height;

  const left = flipX ? Math.max(8, x - CARD_WIDTH - CURSOR_OFFSET) : x + CURSOR_OFFSET;
  const top = flipY ? Math.max(8, y - CARD_HEIGHT - CURSOR_OFFSET) : y + CURSOR_OFFSET;

  const pprPct = Math.round((symbol.ppr_score ?? 0) * 100);

  return (
    <div
      className="ce-symbol-card"
      role="tooltip"
      style={{ left, top, width: CARD_WIDTH }}
    >
      <div className="ce-symbol-card-head">
        <span
          className="ce-symbol-card-badge"
          style={{ color: ENTITY_COLORS[symbol.entity_type] }}
        >
          {ENTITY_LABELS[symbol.entity_type]}
        </span>
        <span className="ce-symbol-card-name">{symbol.name}</span>
      </div>

      <div className="ce-symbol-card-row">
        <span className="ce-symbol-card-label">PPR</span>
        <div className="ce-symbol-card-bar">
          <div
            className="ce-symbol-card-bar-fill"
            style={{ width: `${pprPct}%` }}
          />
        </div>
        <span className="ce-symbol-card-value">{pprPct}%</span>
      </div>

      {symbol.edge_types.length > 0 && (
        <div className="ce-symbol-card-row">
          <span className="ce-symbol-card-label">Via</span>
          <div className="ce-symbol-card-chips">
            {symbol.edge_types.map((et) => (
              <span
                key={et}
                className="ce-symbol-card-chip"
                style={{ color: EDGE_COLORS[et] }}
              >
                {EDGE_LABELS[et]}
              </span>
            ))}
          </div>
        </div>
      )}

      {symbol.processes.length > 0 && (
        <div className="ce-symbol-card-row">
          <span className="ce-symbol-card-label">In</span>
          <span className="ce-symbol-card-processes">
            {symbol.processes.length === 1
              ? symbol.processes[0]
              : `${symbol.processes.length} processes`}
          </span>
        </div>
      )}

      {onExplain && (
        <button
          type="button"
          className="ce-symbol-card-explain"
          onClick={() => onExplain(symbol.name)}
        >
          Explain this symbol
        </button>
      )}
    </div>
  );
}
