'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PanelId } from './PanelManager';

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path
        d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.4876 3.36093 14.891 4 16.1272L3 21L7.8728 20C9.10904 20.6391 10.5124 21 12 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GraphIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <circle cx="5" cy="6" r="2" stroke="currentColor" />
      <circle cx="12" cy="18" r="2" stroke="currentColor" />
      <circle cx="19" cy="6" r="2" stroke="currentColor" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" />
      <path d="M6.5 7.5L10.5 11" stroke="currentColor" strokeLinecap="round" />
      <path d="M13.5 11L17.5 7.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M12 14V16" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function IntelligenceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21H15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2V5" stroke="currentColor" strokeLinecap="round" />
      <path d="M8.5 9H15.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M10 9V12.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M14 9V12.5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function ConnectionsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.5" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="2.2" stroke="currentColor" />
      <circle cx="18" cy="6" r="2.2" stroke="currentColor" />
      <circle cx="12" cy="18" r="2.4" stroke="currentColor" />
      <path d="M7.6 7.5l3.2 8.8" stroke="currentColor" strokeLinecap="round" />
      <path d="M16.4 7.5l-3.2 8.8" stroke="currentColor" strokeLinecap="round" />
      <path d="M8.1 6h7.8" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

interface MobileNavItem {
  id: string;
  label: string;
  panelId: PanelId;
  icon: React.ComponentType;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { id: 'ask',      label: 'Threads',  panelId: 'ask',      icon: ChatIcon },
  { id: 'explorer', label: 'Explorer', panelId: 'explorer', icon: GraphIcon },
  { id: 'connections', label: 'Sources', panelId: 'connections', icon: ConnectionsIcon },
  { id: 'intelligence', label: 'Intel', panelId: 'intelligence', icon: IntelligenceIcon },
];

/**
 * TheseusMobileNav: fixed bottom tab bar for small viewports.
 * Hidden on desktop (CSS media query); visible below 768px.
 *
 * W0: Switched from <Link> navigation to panel switching via
 * custom events. Active state reads from data-theseus-panel.
 */
export default function TheseusMobileNav() {
  const [activePanel, setActivePanel] = useState<PanelId>('ask');

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

  const handleSwitch = useCallback((panelId: PanelId) => {
    window.dispatchEvent(
      new CustomEvent('theseus:switch-panel', { detail: { panel: panelId } }),
    );
  }, []);

  return (
    <nav className="theseus-mobile-nav" aria-label="Theseus navigation">
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = activePanel === item.panelId;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={`theseus-mobile-nav-item${active ? ' is-active' : ''}`}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => handleSwitch(item.panelId)}
          >
            <Icon />
            <span className="theseus-mobile-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
