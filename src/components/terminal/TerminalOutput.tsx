'use client';

import type { SearchResult } from './pagefindSearch';
import TerminalResultCard from './TerminalResultCard';

interface TerminalOutputProps {
  results: SearchResult[];
  activeIndex: number;
  onSelect: (result: SearchResult) => void;
  helpVisible: boolean;
  commandOutput: string | null;
}

export default function TerminalOutput({
  results,
  activeIndex,
  onSelect,
  commandOutput,
}: TerminalOutputProps) {
  if (commandOutput) {
    return (
      <pre
        className="whitespace-pre-wrap text-xs mt-4"
        style={{ color: '#D4CCC4', fontFamily: 'var(--font-metadata)' }}
      >
        {commandOutput}
      </pre>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1">
      {results.map((r, i) => (
        <TerminalResultCard
          key={r.id}
          result={r}
          isActive={i === activeIndex}
          onClick={() => onSelect(r)}
        />
      ))}
    </div>
  );
}
