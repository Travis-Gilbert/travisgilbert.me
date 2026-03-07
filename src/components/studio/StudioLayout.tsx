'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { normalizeStudioContentType } from '@/lib/studio';
import { useIsAppShellMobile } from '@/hooks/useIsAppShellMobile';
import MobileTopBar from '@/components/mobile-shell/MobileTopBar';
import MobileDrawer from '@/components/mobile-shell/MobileDrawer';
import MobileSheet from '@/components/mobile-shell/MobileSheet';
import StudioSidebar from './StudioSidebar';
import WorkbenchPanel from './WorkbenchPanel';
import {
  StudioWorkbenchProvider,
  useStudioWorkbench,
} from './WorkbenchContext';
import { StudioViewProvider } from './StudioViewContext';
import type { StudioThemeMode } from './StudioViewContext';
import StudioMobileDock from './StudioMobileDock';
import NewContentModal from './NewContentModal';

const EDITOR_ROUTE_TYPES = new Set([
  'essay',
  'field-note',
  'shelf',
  'video',
  'project',
  'toolkit',
]);

function isEditorRoute(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 3 || segments[0] !== 'studio') {
    return false;
  }

  const maybeType = normalizeStudioContentType(segments[1]);
  return EDITOR_ROUTE_TYPES.has(maybeType);
}

function StudioLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const ZEN_MODE_STORAGE_KEY = 'studio-zen-mode-v1';
  const THEME_STORAGE_KEY = 'studio-theme-v1';
  const pathname = usePathname();
  const isAppShellMobile = useIsAppShellMobile();
  const { editorState } = useStudioWorkbench();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileWorkbenchOpen, setMobileWorkbenchOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [zenMode, setZenModeState] = useState(false);
  const [themeMode, setThemeModeState] = useState<StudioThemeMode>('dark');

  const editorMode = useMemo(() => isEditorRoute(pathname), [pathname]);
  const setZenMode = useCallback((enabled: boolean) => {
    setZenModeState(enabled);
    if (!enabled) return;
    setMobileOpen(false);
    setMobileWorkbenchOpen(false);
  }, []);

  const toggleZenMode = useCallback(() => {
    setZenModeState((prev) => !prev);
    setMobileOpen(false);
    setMobileWorkbenchOpen(false);
  }, []);

  const setThemeMode = useCallback((mode: StudioThemeMode) => {
    setThemeModeState(mode);
  }, []);

  const toggleThemeMode = useCallback(() => {
    setThemeModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(ZEN_MODE_STORAGE_KEY);
      if (!raw) return;
      setZenModeState(raw === 'true');
    } catch {
      setZenModeState(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ZEN_MODE_STORAGE_KEY, String(zenMode));
  }, [zenMode]);

  /* Theme: read from localStorage on mount */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === 'light' || raw === 'dark') {
        setThemeModeState(raw);
      }
    } catch {
      /* ignore */
    }
  }, []);

  /* Theme: persist to localStorage and sync DOM class */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    /* Apply class to the .studio-theme container */
    const themeEl = document.querySelector('.studio-theme');
    if (themeEl) {
      if (themeMode === 'light') {
        themeEl.classList.add('studio-theme-light');
      } else {
        themeEl.classList.remove('studio-theme-light');
      }
    }
  }, [themeMode]);

  useEffect(() => {
    setMobileOpen(false);
    setMobileWorkbenchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      const key = event.key.toLowerCase();

      /* Cmd+Shift+Z: zen mode */
      if (key === 'z') {
        event.preventDefault();
        toggleZenMode();
        return;
      }

      /* Cmd+Shift+T: toggle theme */
      if (key === 't') {
        event.preventDefault();
        toggleThemeMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleZenMode, toggleThemeMode]);

  return (
    <StudioViewProvider value={{ zenMode, setZenMode, toggleZenMode, themeMode, setThemeMode, toggleThemeMode }}>
      {!zenMode && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            display: isAppShellMobile ? 'none' : 'block',
          }}
        >
          <StudioSidebar />
        </div>
      )}

      {!zenMode && isAppShellMobile && (
        <MobileDrawer
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ariaLabel="Studio navigation drawer"
          backdropClassName="studio-mobile-backdrop"
          panelClassName="studio-sidebar-mobile"
          panelStyle={{
            width: 280,
            background: 'var(--studio-bg-sidebar)',
          }}
        >
          <StudioSidebar />
        </MobileDrawer>
      )}

      <main
        className="studio-main studio-scrollbar"
        data-zen-mode={zenMode ? 'true' : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          position: 'relative',
          height: '100vh',
        }}
      >
        {!zenMode && isAppShellMobile && (
          <MobileTopBar
            title="Studio."
            onMenu={() => setMobileOpen(true)}
            menuButtonClassName="studio-mobile-menu-btn"
            className="studio-mobile-header"
            titleClassName="studio-mobile-title"
            primaryAction={(
              <button
                type="button"
                className="studio-mobile-top-action"
                onClick={() => setShowNewModal(true)}
                aria-label="Create new content"
              >
                New
              </button>
            )}
          />
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </main>

      {!zenMode && isAppShellMobile && (
        <StudioMobileDock
          onOpenWorkbench={() => setMobileWorkbenchOpen(true)}
        />
      )}

      {!zenMode && !isAppShellMobile && (
        <WorkbenchPanel
          mode={editorMode ? 'editor' : 'dashboard'}
          editor={editorMode ? editorState.editor : null}
          contentItem={editorMode ? editorState.contentItem : null}
          onSave={editorMode ? editorState.onSave : undefined}
          lastSaved={editorMode ? editorState.lastSaved : null}
          saveState={editorMode ? editorState.saveState : 'idle'}
          autosaveState={editorMode ? editorState.autosaveState : 'idle'}
        />
      )}

      {!zenMode && isAppShellMobile && (
        <MobileSheet
          open={mobileWorkbenchOpen}
          onClose={() => setMobileWorkbenchOpen(false)}
          title="Workbench"
          className="studio-mobile-workbench-sheet"
        >
          <WorkbenchPanel
            mode={editorMode ? 'editor' : 'dashboard'}
            editor={editorMode ? editorState.editor : null}
            contentItem={editorMode ? editorState.contentItem : null}
            onSave={editorMode ? editorState.onSave : undefined}
            lastSaved={editorMode ? editorState.lastSaved : null}
            saveState={editorMode ? editorState.saveState : 'idle'}
            autosaveState={editorMode ? editorState.autosaveState : 'idle'}
            mobileSheetMode
          />
        </MobileSheet>
      )}

      {showNewModal && (
        <NewContentModal onClose={() => setShowNewModal(false)} />
      )}
    </StudioViewProvider>
  );
}

/**
 * Studio shell: sidebar + main + shared workbench panel.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudioWorkbenchProvider>
      <StudioLayoutInner>{children}</StudioLayoutInner>
    </StudioWorkbenchProvider>
  );
}
