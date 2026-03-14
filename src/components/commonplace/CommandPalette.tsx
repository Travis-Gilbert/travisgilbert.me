'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Command } from 'cmdk';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { useCommonPlace } from '@/lib/commonplace-context';
import { searchObjects } from '@/lib/commonplace-api';
import type { ObjectSearchResult } from '@/lib/commonplace-api';
import { OBJECT_TYPES } from '@/lib/commonplace';
import type { ViewType } from '@/lib/commonplace';

/**
 * CommandPalette: Cmd+K interface for searching objects and navigating views.
 *
 * Uses cmdk with shouldFilter=false (server-side search via searchObjects()).
 * Always mounted inside CommonPlaceProvider so the Cmd+K hotkey is always live.
 * When paletteOpen is false the component renders null but hooks remain active.
 */

const ACTION_ITEMS = [
  { key: 'resurface' as ViewType, label: 'Open Resurface', hint: 'Surface forgotten objects' },
  { key: 'network' as ViewType, label: 'Open Knowledge Map', hint: 'Force-directed graph of all edges' },
  { key: 'timeline' as ViewType, label: 'Open Timeline', hint: 'Chronological capture feed' },
  { key: 'connection-engine' as ViewType, label: 'Open Connection Engine', hint: 'Discover and manage edges' },
];

const CORE_CREATE_SLUGS = new Set(['note', 'source', 'quote', 'hunch', 'person', 'concept']);

const CREATE_ITEMS_PRIMARY = OBJECT_TYPES
  .filter((type) => CORE_CREATE_SLUGS.has(type.slug))
  .map((type) => ({
    objectType: type.slug,
    label: `Create new ${type.label}`,
    hint: `Open Compose as ${type.label}`,
  }));

const CREATE_ITEMS_SECONDARY = OBJECT_TYPES
  .filter((type) => !CORE_CREATE_SLUGS.has(type.slug))
  .map((type) => ({
    objectType: type.slug,
    label: `Create new ${type.label}`,
    hint: `Open Compose as ${type.label}`,
  }));

const RECENT_KEY = 'cp-command-recent';
const MAX_RECENT = 8;

