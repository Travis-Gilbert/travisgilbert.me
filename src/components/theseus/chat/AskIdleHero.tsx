'use client';

import { useEffect, useState } from 'react';
import { useThreadRuntime } from '@assistant-ui/react';
import { Button } from '@/components/ui/button';
import type { FC } from 'react';

interface BriefingSuggestion {
  text: string;
  category?: string;
  rationale?: string;
}

async function fetchBriefing(): Promise<BriefingSuggestion[]> {
  try {
    const res = await fetch('/api/v2/theseus/briefing/', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const body = await res.json();
    const raw: unknown = body?.suggestions;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((s): BriefingSuggestion | null => {
        if (typeof s === 'string') return { text: s };
        if (s && typeof s === 'object' && typeof (s as { text?: unknown }).text === 'string') {
          return {
            text: (s as { text: string }).text,
            category: (s as { category?: string }).category,
            rationale: (s as { rationale?: string }).rationale,
          };
        }
        return null;
      })
      .filter((s): s is BriefingSuggestion => s !== null)
      .slice(0, 3);
  } catch {
    return [];
  }
}

/**
 * Empty-state hero. Rendered by ThreadPrimitive.Empty when the thread has
 * no messages yet. Parchment register: Courier Prime eyebrow in terracotta,
 * Vollkorn headline with an italicized follow-up line, up to three
 * suggestion pills pulled from `/api/v2/theseus/briefing/`. If briefing
 * returns no suggestions, only the headline renders (no fallback prompts,
 * per the project's "empty states are honest" rule in CLAUDE.md).
 */
const AskIdleHero: FC = () => {
  const [suggestions, setSuggestions] = useState<BriefingSuggestion[]>([]);
  const runtime = useThreadRuntime();

  useEffect(() => {
    let cancelled = false;
    fetchBriefing().then((rows) => {
      if (!cancelled) setSuggestions(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitSuggestion = (text: string) => {
    runtime.append({
      role: 'user',
      content: [{ type: 'text', text }],
    });
  };

  return (
    <div className="aui-thread-welcome-root my-auto flex grow flex-col">
      {/* Hero copy intentionally omitted: the composer at the bottom of
          the viewport is the only thing the user needs to see in the
          empty state. Briefing-backed suggestion pills render below when
          the endpoint returns any; nothing renders otherwise. */}

      {suggestions.length > 0 && (
        <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
          {suggestions.map((s, i) => (
            <div
              key={`${s.text}-${i}`}
              className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200"
            >
              <Button
                variant="ghost"
                onClick={() => submitSuggestion(s.text)}
                className="aui-thread-welcome-suggestion h-auto w-full flex-col flex-wrap items-start justify-start gap-1 rounded-3xl border px-4 py-3 text-left text-sm transition-colors"
              >
                <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                  {s.text}
                </span>
                {s.rationale && (
                  <span className="aui-thread-welcome-suggestion-text-2">
                    {s.rationale}
                  </span>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AskIdleHero;
