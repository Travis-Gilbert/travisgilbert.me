'use client';

/**
 * ShelfBook: flat front-facing small book cover with tooltip on hover.
 * Used in the shelf sections for non-pinned notebooks.
 */

import type { ApiNotebookListItem } from '@/lib/commonplace';
import BookCover from './BookCover';

interface ShelfBookProps {
  notebook: ApiNotebookListItem;
  onClick: (slug: string) => void;
}

export default function ShelfBook({ notebook, onClick }: ShelfBookProps) {
  const isLoose = notebook.name.toLowerCase().includes('loose');

  return (
    <button
      type="button"
      className="cp-bookshelf-shelf-book"
      onClick={() => onClick(notebook.slug)}
      aria-label={`Open ${notebook.name}`}
    >
      <BookCover
        title={notebook.name}
        objectCount={notebook.object_count}
        color={notebook.color || '#8B6FA0'}
        size="shelf"
        isLoose={isLoose}
      />
      <div className="cp-bookshelf-tooltip">
        <div className="cp-bookshelf-tooltip-title">{notebook.name}</div>
        <div className="cp-bookshelf-tooltip-meta">
          {notebook.object_count === 0
            ? 'Empty notebook'
            : `${notebook.object_count} objects`}
        </div>
      </div>
    </button>
  );
}
