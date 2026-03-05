'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { normalizeStudioContentType } from '@/lib/studio';
import StudioSidebar from './StudioSidebar';
import WorkbenchPanel from './WorkbenchPanel';
import {
  StudioWorkbenchProvider,
  useStudioWorkbench,
} from './WorkbenchContext';

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
  const pathname = usePathname();
  const { editorState } = useStudioWorkbench();
  const [mobileOpen, setMobileOpen] = useState(false);

  const editorMode = useMemo(() => isEditorRoute(pathname), [pathname]);

  return (
    <>
      <div style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <StudioSidebar />
      </div>

      {mobileOpen && (
        <div
          className="studio-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className="studio-sidebar-mobile"
        data-open={mobileOpen ? 'true' : undefined}
      >
        <StudioSidebar />
      </div>

      <main
        className="studio-main studio-scrollbar"
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: 'auto',
          position: 'relative',
          height: '100vh',
        }}
      >
        <div className="studio-mobile-header">
          <button
            type="button"
            className="studio-mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="3" y1="5" x2="17" y2="5" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="15" x2="17" y2="15" />
            </svg>
          </button>
          <span
            style={{
              fontFamily: 'var(--studio-font-title)',
              fontWeight: 700,
              fontSize: '18px',
              color: 'var(--studio-text-bright)',
            }}
          >
            Studio
            <span style={{ color: 'var(--studio-tc)' }}>.</span>
          </span>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </main>

      <WorkbenchPanel
        mode={editorMode ? 'editor' : 'dashboard'}
        editor={editorMode ? editorState.editor : null}
        contentItem={editorMode ? editorState.contentItem : null}
        onSave={editorMode ? editorState.onSave : undefined}
        lastSaved={editorMode ? editorState.lastSaved : null}
        saveState={editorMode ? editorState.saveState : 'idle'}
        autosaveState={editorMode ? editorState.autosaveState : 'idle'}
      />
    </>
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
