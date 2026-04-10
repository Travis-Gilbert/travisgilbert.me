'use client';

import type { NotebookDocument } from './NotebookLayout';

interface DocumentListProps {
  documents: NotebookDocument[];
  activeDocId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/**
 * DocumentList: left sidebar showing user's notebook documents.
 * Forked from Studio's SheetList concept.
 */
export default function DocumentList({
  documents,
  activeDocId,
  onSelect,
  onNew,
}: DocumentListProps) {
  return (
    <div className="notebook-doclist-inner">
      <div className="notebook-doclist-header">
        <span className="notebook-doclist-title">Notes</span>
        <button
          type="button"
          className="notebook-doclist-btn"
          onClick={onNew}
          aria-label="New note"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="notebook-doclist-items">
        {documents.map((doc) => (
          <button
            key={doc.id}
            type="button"
            className={`notebook-doclist-item${doc.id === activeDocId ? ' is-active' : ''}`}
            onClick={() => onSelect(doc.id)}
          >
            <span className="notebook-doclist-item-title">{doc.title}</span>
            <span className="notebook-doclist-item-date">
              {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
