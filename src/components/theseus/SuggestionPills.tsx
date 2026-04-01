'use client';

import { useEffect, useState } from 'react';
import { getGraphWeather } from '@/lib/theseus-api';

interface SuggestionPillsProps {
  onSelect: (text: string) => void;
}

export function SuggestionPills({ onSelect }: SuggestionPillsProps) {
  const [pills, setPills] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await getGraphWeather();
      if (cancelled || !result.ok) return;

      const suggestions: string[] = [];
      const { total_objects, total_edges, total_clusters, recent_activity } = result;

      if (total_objects > 0) {
        suggestions.push(`${total_objects} objects in your graph`);
      }
      if (total_edges > 10) {
        suggestions.push(`${total_edges} connections discovered`);
      }
      if (total_clusters > 1) {
        suggestions.push(`${total_clusters} knowledge clusters`);
      }
      if (recent_activity) {
        suggestions.push(recent_activity);
      }
      if (suggestions.length < 3) {
        suggestions.push('What connects my ideas?');
      }

      setPills(suggestions.slice(0, 5));
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (pills.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        justifyContent: 'center',
      }}
    >
      {pills.map((text) => (
        <button
          key={text}
          onClick={() => onSelect(text)}
          style={{
            border: '1px solid var(--vie-border)',
            borderRadius: '16px',
            padding: '6px 14px',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: '12px',
            color: 'var(--vie-text-muted)',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--vie-border-active)';
            e.currentTarget.style.color = 'var(--vie-teal-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--vie-border)';
            e.currentTarget.style.color = 'var(--vie-text-muted)';
          }}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
