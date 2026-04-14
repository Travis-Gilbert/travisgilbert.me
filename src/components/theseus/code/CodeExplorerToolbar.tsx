'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CodeEntityType, CodeSymbol } from '@/lib/theseus-types';
import { ENTITY_COLORS, ENTITY_LABELS } from './codeColors';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  languageFilter: string | null;
  onLanguageChange: (lang: string | null) => void;
  entityTypeFilter: CodeEntityType | null;
  onEntityTypeChange: (t: CodeEntityType | null) => void;
  symbols: CodeSymbol[];
  onSymbolSelect: (name: string) => void;
  onRepoConnect: () => void;
  onDriftToggle: () => void;
  driftCount: number;
  driftOpen: boolean;
  onPatternsToggle: () => void;
  patternCount: number;
  patternsOpen: boolean;
}

const LANGUAGES = ['python', 'typescript', 'javascript', 'go', 'rust', 'java'] as const;

const ENTITY_TYPES: CodeEntityType[] = [
  'code_structure',
  'code_member',
  'code_process',
  'specification',
  'fix_pattern',
];

export default function CodeExplorerToolbar({
  searchQuery,
  onSearchChange,
  languageFilter,
  onLanguageChange,
  entityTypeFilter,
  onEntityTypeChange,
  symbols,
  onSymbolSelect,
  onRepoConnect,
  onDriftToggle,
  driftCount,
  driftOpen,
  onPatternsToggle,
  patternCount,
  patternsOpen,
}: Props) {
  const [typeaheadOpen, setTypeaheadOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeaheadRef = useRef<HTMLDivElement>(null);

  const typeaheadMatches = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return symbols
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, symbols]);

  // "/" focuses search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Click outside closes typeahead
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!typeaheadRef.current?.contains(e.target as Node)) {
        setTypeaheadOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="ce-toolbar">
      <div className="ce-toolbar-left">
        <div className="ce-toolbar-search" ref={typeaheadRef}>
          <svg
            className="ce-toolbar-search-icon"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            className="ce-toolbar-search-input"
            placeholder="Search symbols (press /)"
            value={searchQuery}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setTypeaheadOpen(true);
            }}
            onFocus={() => setTypeaheadOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onSearchChange('');
                setTypeaheadOpen(false);
                e.currentTarget.blur();
              }
              if (e.key === 'Enter' && typeaheadMatches.length > 0) {
                onSymbolSelect(typeaheadMatches[0].name);
                setTypeaheadOpen(false);
                e.currentTarget.blur();
              }
            }}
          />
          {typeaheadOpen && typeaheadMatches.length > 0 && (
            <div className="ce-toolbar-typeahead">
              {typeaheadMatches.map((s) => (
                <button
                  key={s.object_id}
                  type="button"
                  className="ce-toolbar-typeahead-item"
                  onClick={() => {
                    onSymbolSelect(s.name);
                    setTypeaheadOpen(false);
                  }}
                >
                  <span
                    className="ce-toolbar-typeahead-badge"
                    style={{ color: ENTITY_COLORS[s.entity_type] }}
                  >
                    {ENTITY_LABELS[s.entity_type]}
                  </span>
                  <span className="ce-toolbar-typeahead-name">{s.name}</span>
                  <span className="ce-toolbar-typeahead-path">{s.file_path}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <select
          className="ce-toolbar-select"
          value={languageFilter ?? ''}
          onChange={(e) => onLanguageChange(e.target.value || null)}
          aria-label="Filter by language"
        >
          <option value="">All languages</option>
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>

        <select
          className="ce-toolbar-select"
          value={entityTypeFilter ?? ''}
          onChange={(e) => onEntityTypeChange((e.target.value as CodeEntityType) || null)}
          aria-label="Filter by entity type"
        >
          <option value="">All types</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {ENTITY_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="ce-toolbar-right">
        <button
          type="button"
          className={`ce-toolbar-panel-btn${driftOpen ? ' is-active' : ''}`}
          onClick={onDriftToggle}
          aria-pressed={driftOpen}
          title="Spec drift"
        >
          <span>Drift</span>
          {driftCount > 0 && (
            <span className="ce-toolbar-panel-count ce-toolbar-panel-count-drift">
              {driftCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`ce-toolbar-panel-btn${patternsOpen ? ' is-active' : ''}`}
          onClick={onPatternsToggle}
          aria-pressed={patternsOpen}
          title="Fix patterns"
        >
          <span>Patterns</span>
          {patternCount > 0 && (
            <span className="ce-toolbar-panel-count">{patternCount}</span>
          )}
        </button>

        <button
          type="button"
          className="ce-toolbar-connect"
          onClick={onRepoConnect}
        >
          Connect repo
        </button>
      </div>
    </div>
  );
}
