'use client';

import { useCallback, useEffect } from 'react';
import CommonPlaceSidebar from './CommonPlaceSidebar';
import SplitPaneContainer from '../panes/SplitPaneContainer';
import DropZone from '../board/DropZone';
import { useCapture } from '@/lib/providers/capture-provider';
import { syncCapture } from '@/lib/commonplace-capture';
import type { CapturedObject } from '@/lib/commonplace';

export default function CommonPlaceShell() {
  const { notifyCaptured } = useCapture();

  const handleDropZoneCapture = useCallback(async (object: CapturedObject) => {
    await syncCapture(object);
    notifyCaptured();
  }, [notifyCaptured]);

  /* Keyboard shortcuts migrated from CaptureFAB:
     C = focus the capture area in the sidebar
     T = scroll the sidebar to the toolbox section */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'c') {
        e.preventDefault();
        /* Focus the capture button/textarea in the sidebar */
        const captureEl = document.querySelector('.cp-sidebar-desktop .cp-capture-collapsed, .cp-sidebar-desktop .cp-capture-expanded textarea') as HTMLElement | null;
        if (captureEl) {
          captureEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          captureEl.click();
        }
      }

      if (e.key === 't') {
        e.preventDefault();
        /* Scroll to the toolbox section in the sidebar */
        const toolbox = document.querySelector('.cp-sidebar-desktop [data-section="work"]') as HTMLElement | null;
        if (toolbox) {
          toolbox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
      <CommonPlaceSidebar />
      <main
        className="cp-main-surface cp-grain"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <SplitPaneContainer />
      </main>
      <DropZone onCapture={handleDropZoneCapture} />
    </>
  );
}
