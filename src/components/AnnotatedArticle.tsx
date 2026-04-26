'use client';

/**
 * AnnotatedArticle: positioned wrapper for essay reading layout.
 *
 * Coordinates ref sharing between ArticleBody and ScrollAnnotation.
 * Both need `proseRef` to call `measureParagraphOffsets()` for vertical
 * positioning. ConnectionDots remain inside ArticleBody (unchanged).
 *
 * Layout: single flow. ScrollAnnotations are absolutely positioned and
 * overflow into the right viewport margin (same pattern as StickyNoteLayer).
 * Below xl (1280px), annotations are hidden via CSS.
 *
 * Client Component because it owns the shared ref.
 */

import { useRef } from 'react';
import ArticleBody from '@/components/ArticleBody';
import ScrollAnnotation from '@/components/ScrollAnnotation';
import SidenoteMargin from '@/components/SidenoteMargin';
import type { ContentType } from '@/lib/comments';
import type { PositionedConnection } from '@/lib/connectionEngine';
import type { Sidenote } from '@/lib/content';

interface Annotation {
  paragraph: number;
  text: string;
}

interface AnnotatedArticleProps {
  html: string;
  className?: string;
  contentType: ContentType;
  articleSlug: string;
  /** Essay title forwarded to ConnectionDots for the popup graph header */
  essayTitle?: string;
  positionedConnections?: PositionedConnection[];
  /** Frontmatter annotations for scroll-reveal margin notes (legacy) */
  annotations?: Annotation[];
  /** Footnote-based sidenotes extracted at build time */
  sidenotes?: Sidenote[];
}

export default function AnnotatedArticle({
  html,
  className = 'prose',
  contentType,
  articleSlug,
  essayTitle,
  positionedConnections,
  annotations = [],
  sidenotes = [],
}: AnnotatedArticleProps) {
  const proseRef = useRef<HTMLDivElement>(null);

  return (
    <div className="annotated-article">
      <ArticleBody
        html={html}
        className={className}
        contentType={contentType}
        articleSlug={articleSlug}
        essayTitle={essayTitle}
        positionedConnections={positionedConnections}
        externalProseRef={proseRef}
      />
      {annotations.map((ann, i) => (
        <ScrollAnnotation
          key={`${ann.paragraph}-${i}`}
          text={ann.text}
          paragraphIndex={ann.paragraph}
          proseRef={proseRef}
          side={i % 2 === 0 ? 'right' : 'left'}
          style="handwritten"
        />
      ))}
      <SidenoteMargin sidenotes={sidenotes} proseRef={proseRef} />
    </div>
  );
}
