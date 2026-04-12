'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { searchObjects } from '@/lib/theseus-api';
import type { TheseusObject } from '@/lib/theseus-types';

const TYPE_COLORS: Record<string, string> = {
  source: '#2D5F6B',
  concept: '#7B5EA7',
  person: '#C4503C',
  hunch: '#C49A4A',
  note: '#9a958d',
};

interface ExplorerSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (objectId: string) => void;
}

export default function ExplorerSearch({ isOpen, onClose, onSelect }: ExplorerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TheseusObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const result = await searchObjects(query.trim(), 10);
      if (result.ok) {
        setResults(result.objects);
        setSelectedIndex(0);
      }
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = useCallback((objectId: string) => {
    onSelect(objectId);
    onClose();
  }, [onSelect, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex].id);
    }
  }, [onClose, results, selectedIndex, handleSelect]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="explorer-search-overlay" onClick={handleBackdropClick}>
      <div className="explorer-search-container">
        {/* Search input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            gap: 10,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="7" stroke="#7a7670" strokeWidth="1.5" />
            <path d="M16 16L20 20" stroke="#7a7670" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search objects..."
          />
          {loading && (
            <span style={{ color: '#7a7670', fontSize: 11, fontFamily: 'monospace' }}>
              ...
            </span>
          )}
        </div>

        {/* Results list */}
        {results.length > 0 && (
          <div className="explorer-search-results">
            {results.map((obj, index) => (
              <button
                key={obj.id}
                type="button"
                className={`explorer-search-result${index === selectedIndex ? ' is-selected' : ''}`}
                onClick={() => handleSelect(obj.id)}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: TYPE_COLORS[obj.object_type] ?? '#9a958d',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="explorer-search-result-title">
                    {obj.title}
                  </div>
                  {obj.summary && (
                    <div className="explorer-search-result-snippet">
                      {obj.summary.slice(0, 60)}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query.trim() && !loading && results.length === 0 && (
          <div className="explorer-search-empty">
            No results found
          </div>
        )}
      </div>
    </div>
  );
}
