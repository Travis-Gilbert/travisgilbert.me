'use client';

import type { Suggestion } from './agents';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAction: (suggestion: Suggestion) => void;
}

export default function SuggestionCard({ suggestion: s, onAction }: SuggestionCardProps) {
  return (
    <div
      className="cw-suggestion"
      style={{
        '--suggestion-color': s.color,
        borderLeftColor: s.color,
      } as React.CSSProperties}
    >
      <div className="cw-suggestion-title">{s.title}</div>
      <div className="cw-suggestion-body">{s.body}</div>
      <button
        type="button"
        className="cw-suggestion-action"
        style={{ color: s.color }}
        onClick={() => onAction(s)}
      >
        {s.action}
      </button>
    </div>
  );
}
