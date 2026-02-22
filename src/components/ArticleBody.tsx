'use client';

/**
 * ArticleBody: thin Client Component wrapper for article prose.
 *
 * Exists solely to hold a ref to the prose container. Server Components
 * cannot hold refs (they are DOM-only), so this is the minimal client
 * boundary needed to make paragraph position measurement possible.
 *
 * The prose HTML is sourced from local .md files validated by Zod.
 * dangerouslySetInnerHTML here is equivalent to the same usage in page.tsx.
 */

import { useRef, type RefObject } from 'react';
import ArticleComments from '@/components/ArticleComments';
import ConnectionDots from '@/components/ConnectionDots';
import type { ContentType } from '@/lib/comments';
import type { PositionedConnection } from '@/lib/connectionEngine';

interface ArticleBodyProps {
  html: string;
  className?: string;
  contentType: ContentType;
  articleSlug: string;
  /** Serializable connection data (computed at build time in the Server Component) */
  positionedConnections?: PositionedConnection[];
}

export default function ArticleBody({
  html,
  className = 'prose',
  contentType,
  articleSlug,
  positionedConnections,
}: ArticleBodyProps) {
  const proseRef = useRef<HTMLDivElement>(null);

  return (
    <div className="article-body-wrapper" style={{ position: 'relative' }}>
      <div
        id="article-prose"
        ref={proseRef}
        className={className}
        // Content from trusted local .md files validated by Zod
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {positionedConnections && positionedConnections.length > 0 && (
        <ConnectionDots
          connections={positionedConnections}
          proseRef={proseRef}
        />
      )}
      <ArticleComments
        proseRef={proseRef as RefObject<HTMLDivElement>}
        contentType={contentType}
        articleSlug={articleSlug}
      />
    </div>
  );
}
