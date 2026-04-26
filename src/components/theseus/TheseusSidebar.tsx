'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PanelId } from './PanelManager';
import AtlasEmblem from './atlas/AtlasEmblem';
import ThreadsPlace, { type AtlasThread } from './atlas/ThreadsPlace';
import ExplorerPlace from './atlas/ExplorerPlace';
import AtlasFilterBlock from './atlas/AtlasFilterBlock';
import { ATLAS_SOURCES } from './atlas/sources';
import { useTheseus } from './TheseusShell';

interface TrailingPlace {
  panel: PanelId;
  n: string;
  label: string;
  meta: string;
}

const TRAILING_PLACES: TrailingPlace[] = [
  { panel: 'connections', n: '03', label: 'Connections', meta: '⌘3' },
  { panel: 'plugins', n: '04', label: 'Plugins', meta: '⌘4' },
  { panel: 'intelligence', n: '05', label: 'Intelligence', meta: '⌘5' },
  { panel: 'notebook', n: '06', label: 'Notebook', meta: '⌘6' },
];

/**
 * Atlas sidebar — 220px full sidebar replacing the old 48px icon rail.
 *
 * Layout: emblem top, numbered Places group, Connected sources group,
 * Filters block at bottom. Expandable rows for `Threads` and `Explorer`.
 * `⌘1`–`⌘6` jump to Places; `⌘K` opens the command palette (wired in
 * TheseusShell).
 */
export default function TheseusSidebar() {
  const { atlasFilters } = useTheseus();
  const [activePanel, setActivePanel] = useState<PanelId>('ask');
  const params = useSearchParams();
  const lensNodeId = params?.get('node') ?? null;

  // Read active panel from the DOM attribute PanelManager writes.
  useEffect(() => {
    function update() {
      const panel = document.documentElement.getAttribute('data-theseus-panel');
      if (panel) setActivePanel(panel as PanelId);
    }
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theseus-panel'],
    });
    return () => observer.disconnect();
  }, []);

  const switchPanel = useCallback((panelId: PanelId) => {
    window.dispatchEvent(
      new CustomEvent('theseus:switch-panel', { detail: { panel: panelId } }),
    );
  }, []);

  // Threads list is surfaced via an event contract that the Ask panel
  // (once mounted) populates. For Phase 1 we render an empty list; when
  // the Ask panel is mounted and a chat session has messages, those can
  // be published later via a shared store. No fake data is rendered.
  const [threads] = useState<AtlasThread[]>([]);

  return (
    <nav className="atlas-sidebar" aria-label="Theseus navigation">
      <AtlasEmblem />

      <div className="atlas-sidebar-scroll">
        {/* Places */}
        <div className="atlas-group">
          <div className="atlas-group-eyebrow">
            <span>Places</span>
          </div>

          <ThreadsPlace
            n="01"
            active={activePanel === 'ask'}
            onOpen={() => switchPanel('ask')}
            onNew={() => {
              switchPanel('ask');
              window.dispatchEvent(new CustomEvent('atlas:new-thread'));
            }}
            onPickThread={(thread) => {
              switchPanel('ask');
              window.dispatchEvent(
                new CustomEvent('atlas:pick-thread', { detail: { id: thread.id } }),
              );
            }}
            threads={threads}
          />

          <ExplorerPlace
            n="02"
            active={activePanel === 'explorer'}
            onOpen={() => switchPanel('explorer')}
            surfaces={atlasFilters.surfaces}
            onToggleSurface={atlasFilters.toggleSurface}
            scopeLabel={atlasFilters.scopeLabel}
          />

          {TRAILING_PLACES.map((p) => (
            <button
              key={p.panel}
              type="button"
              className={`atlas-nav-item${activePanel === p.panel ? ' active' : ''}`}
              onClick={() => switchPanel(p.panel)}
              aria-current={activePanel === p.panel ? 'page' : undefined}
            >
              <span className="n">{p.n}</span>
              <span>{p.label}</span>
              <span className="meta">{p.meta}</span>
            </button>
          ))}

          {lensNodeId && (
            <button
              type="button"
              className={`atlas-nav-item${activePanel === 'lens' ? ' active' : ''}`}
              onClick={() => switchPanel('lens')}
              aria-current={activePanel === 'lens' ? 'page' : undefined}
            >
              <span className="n">07</span>
              <span>Lens: {lensNodeId}</span>
              <span className="meta" />
            </button>
          )}
        </div>

        {/* Connected */}
        <div className="atlas-group">
          <div className="atlas-group-eyebrow">
            <span>Connected</span>
            <span style={{ opacity: 0.5 }}>{ATLAS_SOURCES.length}</span>
          </div>
          {ATLAS_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="atlas-nav-item"
              onClick={() => switchPanel('connections')}
              title={s.detail}
            >
              <span aria-hidden className="swatch" style={{ background: s.color }} />
              <span>{s.name}</span>
              <span className="meta" />
            </button>
          ))}
        </div>
      </div>

      {/* Filters — pinned to bottom, collapsible */}
      <AtlasFilterBlock
        activeSources={atlasFilters.activeSources}
        activeKinds={atlasFilters.activeKinds}
        onToggleSource={atlasFilters.toggleSource}
        onToggleKind={atlasFilters.toggleKind}
      />
    </nav>
  );
}
