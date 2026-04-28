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

function PluginsIcon() {
  // 4-rect grid + center traces (board-style).
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" />
      <path d="M10 6.5h4M10 17.5h4M6.5 10v4M17.5 10v4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function CodeIcon() {
  // Chevron-pair + slash.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path d="M16 18l6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6l-6 6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4l-4 16" stroke="currentColor" strokeLinecap="round" />
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
  { id: 'plugins',  label: 'Plugins',  panelId: 'plugins',  icon: PluginsIcon },
  { id: 'code',     label: 'Code',     panelId: 'code',     icon: CodeIcon },
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
