'use client';

import { useState, useEffect } from 'react';
import { useFloating, flip, shift, offset } from '@floating-ui/react';
import type { WikiSuggestionItem } from './extensions/WikiLinkSuggestion';

interface WikiLinkPopupProps {
  items: WikiSuggestionItem[];
  query: string;
  referenceRect: DOMRect | null;
  onSelect: (item: WikiSuggestionItem) => void;
  onClose: () => void;
}

export default function WikiLinkPopup({
  items,
  query,
  referenceRect,
  onSelect,
  onClose,
}: WikiLinkPopupProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const { refs, floatingStyles } = useFloating({
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  // Sync virtual reference from cursor rect
  useEffect(() => {
    if (referenceRect) {
      refs.setReference({
        getBoundingClientRect: () => referenceRect,
      });
    }
  }, [referenceRect, refs]);

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.text.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [items, query]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        onSelect(filtered[activeIndex]);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [filtered, activeIndex, onSelect]);

  return (
    <div
      className="studio-wiki-popup"
      ref={refs.setFloating}
      style={floatingStyles}
    >
      <div className="studio-wiki-popup-header">
        Link to Commonplace
        {query && (
          <span className="studio-wiki-popup-query">: &quot;{query}&quot;</span>
        )}
      </div>
      {!query ? (
        <div className="studio-wiki-popup-empty">Type to search...</div>
      ) : filtered.length === 0 ? (
        <div className="studio-wiki-popup-empty">
          No matching entries. Keep typing...
        </div>
      ) : (
        filtered.slice(0, 8).map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`studio-wiki-popup-item ${index === activeIndex ? 'is-active' : ''}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setActiveIndex(index)}
          >
            <div className="studio-wiki-popup-item-title">{item.title}</div>
            <div className="studio-wiki-popup-item-text">{item.text}</div>
            <div className="studio-wiki-popup-item-source">{item.source}</div>
          </button>
        ))
      )}
    </div>
  );
}
