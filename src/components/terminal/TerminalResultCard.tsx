'use client';

import type { SearchResult } from './pagefindSearch';

const TYPE_COLORS: Record<string, string> = {
  essay: '#B45A2D',
  'field-note': '#2D5F6B',
  shelf: '#C49A4A',
  project: '#C49A4A',
  toolkit: '#5A7A4A',
  page: '#6A5E52',
};

interface TerminalResultCardProps {
  result: SearchResult;
  isActive: boolean;
  onClick: () => void;
}

export default function TerminalResultCard({ result, isActive, onClick }: TerminalResultCardProps) {
  const color = TYPE_COLORS[result.contentType] ?? '#6A5E52';
  const typeLabel = result.contentType.replace('-', ' ').toUpperCase();

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 border-l-[3px] transition-colors cursor-pointer bg-transparent border-none"
      style={{
        borderLeftColor: color,
        backgroundColor: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="flex items-baseline gap-3 font-mono text-xs">
        {isActive && <span style={{ color }} aria-hidden="true">&gt;</span>}
        <span style={{ color, fontFamily: 'var(--font-metadata)', fontSize: 10 }}>
          [{typeLabel}]
        </span>
        <span
          className="font-semibold truncate"
          style={{ color: isActive ? '#B45A2D' : '#D4CCC4' }}
        >
          {result.title}
        </span>
      </div>
      <p
        className="mt-0.5 ml-6 text-xs truncate"
        style={{ color: '#6A5E52', fontFamily: 'var(--font-metadata)', fontSize: 12 }}
      >
        {result.excerpt}
      </p>
      <p
        className="mt-0.5 ml-6 text-xs"
        style={{ color: '#5A5652', fontFamily: 'var(--font-metadata)', fontSize: 10 }}
      >
        {result.url}
      </p>
    </button>
  );
}
