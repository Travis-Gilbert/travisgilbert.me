'use client';

import type { ScreenType } from '@/lib/commonplace';
import { useLayout } from '@/lib/providers/layout-provider';
import styles from './CommonPlaceRail.module.css';

interface RailItem {
  icon: string;
  label: string;
  screenType: ScreenType;
}

const RAIL_ITEMS: RailItem[] = [
  { icon: 'cellar', label: 'Home', screenType: 'daily' },
  { icon: 'grid', label: 'Library', screenType: 'library' },
  { icon: 'graph', label: 'Map', screenType: 'models' },
  { icon: 'book', label: 'Notebooks', screenType: 'notebooks' },
  { icon: 'engine', label: 'Engine', screenType: 'engine' },
];

/* SVG path data (subset of SidebarIcon paths) */
const PATHS: Record<string, string | string[]> = {
  cellar: [
    'M3 21H21V12C21 9.61305 20.0518 7.32387 18.364 5.63604C16.6761 3.94821 14.3869 3 12 3C9.61305 3 7.32387 3.94821 5.63604 5.63604C3.94821 7.32387 3 9.61305 3 12V21Z',
    'M3 17L21 17',
    'M9 17V13H21',
    'M13 13V9H20',
  ],
  grid: ['M3 3H9V9H3V3Z', 'M15 3H21V9H15V3Z', 'M3 15H9V21H3V15Z', 'M15 15H21V21H15V15Z'],
  graph: [
    'M5.164 17C5.453 15.951 5.833 14.949 6.296 14M11.5 7.794C12.282 7.228 13.118 6.726 14 6.296',
    'M4.5 22C3.119 22 2 20.881 2 19.5C2 18.119 3.119 17 4.5 17C5.881 17 7 18.119 7 19.5C7 20.881 5.881 22 4.5 22Z',
    'M9.5 12C8.119 12 7 10.881 7 9.5C7 8.119 8.119 7 9.5 7C10.881 7 12 8.119 12 9.5C12 10.881 10.881 12 9.5 12Z',
    'M19.5 7C18.119 7 17 5.881 17 4.5C17 3.119 18.119 2 19.5 2C20.881 2 22 3.119 22 4.5C22 5.881 20.881 7 19.5 7Z',
  ],
  book: [
    'M4 19V5C4 3.89543 4.89543 3 6 3H19.4C19.7314 3 20 3.26863 20 3.6V16.7143',
    'M6 17L20 17', 'M6 21L20 21',
    'M6 21C4.89543 21 4 20.1046 4 19C4 17.8954 4.89543 17 6 17',
    'M9 7L15 7',
  ],
  engine: [
    'M12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17Z',
    'M21 7.353V16.647C21 16.865 20.882 17.066 20.691 17.172L12.291 21.838C12.11 21.939 11.89 21.939 11.709 21.838L3.309 17.172C3.118 17.066 3 16.865 3 16.647V7.353C3 7.135 3.118 6.934 3.309 6.829L11.709 2.162C11.89 2.061 12.11 2.061 12.291 2.162L20.691 6.829C20.882 6.934 21 7.135 21 7.353Z',
    'M20.5 16.722L12.291 12.162C12.11 12.061 11.89 12.061 11.709 12.162L3.5 16.722',
    'M3.528 7.294L11.709 11.838C11.89 11.939 12.11 11.939 12.291 11.838L20.5 7.278',
    'M12 3V12', 'M12 19.5V22',
  ],
};

interface CommonPlaceRailProps {
  onExpand: () => void;
}

export default function CommonPlaceRail({ onExpand }: CommonPlaceRailProps) {
  const { activeScreen, navigateToScreen } = useLayout();

  return (
    <nav className={styles.rail}>
      <button className={styles.logo} onClick={onExpand} title="Expand sidebar">
        C
      </button>

      {RAIL_ITEMS.map((item) => {
        const isActive = activeScreen === item.screenType;
        return (
          <button
            key={item.screenType}
            className={`${styles.btn} ${isActive ? styles.active : ''}`}
            onClick={() => navigateToScreen(item.screenType)}
            title={item.label}
          >
            <RailIcon name={item.icon} active={isActive} />
          </button>
        );
      })}

      <div className={styles.status} title="Engine: running" />

      {/* Expand hover zone */}
      <div className={styles.expandZone} onClick={onExpand} />
    </nav>
  );
}

function RailIcon({ name, active }: { name: string; active?: boolean }) {
  const pathData = PATHS[name];
  if (!pathData) return null;
  const dValues = Array.isArray(pathData) ? pathData : [pathData];

  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--cp-terracotta-light)' : '#656570'}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {dValues.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
