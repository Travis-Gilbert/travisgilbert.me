'use client';

/**
 * ReaderPanelToc: left sliding panel with Table of Contents
 * and highlight list.
 *
 * Width: 236px when open, 0 when closed. Transition: 200ms.
 * Active heading tracks the currently focused paragraph.
 * Highlights section appears when highlights exist.
 */

import { useMemo } from 'react';
import type { ReaderParagraph, ReaderHighlight } from './reader-data';
import { extractToc } from './reader-utils';

/* ─────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────── */

interface ReaderPanelTocProps {
  open: boolean;
  paragraphs: ReaderParagraph[];
  focusIdx: number;
  highlights: Map<string, ReaderHighlight[]>;
  onScrollToParagraph: (paragraphId: string) => void;
}

/* ─────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────── */

export default function ReaderPanelToc({
  open,
  paragraphs,
  focusIdx,
  highlights,
  onScrollToParagraph,
}: ReaderPanelTocProps) {
  const toc = useMemo(() => extractToc(paragraphs), [paragraphs]);

  // Determine the active heading: the heading at or before the focused paragraph
  const activeHeadingId = useMemo(() => {
    if (focusIdx < 0) return null;
    const focusedPara = paragraphs[focusIdx];
    if (!focusedPara) return null;

    // If focused paragraph IS a heading, it's active
    if (focusedPara.type === 'heading') return focusedPara.id;

    // Otherwise, find the most recent heading before this index
    for (let i = focusIdx - 1; i >= 0; i--) {
      if (paragraphs[i].type === 'heading') return paragraphs[i].id;
    }
    return null;
  }, [focusIdx, paragraphs]);

  // Flatten highlights into a list for the highlights section
  const highlightEntries = useMemo(() => {
    const entries: { paragraphId: string; text: string }[] = [];
    highlights.forEach((list, paragraphId) => {
      for (const hl of list) {
        entries.push({ paragraphId, text: hl.text });
      }
    });
    return entries;
  }, [highlights]);

  return (
    <div className={`reader-panel-left${open ? ' open' : ''}`}>
      <div className="reader-panel-left-inner">
        {/* Heading list */}
        <div className="reader-panel-label">Contents</div>
        {toc.map((heading) => (
          <button
            key={heading.id}
            className={`reader-toc-item${heading.id === activeHeadingId ? ' active' : ''}`}
            onClick={() => onScrollToParagraph(heading.id)}
          >
            {heading.text}
          </button>
        ))}

        {toc.length === 0 && (
          <div
            style={{
              fontFamily: 'var(--r-font-ui)',
              fontSize: 11,
              color: 'var(--r-text-ghost)',
              padding: '8px 10px',
            }}
          >
            No headings found
          </div>
        )}

        {/* Highlights section */}
        {highlightEntries.length > 0 && (
          <div className="reader-toc-hl-section">
            <div className="reader-toc-hl-label">
              Highlights ({highlightEntries.length})
            </div>
            {highlightEntries.map((hl, i) => (
              <div
                key={`${hl.paragraphId}-${i}`}
                className="reader-toc-hl-item"
                onClick={() => onScrollToParagraph(hl.paragraphId)}
              >
                {hl.text.length > 90 ? hl.text.slice(0, 90) + '...' : hl.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
