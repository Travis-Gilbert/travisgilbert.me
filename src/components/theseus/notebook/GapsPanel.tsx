'use client';

import { useEffect, useState, useRef } from 'react';
import { askTheseus } from '@/lib/theseus-api';

interface KnowledgeGap {
  description: string;
  entities: string[];
}

interface GapsPanelProps {
  documentContent: string;
}

/**
 * GapsPanel: shows structural gaps detected from the note's entities.
 *
 * "You mention X but the graph has no connections between X and Y."
 * Each gap has a "Learn more" button that fires an ask query.
 */
export default function GapsPanel({ documentContent }: GapsPanelProps) {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const parser = new DOMParser();
    const doc = parser.parseFromString(documentContent, 'text/html');
    const text = doc.body.textContent?.trim() ?? '';
    if (text.length < 20) {
      setGaps([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await askTheseus(`Knowledge gaps about: ${text.slice(0, 200)}`);
        if (result.ok) {
          const gapSection = result.sections.find((s) => s.type === 'structural_gap');
          if (gapSection && 'gaps' in gapSection && Array.isArray((gapSection as Record<string, unknown>).gaps)) {
            setGaps(
              ((gapSection as Record<string, unknown>).gaps as Array<{ description?: string; entities?: string[] }>).map((g) => ({
                description: g.description ?? '',
                entities: g.entities ?? [],
              })),
            );
          } else {
            setGaps([]);
          }
        }
      } catch {
        // API not available
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [documentContent]);

  const handleLearnMore = (gap: KnowledgeGap) => {
    const query = gap.description;
    window.dispatchEvent(
      new CustomEvent('theseus:switch-panel', { detail: { panel: 'ask' } }),
    );
    requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('theseus:prefill-ask', { detail: { query } }),
      );
    });
  };

  if (loading) {
    return <p className="notebook-tab-loading">SCANNING FOR GAPS</p>;
  }

  if (gaps.length === 0) {
    return (
      <div className="notebook-tab-empty">
        <p className="notebook-tab-desc">
          No knowledge gaps detected. Keep writing to see what your
          graph is missing.
        </p>
      </div>
    );
  }

  return (
    <div className="notebook-gaps-list">
      {gaps.map((gap, i) => (
        <div key={i} className="notebook-gap-card">
          <p className="notebook-gap-desc">{gap.description}</p>
          {gap.entities.length > 0 && (
            <div className="notebook-gap-entities">
              {gap.entities.map((e) => (
                <span key={e} className="notebook-gap-entity">{e}</span>
              ))}
            </div>
          )}
          <button
            type="button"
            className="notebook-gap-learn"
            onClick={() => handleLearnMore(gap)}
          >
            Learn more
          </button>
        </div>
      ))}
    </div>
  );
}
