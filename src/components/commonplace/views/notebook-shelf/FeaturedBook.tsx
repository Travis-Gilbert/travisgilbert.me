'use client';

/**
 * FeaturedBook: 3D angled book cover with metadata card below.
 * Uses CSS 3D transforms for perspective, page edges, and back cover.
 */

import type { ApiNotebookListItem } from '@/lib/commonplace';
import BookCover from './BookCover';

interface FeaturedBookProps {
  notebook: ApiNotebookListItem;
  onClick: (slug: string) => void;
}

export default function FeaturedBook({ notebook, onClick }: FeaturedBookProps) {
  return (
    <button
      type="button"
      className="cp-bookshelf-featured-card"
      onClick={() => onClick(notebook.slug)}
      aria-label={`Open ${notebook.name}`}
    >
      <div className="cp-bookshelf-book-3d">
        <div className="cp-bookshelf-book-3d-inner">
          <BookCover
            title={notebook.name}
            objectCount={notebook.object_count}
            color={notebook.color || '#8B6FA0'}
            size="featured"
          />
        </div>
      </div>
      <div className="cp-bookshelf-featured-info">
        <div className="cp-bookshelf-featured-title">{notebook.name}</div>
        <div className="cp-bookshelf-featured-meta">
          {notebook.object_count} objects
        </div>
        {notebook.description && (
          <div className="cp-bookshelf-featured-desc">
            {notebook.description}
          </div>
        )}
      </div>
    </button>
  );
}
