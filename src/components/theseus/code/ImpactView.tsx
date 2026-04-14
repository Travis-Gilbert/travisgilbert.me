'use client';

import { useMemo, useState } from 'react';
import type {
  CodeContextResult,
  CodeImpactResult,
  CodeSymbol,
  ImpactSymbol,
} from '@/lib/theseus-types';
import ImpactCanvas from './ImpactCanvas';
import ImpactLegend from './ImpactLegend';
import SymbolHoverCard from './SymbolHoverCard';
import { ENTITY_COLORS, ENTITY_LABELS } from './codeColors';

interface Props {
  focalSymbol: string | null;
  impact: CodeImpactResult | null;
  context: CodeContextResult | null;
  loading: boolean;
  symbols: CodeSymbol[];
  symbolsLoading: boolean;
  onSymbolSelect: (name: string) => void;
  onRepoConnect: () => void;
  onExplain?: (symbolName: string) => void;
}

interface HoverState {
  symbol: ImpactSymbol | null;
  x: number;
  y: number;
}

/** Bias the jump-list towards the meaty entity types. */
const PRIORITY_ENTITY_TYPES: Record<string, number> = {
  code_structure: 3,
  code_member: 2,
  code_process: 2,
  specification: 1,
  fix_pattern: 0,
  commit: 0,
  code_file: -1,
};

const EMPTY_CHIP_LIMIT = 10;

export default function ImpactView({
  focalSymbol,
  impact,
  context,
  loading,
  symbols,
  symbolsLoading,
  onSymbolSelect,
  onRepoConnect,
  onExplain,
}: Props) {
  const [hover, setHover] = useState<HoverState>({ symbol: null, x: 0, y: 0 });

  const jumpList = useMemo(() => {
    const priority = (s: CodeSymbol) =>
      PRIORITY_ENTITY_TYPES[s.entity_type] ?? 0;
    return [...symbols]
      .sort((a, b) => priority(b) - priority(a))
      .slice(0, EMPTY_CHIP_LIMIT);
  }, [symbols]);

  if (!focalSymbol) {
    // Three empty states:
    //   - Loading symbols from the backend
    //   - Zero symbols ingested (prompt to connect a repo)
    //   - Symbols available (render clickable jump list)
    return (
      <div className="ce-empty">
        <div className="ce-empty-card">
          <div className="ce-empty-eyebrow">Code Explorer</div>
          <h2 className="ce-empty-title">Start with a symbol.</h2>
          <p className="ce-empty-body">
            Pick a symbol below to see its blast radius. Or search from the
            toolbar, or ingest a repo to grow the graph.
          </p>

          {symbolsLoading && symbols.length === 0 ? (
            <div className="ce-empty-loading">Loading symbols...</div>
          ) : symbols.length === 0 ? (
            <div className="ce-empty-zero">
              <p className="ce-empty-zero-text">
                No code ingested yet. Connect a repo to get started.
              </p>
              <button
                type="button"
                className="ce-empty-connect"
                onClick={onRepoConnect}
              >
                Connect a repo
              </button>
            </div>
          ) : (
            <div className="ce-empty-jumplist">
              <div className="ce-empty-jumplist-label">Jump to</div>
              <div className="ce-empty-jumplist-chips">
                {jumpList.map((s) => (
                  <button
                    key={s.object_id}
                    type="button"
                    className="ce-empty-chip"
                    onClick={() => onSymbolSelect(s.name)}
                    title={s.file_path}
                  >
                    <span
                      className="ce-empty-chip-badge"
                      style={{ color: ENTITY_COLORS[s.entity_type] }}
                    >
                      {ENTITY_LABELS[s.entity_type]}
                    </span>
                    <span className="ce-empty-chip-name">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading || !impact) {
    return (
      <div className="ce-loading">
        <div className="ce-loading-pulse" />
        <div className="ce-loading-label">Computing blast radius for {focalSymbol}</div>
      </div>
    );
  }

  return (
    <div className="ce-impact">
      <ImpactCanvas
        focalSymbol={focalSymbol}
        impact={impact}
        context={context}
        onSymbolSelect={onSymbolSelect}
        onSymbolHover={(symbol, x, y) => setHover({ symbol, x, y })}
      />
      <ImpactLegend impact={impact} focalSymbol={focalSymbol} />
      <SymbolHoverCard
        symbol={hover.symbol}
        x={hover.x}
        y={hover.y}
        onExplain={onExplain}
      />
    </div>
  );
}
