'use client';

import type { ComponentType } from 'react';
import { useLayout } from '@/lib/providers/layout-provider';
import { useWorkspace } from '@/lib/providers/workspace-provider';
import type { ScreenType, ViewType } from '@/lib/commonplace';
import {
  Activity,
  DotsGrid3x3,
  EditPencil,
} from 'iconoir-react';
import CubeScanIcon from '../icons/CubeScanIcon';
import KeyframesSolidIcon from '../icons/KeyframesSolidIcon';
import SubstractIcon from '../icons/SubstractIcon';
import shellStyles from './CommonPlaceShell.module.css';

const NAV_ITEMS: Array<
  | { label: string; type: 'screen'; target: ScreenType; icon: ComponentType<{ width?: number; height?: number }> }
  | { label: string; type: 'view'; target: ViewType; icon: ComponentType<{ width?: number; height?: number }> }
> = [
  { label: 'Library', type: 'screen', target: 'library', icon: DotsGrid3x3 },
  { label: 'Models', type: 'screen', target: 'models', icon: CubeScanIcon },
  { label: 'Artifacts', type: 'view', target: 'artifacts', icon: KeyframesSolidIcon },
  { label: 'Compose', type: 'view', target: 'compose', icon: EditPencil },
  { label: 'Timeline', type: 'view', target: 'timeline', icon: Activity },
  { label: 'Map', type: 'view', target: 'network', icon: SubstractIcon },
];

interface CommonPlaceTopBarProps {
  railVisible: boolean;
  onToggleRail: () => void;
}

export default function CommonPlaceTopBar({ railVisible, onToggleRail }: CommonPlaceTopBarProps) {
  const { activeScreen, navigateToScreen, launchView } = useLayout();
  const { openPalette } = useWorkspace();

  return (
    <header className={shellStyles.topbar} style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      {/* Left: brand */}
      <a
        href="/commonplace"
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--cp-text)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        CommonPlace
      </a>

      {/* Center: nav items */}
      <nav className={shellStyles.topbarNav}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.type === 'screen'
              ? activeScreen === item.target
              : activeScreen === null; // views are active when no screen is active (approximation)

          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              className={shellStyles.topbarBtn}
              data-active={isActive}
              onClick={() => {
                if (item.type === 'screen') {
                  navigateToScreen(item.target);
                } else {
                  launchView(item.target);
                }
              }}
            >
              <Icon width={13} height={13} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Right zone */}
      <div className={shellStyles.topbarRight}>
        {/* Cmd+K button */}
        <button
          type="button"
          className={shellStyles.topbarCmd}
          onClick={() => openPalette()}
        >
          &#8984;K
        </button>

        {/* Rail toggle */}
        <button
          type="button"
          className={shellStyles.topbarToggle}
          data-active={railVisible}
          onClick={onToggleRail}
          aria-label={railVisible ? 'Hide icon rail' : 'Show icon rail'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="1" y="1" width="12" height="12" rx="2" />
            <line x1="5" y1="1" x2="5" y2="13" />
          </svg>
        </button>
      </div>
    </header>
  );
}
