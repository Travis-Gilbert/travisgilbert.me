'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Command } from 'cmdk';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';
import { useLayout } from '@/lib/providers/layout-provider';
import { useWorkspace } from '@/lib/providers/workspace-provider';
import { searchObjects } from '@/lib/commonplace-api';
import type { ObjectSearchResult } from '@/lib/commonplace-api';
import { OBJECT_TYPES } from '@/lib/commonplace';
import type { ScreenType, ViewType } from '@/lib/commonplace';
import { ACP_AGENTS } from '@/lib/commonplace-acp';

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
  { key: 'agent-thread' as ViewType, label: 'Open Agent Thread', hint: 'Talk to Theorem or dock an ACP agent' },
];

const SCREEN_ACTION_ITEMS = [
  { key: 'cobrowser' as ScreenType, label: 'Open Co-browser', hint: 'Desktop webview and page ingest controls' },
  { key: 'coordination' as ScreenType, label: 'Open Coordination', hint: 'Human and agent room feed' },
  { key: 'receiver' as ScreenType, label: 'Open Receiver', hint: 'Local agent execution status' },
  { key: 'desktop' as ScreenType, label: 'Open Desktop Settings', hint: 'Local node, keys, sync, and model controls' },
];

type AgentLaunchMode = 'api' | 'acp';
type AgentLaunchItem = {
  agentId: string;
  command: string;
  label: string;
  hint: string;
  mode: AgentLaunchMode;
};

const AGENT_LAUNCH_ITEMS: AgentLaunchItem[] = [
  {
    agentId: 'theorem',
    command: '/agent',
    label: 'Theorem Agent',
    hint: 'Use configured API heads',
    mode: 'api',
  },
  ...ACP_AGENTS.map((agent) => ({
    ...agent,
    mode: 'acp' as const,
  })),
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
  if (typeof window === 'undefined') return [];
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
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // non-blocking best effort
  }
}

export default function CommandPalette() {
  const { launchView, navigateToScreen } = useLayout();
  const { paletteOpen, openPalette, closePalette } = useWorkspace();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ObjectSearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<ObjectSearchResult[]>(() => loadRecent());
  const [searching, setSearching] = useState(false);
  const [showMoreTypes, setShowMoreTypes] = useState(false);
  const [morphingAgent, setMorphingAgent] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morphTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track paletteOpen in a ref so the hotkey handler never goes stale
  const paletteOpenRef = useRef(paletteOpen);
  useEffect(() => { paletteOpenRef.current = paletteOpen; }, [paletteOpen]);

  const resetPalette = useCallback(() => {
    setQuery('');
    setResults([]);
    setSearching(false);
    setShowMoreTypes(false);
    setMorphingAgent(null);
  }, []);

  const dismissPalette = useCallback(() => {
    resetPalette();
    closePalette();
  }, [closePalette, resetPalette]);

  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    if (paletteOpenRef.current) dismissPalette();
    else openPalette();
  });

  useHotkeys('mod+n', (e) => {
    e.preventDefault();
    launchView('compose');
    dismissPalette();
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().startsWith('/')) {
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

  useEffect(() => () => {
    if (morphTimeoutRef.current) clearTimeout(morphTimeoutRef.current);
  }, []);

  const handleOpenObject = useCallback(
    (result: ObjectSearchResult) => {
      launchView('object-detail', { objectSlug: result.slug });
      setRecentItems((prev) => {
        const deduped = [result, ...prev.filter((item) => item.id !== result.id)].slice(0, MAX_RECENT);
        saveRecent(deduped);
        return deduped;
      });
      dismissPalette();
      toast.success(`Opened: ${result.display_title || result.title}`);
    },
    [launchView, dismissPalette],
  );

  const handleAction = useCallback(
    (viewType: ViewType) => {
      if (viewType === 'agent-thread') {
        launchView(viewType, { agentId: 'theorem', agentMode: 'api' });
      } else {
        launchView(viewType);
      }
      dismissPalette();
    },
    [launchView, dismissPalette],
  );

  const handleScreenAction = useCallback(
    (screenType: ScreenType) => {
      navigateToScreen(screenType);
      dismissPalette();
    },
    [navigateToScreen, dismissPalette],
  );

  const handleCreate = useCallback(
    (objectType: string) => {
      launchView('compose', { prefillType: objectType });
      dismissPalette();
    },
    [launchView, dismissPalette],
  );

  const handleLaunchAgent = useCallback(
    (agentId: string, agentMode: AgentLaunchMode) => {
      setMorphingAgent(agentId);
      launchView('agent-thread', { agentId, agentMode });
      if (morphTimeoutRef.current) clearTimeout(morphTimeoutRef.current);
      morphTimeoutRef.current = setTimeout(() => {
        dismissPalette();
      }, 220);
    },
    [launchView, dismissPalette],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') dismissPalette();
    },
    [dismissPalette],
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

  const trimmedQuery = query.trim();
  const isAgentQuery = trimmedQuery.startsWith('/');
  const matchingAgents = useMemo(() => {
    if (!isAgentQuery) return [];
    const lowered = trimmedQuery.toLowerCase();
    return AGENT_LAUNCH_ITEMS.filter((agent) =>
      agent.command.startsWith(lowered) ||
      agent.label.toLowerCase().includes(lowered.slice(1)),
    );
  }, [isAgentQuery, trimmedQuery]);
  const showRecent = !isAgentQuery && !trimmedQuery && recentItems.length > 0;
  const showTypedGroups = !isAgentQuery && trimmedQuery && groupedResults.length > 0;
  const showActions = !isAgentQuery && (!trimmedQuery || results.length === 0);

  if (!paletteOpen) return null;

  return (
    <div
      className={`cp-palette-overlay${morphingAgent ? ' cp-palette-overlay--morphing' : ''}`}
      onClick={dismissPalette}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={handleKeyDown}
    >
      <div
        className={`cp-palette-container${morphingAgent ? ' cp-palette-container--morphing' : ''}`}
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
              placeholder="Search objects or type / for agents..."
              autoFocus
            />
            {searching && (
              <span className="cp-palette-spinner" aria-label="Searching" />
            )}
            <kbd className="cp-palette-esc-hint">Esc</kbd>
          </div>

          <Command.List className="cp-palette-list">
            {isAgentQuery && (
              <Command.Group heading="Agents" className="cp-palette-group">
                {matchingAgents.map((agent) => (
                  <Command.Item
                    key={agent.agentId}
                    value={`${agent.command} ${agent.label}`}
                    onSelect={() => handleLaunchAgent(agent.agentId, agent.mode)}
                    className="cp-palette-item cp-palette-item--action cp-palette-item--agent"
                  >
                    <span className="cp-palette-agent-command">{agent.command}</span>
                    <span className="cp-palette-item-title">{agent.label}</span>
                    <span className="cp-palette-item-meta">{agent.hint}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {trimmedQuery && !isAgentQuery && results.length === 0 && !searching && (
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
                    onSelect={() => handleCreate(objectType)}
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
                      onSelect={() => handleCreate(objectType)}
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
                    onSelect={() => handleAction(key)}
                    className="cp-palette-item cp-palette-item--action"
                  >
                    <span className="cp-palette-item-title">{label}</span>
                    <span className="cp-palette-item-meta">{hint}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {showActions && (
              <Command.Group heading="Desktop" className="cp-palette-group">
                {SCREEN_ACTION_ITEMS.map(({ key, label, hint }) => (
                  <Command.Item
                    key={key}
                    value={label}
                    onSelect={() => handleScreenAction(key)}
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
