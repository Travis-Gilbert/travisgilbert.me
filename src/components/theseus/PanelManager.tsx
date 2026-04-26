'use client';

import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export type PanelId =
  | 'ask'
  | 'explorer'
  | 'intelligence'
  | 'notebook'
  | 'connections'
  | 'plugins'
  | 'code'
  | 'lens';

const PANEL_COMPONENTS: Record<PanelId, React.LazyExoticComponent<React.ComponentType>> = {
  ask: lazy(() => import('./panels/AskPanel')),
  explorer: lazy(() => import('./panels/ExplorerPanel')),
  intelligence: lazy(() => import('./panels/IntelligencePanel')),
  notebook: lazy(() => import('./panels/NotebookPanel')),
  connections: lazy(() => import('./panels/ConnectionsPanel')),
  plugins: lazy(() => import('./panels/PluginsPanel')),
  code: lazy(() => import('./panels/CodePanel')),
  lens: lazy(() => import('./lens/LensPanel')),
};

const VALID_PANELS = new Set<string>([
  'ask',
  'explorer',
  'intelligence',
  'notebook',
  'connections',
  'plugins',
  'code',
  'lens',
]);

function isValidPanel(value: string | null): value is PanelId {
  return value !== null && VALID_PANELS.has(value);
}

interface PanelManagerProps {
  defaultPanel?: PanelId;
}

export default function PanelManager({ defaultPanel = 'ask' }: PanelManagerProps) {
  const searchParams = useSearchParams();
  const viewParam = searchParams?.get('view');
  const initialPanel = isValidPanel(viewParam) ? viewParam : defaultPanel;

  const [activePanel, setActivePanel] = useState<PanelId>(initialPanel);
  const [mountedPanels, setMountedPanels] = useState<Set<PanelId>>(
    () => new Set([initialPanel]),
  );

  const switchPanel = useCallback((panelId: PanelId) => {
    setMountedPanels((prev) => {
      if (prev.has(panelId)) return prev;
      const next = new Set(prev);
      next.add(panelId);
      return next;
    });
    setActivePanel(panelId);

    // Update URL without navigation (shallow)
    const url = new URL(window.location.href);
    url.searchParams.set('view', panelId);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Listen for sidebar/mobile-nav panel switch events
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ panel: PanelId }>).detail;
      if (detail?.panel && isValidPanel(detail.panel)) {
        switchPanel(detail.panel);
      }
    }
    window.addEventListener('theseus:switch-panel', handler);
    return () => window.removeEventListener('theseus:switch-panel', handler);
  }, [switchPanel]);

  // Expose switchPanel globally for cross-panel navigation
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__theseusSwitchPanel = switchPanel;
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__theseusSwitchPanel;
    };
  }, [switchPanel]);

  // Expose activePanel via data attribute for sidebar active state
  useEffect(() => {
    document.documentElement.setAttribute('data-theseus-panel', activePanel);
    return () => document.documentElement.removeAttribute('data-theseus-panel');
  }, [activePanel]);

  const panelEntries = useMemo(
    () => Array.from(mountedPanels),
    [mountedPanels],
  );

  return (
    <div className="theseus-panel-manager">
      {panelEntries.map((panelId) => {
        const Component = PANEL_COMPONENTS[panelId];
        const isActive = panelId === activePanel;
        return (
          <div
            key={panelId}
            className="theseus-panel"
            data-panel={panelId}
            data-active={isActive}
            style={{ display: isActive ? 'contents' : 'none' }}
          >
            <Suspense
              fallback={
                <div className="theseus-panel-loading">
                  <span className="theseus-panel-loading-text">LOADING</span>
                </div>
              }
            >
              <Component />
            </Suspense>
          </div>
        );
      })}
    </div>
  );
}

/** Hook for any component to switch panels via event dispatch. */
export function useSwitchPanel() {
  return useCallback((panel: PanelId, params?: Record<string, string>) => {
    window.dispatchEvent(
      new CustomEvent('theseus:switch-panel', { detail: { panel, ...params } }),
    );
  }, []);
}