function loadRecent(): ObjectSearchResult[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ObjectSearchResult[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: ObjectSearchResult[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // non-blocking best effort
  }
}

export default function CommandPalette() {
  const { paletteOpen, openPalette, closePalette, requestView } = useCommonPlace();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ObjectSearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<ObjectSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showMoreTypes, setShowMoreTypes] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track paletteOpen in a ref so the hotkey handler never goes stale
  const paletteOpenRef = useRef(paletteOpen);
  useEffect(() => { paletteOpenRef.current = paletteOpen; }, [paletteOpen]);

  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    if (paletteOpenRef.current) closePalette();
    else openPalette();
  });

  useHotkeys('mod+n', (e) => {
    e.preventDefault();
    requestView('compose', 'Compose');
    closePalette();
  });

  useEffect(() => {
    setRecentItems(loadRecent());
  }, []);

  useEffect(() => {
    if (!paletteOpen) {
      setQuery('');
      setResults([]);
      setShowMoreTypes(false);
    }
  }, [paletteOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await searchObjects(query, 12);
        setResults(found);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleOpenObject = useCallback(
    (result: ObjectSearchResult) => {
      requestView('object-detail', result.display_title || result.title, {
        objectSlug: result.slug,
      });
      setRecentItems((prev) => {
        const deduped = [result, ...prev.filter((item) => item.id !== result.id)].slice(0, MAX_RECENT);
        saveRecent(deduped);
        return deduped;
      });
      closePalette();
      toast.success(`Opened: ${result.display_title || result.title}`);
    },
    [requestView, closePalette],
  );

  const handleAction = useCallback(
    (viewType: ViewType, label: string) => {
      requestView(viewType, label);
      closePalette();
    },
    [requestView, closePalette],
  );

  const handleCreate = useCallback(
    (objectType: string, label: string) => {
      requestView('compose', label, { prefillType: objectType });
      closePalette();
    },
    [requestView, closePalette],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') closePalette();
    },
    [closePalette],
  );

  const groupedResults = useMemo(() => {
    const groups = new Map<string, ObjectSearchResult[]>();
    for (const result of results) {
      const key = result.object_type_name || 'Other';
      const arr = groups.get(key) ?? [];
      arr.push(result);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [results]);

  const showRecent = !query.trim() && recentItems.length > 0;
  const showTypedGroups = query.trim() && groupedResults.length > 0;
  const showActions = !query.trim() || results.length === 0;

  if (!paletteOpen) return null;

  return (
    <div
      className="cp-palette-overlay"
      onClick={closePalette}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={handleKeyDown}
    >
      <div
        className="cp-palette-container"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} label="Command palette">
          <div className="cp-palette-input-wrap">
            <svg
              className="cp-palette-search-icon"
              width={16}
              height={16}
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx={6.5} cy={6.5} r={4} stroke="currentColor" strokeWidth={1.5} />
              <line x1={10} y1={10} x2={14} y2={14} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
            <Command.Input
              className="cp-palette-input"
              value={query}
              onValueChange={setQuery}
              placeholder="Search objects or open a view..."
              autoFocus
            />
            {searching && (
              <span className="cp-palette-spinner" aria-label="Searching" />
            )}
            <kbd className="cp-palette-esc-hint">Esc</kbd>
          </div>

          <Command.List className="cp-palette-list">
            {query.trim() && results.length === 0 && !searching && (
              <Command.Empty className="cp-palette-empty">
                No objects found for &ldquo;{query}&rdquo;
              </Command.Empty>
            )}

            {showRecent && (
              <Command.Group heading="Recent" className="cp-palette-group">
                {recentItems.map((r) => (
                  <Command.Item
                    key={`recent-${r.id}`}
                    value={`recent-${r.id}-${r.display_title || r.title}`}
                    onSelect={() => handleOpenObject(r)}
                    className="cp-palette-item"
                  >
                    <span
                      className="cp-palette-type-dot"
                      style={{ background: r.object_type_color || 'var(--cp-text-muted)' }}
                    />
                    <span className="cp-palette-item-title">{r.display_title || r.title}</span>
                    <span className="cp-palette-item-meta">{r.object_type_name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {showTypedGroups && groupedResults.map(([group, items]) => (
              <Command.Group key={group} heading={group} className="cp-palette-group">
                {items.map((r) => (
                  <Command.Item
                    key={`result-${r.id}`}
                    value={`${r.id}-${r.display_title || r.title}`}
                    onSelect={() => handleOpenObject(r)}
                    className="cp-palette-item"
                  >
                    <span
                      className="cp-palette-type-dot"
                      style={{ background: r.object_type_color || 'var(--cp-text-muted)' }}
                    />
                    <span className="cp-palette-item-title">{r.display_title || r.title}</span>
                    <span className="cp-palette-item-meta">{r.object_type_name}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}

            {showActions && (
              <Command.Group heading="Create" className="cp-palette-group">
                {CREATE_ITEMS_PRIMARY.map(({ objectType, label, hint }) => (
                  <Command.Item
                    key={objectType}
                    value={label}
                    onSelect={() => handleCreate(objectType, label)}
                    className="cp-palette-item cp-palette-item--action"
                  >
                    <span className="cp-palette-item-title">{label}</span>
                    <span className="cp-palette-item-meta">{hint}</span>
                  </Command.Item>
                ))}
                {!showMoreTypes ? (
                  <Command.Item
                    key="more-types"
                    value="More types..."
                    onSelect={() => setShowMoreTypes(true)}
                    className="cp-palette-item cp-palette-item--action"
                  >
                    <span className="cp-palette-item-title" style={{ opacity: 0.6 }}>
                      More types...
                    </span>
                  </Command.Item>
                ) : (
                  CREATE_ITEMS_SECONDARY.map(({ objectType, label, hint }) => (
                    <Command.Item
                      key={objectType}
                      value={label}
                      onSelect={() => handleCreate(objectType, label)}
                      className="cp-palette-item cp-palette-item--action"
                    >
                      <span className="cp-palette-item-title">{label}</span>
                      <span className="cp-palette-item-meta">{hint}</span>
                    </Command.Item>
                  ))
                )}
              </Command.Group>
            )}

            {showActions && (
              <Command.Group heading="Views" className="cp-palette-group">
                {ACTION_ITEMS.map(({ key, label, hint }) => (
                  <Command.Item
                    key={key}
                    value={label}
                    onSelect={() => handleAction(key, label)}
                    className="cp-palette-item cp-palette-item--action"
                  >
                    <span className="cp-palette-item-title">{label}</span>
                    <span className="cp-palette-item-meta">{hint}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
