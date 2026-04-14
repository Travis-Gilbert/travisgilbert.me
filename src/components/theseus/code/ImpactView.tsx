'use client';

import { useState } from 'react';
import type {
  CodeContextResult,
  CodeImpactResult,
  ImpactSymbol,
} from '@/lib/theseus-types';
import ImpactCanvas from './ImpactCanvas';
import ImpactLegend from './ImpactLegend';
import SymbolHoverCard from './SymbolHoverCard';

interface Props {
  focalSymbol: string | null;
  impact: CodeImpactResult | null;
  context: CodeContextResult | null;
  loading: boolean;
  onSymbolSelect: (name: string) => void;
  onExplain?: (symbolName: string) => void;
}

interface HoverState {
  symbol: ImpactSymbol | null;
  x: number;
  y: number;
}

const SAMPLE_QUERIES = [
  'What calls classify_answer_type?',
  'Impact of changing Object.epistemic_role',
  'Show me the ask pipeline',
];

export default function ImpactView({
  focalSymbol,
  impact,
  context,
  loading,
  onSymbolSelect,
  onExplain,
}: Props) {
  const [hover, setHover] = useState<HoverState>({ symbol: null, x: 0, y: 0 });

  if (!focalSymbol) {
    return (
      <div className="ce-empty">
        <div className="ce-empty-card">
          <div className="ce-empty-eyebrow">Code Explorer</div>
          <h2 className="ce-empty-title">Start with a symbol.</h2>
          <p className="ce-empty-body">
            Search for a function, class, or file above. Or ask a code question
            from the Ask panel, and jump here to see the blast radius.
          </p>
          <div className="ce-empty-examples">
            {SAMPLE_QUERIES.map((q) => (
              <div key={q} className="ce-empty-example">
                <span className="ce-empty-example-prefix">Try</span>
                <span className="ce-empty-example-text">{q}</span>
              </div>
            ))}
          </div>
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
