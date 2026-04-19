'use client';

import { MarkdownText } from '@/components/assistant-ui/markdown-text';
import CitationPart, { parseCitations } from './CitationPart';
import type { FC } from 'react';

interface TextPartProps {
  text?: string;
}

/**
 * Prose rendering for a single text message-part. Delegates to the forked
 * `MarkdownText` primitive for the common case; falls back to a split
 * renderer when the text contains `[CITE:source:year:confidence]anchor[/CITE]`
 * spans so `<CitationPart>` can hover-card each anchor.
 */
const TextPart: FC<TextPartProps> = ({ text }) => {
  if (!text) {
    // No text prop: default to the primitive's own render (streaming case).
    return <MarkdownText />;
  }

  const segments = parseCitations(text);
  if (segments.length === 1 && segments[0].kind === 'text') {
    return <MarkdownText />;
  }

  return (
    <span className="aui-text-part">
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return (
            <span key={i} className="aui-text-run">
              {seg.value}
            </span>
          );
        }
        return (
          <CitationPart
            key={i}
            source={seg.source}
            year={seg.year}
            confidence={seg.confidence}
            anchor={seg.anchor}
          />
        );
      })}
    </span>
  );
};

export default TextPart;
