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

function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path d="M13 16H18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 8L10 12L6 16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 18V6C2 4.89543 2.89543 4 4 4H20C21.1046 4 22 4.89543 22 6V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
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

function LibraryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.5" fill="none" aria-hidden="true">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6C5.55228 6 6 5.55228 6 5C6 4.44772 5.55228 4 5 4C4.44772 4 4 4.44772 4 5C4 5.55228 4.44772 6 5 6Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20C5.55228 20 6 19.5523 6 19C6 18.4477 5.55228 18 5 18C4.44772 18 4 18.4477 4 19C4 19.5523 4.44772 20 5 20Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 20C19.5523 20 20 19.5523 20 19C20 18.4477 19.5523 18 19 18C18.4477 18 18 18.4477 18 19C18 19.5523 18.4477 20 19 20Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
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
  { id: 'ask',      label: 'Ask',      panelId: 'ask',      icon: ChatIcon },
  { id: 'explorer', label: 'Explorer', panelId: 'explorer', icon: GraphIcon },
  { id: 'intelligence', label: 'Intelligence', panelId: 'intelligence', icon: IntelligenceIcon },
  { id: 'code',     label: 'Code',     panelId: 'code',     icon: CodeIcon },
  { id: 'library',  label: 'Library',  panelId: 'library',  icon: LibraryIcon },
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
