'use client';

import { useState, useCallback } from 'react';
import { useIsAppShellMobile } from '@/hooks/useIsAppShellMobile';
import CommonPlaceSidebar from './CommonPlaceSidebar';
import CommonPlaceTopBar from './CommonPlaceTopBar';
import CommonPlaceRail from './CommonPlaceRail';
import CaptureFAB from '../capture/CaptureFAB';
import DropZone from '../board/DropZone';
import SplitPaneContainer from '../panes/SplitPaneContainer';
import { useCapture } from '@/lib/providers/capture-provider';
import { syncCapture } from '@/lib/commonplace-capture';
import type { CapturedObject } from '@/lib/commonplace';
import styles from './CommonPlaceShell.module.css';

/**
 * CommonPlaceShell: client-side layout switcher.
 *
 * Reads `cp-nav-mode` from localStorage to choose between:
 *   - 'topbar': top command strip + optional icon rail + FAB (desktop only)
 *   - 'sidebar': traditional 200px sidebar (default on mobile, fallback)
 *
 * The sidebar is not deleted. Users can switch back via console:
 *   localStorage.setItem('cp-nav-mode', 'sidebar')
 */
export default function CommonPlaceShell() {
  const isMobile = useIsAppShellMobile();
  const { notifyCaptured } = useCapture();

  const [navMode] = useState<'topbar' | 'sidebar'>(() => {
    if (typeof window === 'undefined') return 'topbar';
    return (localStorage.getItem('cp-nav-mode') as 'topbar' | 'sidebar') || 'topbar';
  });

  const [railVisible, setRailVisible] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('cp-rail-visible') !== 'false';
  });

  const toggleRail = useCallback(() => {
    setRailVisible((prev) => {
      const next = !prev;
      localStorage.setItem('cp-rail-visible', String(next));
      return next;
    });
  }, []);

  const handleDropZoneCapture = useCallback(async (object: CapturedObject) => {
    await syncCapture(object);
    notifyCaptured();
  }, [notifyCaptured]);

  // Mobile always uses sidebar layout
  if (isMobile || navMode === 'sidebar') {
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
      </>
    );
  }

  // Desktop topbar layout
  return (
    <>
      <CommonPlaceTopBar railVisible={railVisible} onToggleRail={toggleRail} />
      <div className={styles.bodyArea}>
        <CommonPlaceRail visible={railVisible} />
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
      </div>
      <CaptureFAB />
      <DropZone onCapture={handleDropZoneCapture} />
    </>
  );
}
