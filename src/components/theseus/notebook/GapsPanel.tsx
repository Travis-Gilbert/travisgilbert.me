'use client';

import { useEffect, useState, useRef } from 'react';
import { askTheseusAsyncStream } from '@/lib/theseus-api';
import type { TheseusResponse } from '@/lib/theseus-types';

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
 *
 * Routes through askTheseusAsyncStream so the 500ms-debounced query
 * exercises the RQ-backed async pipeline (Modal 26B with container
 * prewarm). include_web=false: the panel runs on every keystroke and
 * does not need external research for gap detection.
 */
export default function GapsPanel({ documentContent }: GapsPanelProps) {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const parser = new DOMParser();
    const doc = parser.parseFromString(documentContent, 'text/html');
    const text = doc.body.textContent?.trim() ?? '';
    if (text.length < 20) {
      setGaps([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      cleanupRef.current?.();

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      const handleComplete = (result: TheseusResponse) => {
        const sections = (result.sections ?? []) as unknown as Array<Record<string, unknown>>;
        const gapSection = sections.find((s) => s.type === 'structural_gap');
        if (
          gapSection
          && Array.isArray(gapSection.gaps)
        ) {
          setGaps(
            (gapSection.gaps as Array<{
              description?: string;
              entities?: string[];
            }>).map((g) => ({
              description: g.description ?? '',
              entities: g.entities ?? [],
            })),
          );
        } else {
          setGaps([]);
        }
        setLoading(false);
      };

      askTheseusAsyncStream(
        `Knowledge gaps about: ${text.slice(0, 200)}`,
        { include_web: false, signal: controller.signal },
        {
          onStage: () => {},
          onToken: () => {},
          onComplete: handleComplete,
          onError: () => {
            setLoading(false);
          },
        },
      )
        .then((cleanup) => {
          cleanupRef.current = cleanup;
        })
        .catch(() => {
          setLoading(false);
        });
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      cleanupRef.current?.();
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
