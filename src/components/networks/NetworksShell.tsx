'use client';

import { useMemo, useState, useEffect } from 'react';
import DotGrid from '@/components/DotGrid';
import { usePathname } from 'next/navigation';
import { useIsAppShellMobile } from '@/hooks/useIsAppShellMobile';
import MobileTopBar from '@/components/mobile-shell/MobileTopBar';
import MobileDrawer from '@/components/mobile-shell/MobileDrawer';
import MobileTabs from '@/components/mobile-shell/MobileTabs';
import NetworksSidebar from './NetworksSidebar';
import {
  NetworksShellProvider,
  type NetworksMobileTab,
} from './NetworksShellContext';

const MOBILE_TABS: Array<{ key: NetworksMobileTab; label: string }> = [
  { key: 'list', label: 'List' },
  { key: 'graph', label: 'Graph' },
  { key: 'search', label: 'Search' },
];

const TAB_TITLES: Record<NetworksMobileTab, string> = {
  list: 'Networks',
  graph: 'Network Graph',
  search: 'Search Nodes',
};

export default function NetworksShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMobile = useIsAppShellMobile();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NetworksMobileTab>('list');

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isMobile) return;
    setActiveTab('list');
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = mobileDrawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isMobile, mobileDrawerOpen]);

  const contextValue = useMemo(() => ({
    isMobile,
    activeTab,
    setActiveTab,
    openDrawer: () => setMobileDrawerOpen(true),
    closeDrawer: () => setMobileDrawerOpen(false),
  }), [isMobile, activeTab]);

  return (
    <div
      className="networks-theme"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--nw-bg)',
        color: 'var(--nw-text)',
        margin: 0,
      }}
    >
      <DotGrid dotColor={[245, 240, 232]} dotOpacity={0.12} noGradient />

      <NetworksShellProvider value={contextValue}>
        {!isMobile && <NetworksSidebar />}

        {isMobile && (
          <MobileDrawer
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            ariaLabel="Networks navigation drawer"
            backdropClassName="nw-mobile-backdrop"
            panelClassName="nw-mobile-drawer"
            panelStyle={{
              width: 'min(84vw, 320px)',
              backgroundColor: 'var(--nw-sidebar)',
            }}
          >
            <NetworksSidebar mobile onNavigate={() => setMobileDrawerOpen(false)} />
          </MobileDrawer>
        )}

        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {isMobile && (
            <MobileTopBar
              title={TAB_TITLES[activeTab]}
              onMenu={() => setMobileDrawerOpen(true)}
              menuAriaLabel="Open Networks navigation drawer"
              className="nw-mobile-top-bar"
              titleClassName="nw-mobile-title"
              menuButtonClassName="nw-mobile-menu-btn"
              primaryAction={(
                <button
                  type="button"
                  className="nw-mobile-capture-btn"
                  onClick={() => {
                    const input = document.getElementById('networks-capture-input') as HTMLInputElement | null;
                    if (input) {
                      input.focus();
                      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }}
                >
                  Capture
                </button>
              )}
            />
          )}

          <div
            className={isMobile ? 'mobile-bottom-nav-content-pad' : undefined}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
          >
            {children}
          </div>
        </main>

        {isMobile && (
          <MobileTabs
            items={MOBILE_TABS}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as NetworksMobileTab)}
            ariaLabel="Networks mobile tabs"
            containerClassName="nw-mobile-tabs"
            itemClassName="nw-mobile-tab"
          />
        )}
      </NetworksShellProvider>
    </div>
  );
}
