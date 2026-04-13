'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
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

function NotebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 2H18C18.5523 2 19 2.44772 19 3V21C19 21.5523 18.5523 22 18 22H6C5.44772 22 5 21.5523 5 21V3C5 2.44772 5.44772 2 6 2Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 2V22" stroke="currentColor" strokeLinecap="round" />
      <path d="M12 7H16" stroke="currentColor" strokeLinecap="round" />
      <path d="M12 11H16" stroke="currentColor" strokeLinecap="round" />
      <path d="M12 15H14" stroke="currentColor" strokeLinecap="round" />
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

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.622 10.395L20.748 10.885C21.096 11.041 21.314 11.392 21.295 11.773L21.196 13.761C21.181 14.072 21.003 14.35 20.727 14.494L19.554 15.107C19.389 15.641 19.167 16.154 18.892 16.637L19.26 17.815C19.362 18.141 19.265 18.498 19.012 18.731L17.548 20.091C17.304 20.317 16.945 20.371 16.647 20.229L15.481 19.673C14.979 19.916 14.449 20.103 13.9 20.228L13.488 21.422C13.37 21.754 13.053 21.98 12.698 21.994L10.726 22.068C10.415 22.08 10.124 21.918 9.968 21.649L9.292 20.48C8.746 20.392 8.214 20.244 7.703 20.04L6.569 20.587C6.259 20.737 5.89 20.694 5.624 20.475L4.118 19.236C3.87 19.032 3.771 18.697 3.867 18.389L4.268 17.131C3.97 16.62 3.733 16.077 3.563 15.511L2.366 15.127C2.038 15.023 1.806 14.727 1.782 14.384L1.633 12.333C1.613 12.062 1.736 11.8 1.955 11.641L3.068 10.838C3.131 10.269 3.254 9.712 3.435 9.175L2.815 8.049C2.651 7.749 2.678 7.381 2.884 7.108L4.191 5.371C4.387 5.11 4.717 4.994 5.031 5.072L6.335 5.398C6.82 5.076 7.34 4.808 7.886 4.599L8.206 3.32C8.289 2.989 8.565 2.74 8.904 2.693L10.946 2.408C11.254 2.365 11.559 2.49 11.738 2.732L12.531 3.805C13.078 3.84 13.618 3.932 14.142 4.078L15.183 3.277C15.453 3.07 15.822 3.046 16.119 3.213L17.974 4.252C18.237 4.4 18.384 4.69 18.351 4.993L18.19 6.472C18.572 6.87 18.909 7.308 19.195 7.778L20.443 7.93C20.771 7.971 21.04 8.197 21.136 8.511L21.697 10.357" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
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

interface NavItem {
  id: string;
  label: string;
  panelId: PanelId;
  icon: React.ComponentType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'ask',      label: 'Ask',      panelId: 'ask',      icon: ChatIcon },
  { id: 'explorer', label: 'Explorer', panelId: 'explorer', icon: GraphIcon },
  { id: 'intelligence', label: 'Intelligence', panelId: 'intelligence', icon: IntelligenceIcon },
  { id: 'code',     label: 'Code',     panelId: 'code',     icon: CodeIcon },
  { id: 'notebook', label: 'Notebook', panelId: 'notebook', icon: NotebookIcon },
  { id: 'library',  label: 'Library',  panelId: 'library',  icon: LibraryIcon },
  { id: 'settings', label: 'Settings', panelId: 'settings', icon: SettingsIcon },
];

/**
 * TheseusSidebar: collapsible left rail with icon navigation.
 *
 * Always visible on desktop as a 48px icon rail. Expands to ~200px
 * on hover/focus to show labels. Hidden on mobile (TheseusMobileNav
 * renders the bottom bar instead).
 *
 * W0: Switched from <Link> navigation to panel switching via
 * custom events. Active state reads from data-theseus-panel
 * on <html> (set by PanelManager).
 */
export default function TheseusSidebar() {
  const [activePanel, setActivePanel] = useState<PanelId>('ask');

  // Read active panel from DOM attribute (set by PanelManager)
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
    <nav className="theseus-sidebar" aria-label="Theseus navigation">
      {/* Brand */}
      <div className="theseus-sidebar-brand">
        <button
          type="button"
          className="theseus-sidebar-brand-link"
          aria-label="Theseus home"
          onClick={() => handleSwitch('ask')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
            <g clipPath="url(#brand-clip)">
              <path d="M12 10C12.8284 10 13.5 9.32843 13.5 8.5C13.5 7.67157 12.8284 7 12 7C11.1716 7 10.5 7.67157 10.5 8.5C10.5 9.32843 11.1716 10 12 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 18C12.8284 18 13.5 17.3284 13.5 16.5C13.5 15.6716 12.8284 15 12 15C11.1716 15 10.5 15.6716 10.5 16.5C10.5 17.3284 11.1716 18 12 18Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16.25 14.25C17.0784 14.25 17.75 13.5784 17.75 12.75C17.75 11.9216 17.0784 11.25 16.25 11.25C15.4216 11.25 14.75 11.9216 14.75 12.75C14.75 13.5784 15.4216 14.25 16.25 14.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 10V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8.25 4.75L10.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.25 9.75L14.75 11.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11.5757 1.42426C11.81 1.18995 12.1899 1.18995 12.4243 1.42426L22.5757 11.5757C22.81 11.81 22.8101 12.1899 22.5757 12.4243L12.4243 22.5757C12.19 22.81 11.8101 22.8101 11.5757 22.5757L1.42426 12.4243C1.18995 12.19 1.18995 11.8101 1.42426 11.5757L11.5757 1.42426Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <defs>
              <clipPath id="brand-clip">
                <rect width="24" height="24" fill="white" />
              </clipPath>
            </defs>
          </svg>
        </button>
      </div>

      {/* Navigation items */}
      <div className="theseus-sidebar-items">
        {NAV_ITEMS.map((item) => {
          const active = activePanel === item.panelId;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`theseus-sidebar-item${active ? ' is-active' : ''}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => handleSwitch(item.panelId)}
            >
              <span className="theseus-sidebar-icon">
                <Icon />
              </span>
              <span className="theseus-sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
