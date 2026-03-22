'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  Activity,
  Archive,
  BellNotification,
  Book,
  Box3dCenter,
  BrainResearch,
  Calendar,
  ClipboardCheck,
  DotsGrid3x3,
  EditPencil,
  Folder,
  HelpCircle,
  RoundFlask,
  Settings,
  UserStar,
} from 'iconoir-react';
import {
  autoUpdate,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { findLeafWithView } from '@/lib/commonplace-layout';
import { useLayout } from '@/lib/providers/layout-provider';
import styles from './CommonPlaceSidebar.module.css';
import CubeScanIcon from './icons/CubeScanIcon';
import KeyframesSolidIcon from './icons/KeyframesSolidIcon';
import SubstractIcon from './icons/SubstractIcon';

interface CommonPlaceRailProps {
  visible: boolean;
}

const RAIL_ICON_COMPONENTS: Record<string, ComponentType<{ width?: number; height?: number }>> = {
  grid: DotsGrid3x3,
  timeline: Activity,
  graph: Activity,
  calendar: Calendar,
  scatter: HelpCircle,
  engine: Box3dCenter,
  model: BrainResearch,
  bell: BellNotification,
  gear: Settings,
  book: Book,
  briefcase: Folder,
  'note-pencil': EditPencil,
  'brain-research': BrainResearch,
  'round-flask': RoundFlask,
  'user-star': UserStar,
  'check-list': ClipboardCheck,
  archive: Archive,
  'cube-scan': CubeScanIcon,
  'keyframes-solid': KeyframesSolidIcon,
  'substract': SubstractIcon,
};

const LABEL_ACCENT: Record<string, string> = {
  'Library': '#B8623D',
  'Models': '#B8623D',
  'Artifacts': '#B8623D',
  'Compose': '#B8623D',
  'Timeline': '#2D5F6B',
  'Map': '#2D5F6B',
  'Calendar': '#2D5F6B',
  'Loose Ends': '#2D5F6B',
  'Notebooks': '#C49A4A',
  'Projects': '#C49A4A',
  'Connection Engine': '#8B6FA0',
  'Settings': '#8B6FA0',
};

export default function CommonPlaceRail({ visible }: CommonPlaceRailProps) {
  const {
    activeScreen,
    navigateToScreen,
    launchView,
    layout,
  } = useLayout();

  const railItems: Array<
    | { key: string; icon: string; label: string; section: string; accentColor?: string; onClick: (e: React.MouseEvent) => void }
    | { key: string; divider: true }
  > = [
    { key: 'library', icon: 'grid', label: 'Library', section: 'capture', accentColor: activeScreen === 'library' ? LABEL_ACCENT['Library'] : undefined, onClick: () => navigateToScreen('library') },
    { key: 'models', icon: 'cube-scan', label: 'Models', section: 'capture', accentColor: activeScreen === 'models' ? LABEL_ACCENT['Models'] : undefined, onClick: () => navigateToScreen('models') },
    { key: 'compose', icon: 'note-pencil', label: 'Compose', section: 'capture', accentColor: findLeafWithView(layout, 'compose') ? LABEL_ACCENT['Compose'] : undefined, onClick: (e) => launchView('compose', undefined, e.shiftKey) },
    { key: 'divider-views', divider: true },
    { key: 'timeline', icon: 'timeline', label: 'Timeline', section: 'views', accentColor: findLeafWithView(layout, 'timeline') ? LABEL_ACCENT['Timeline'] : undefined, onClick: (e) => launchView('timeline', undefined, e.shiftKey) },
    { key: 'map', icon: 'graph', label: 'Map', section: 'views', accentColor: findLeafWithView(layout, 'network') ? LABEL_ACCENT['Map'] : undefined, onClick: (e) => launchView('network', undefined, e.shiftKey) },
    { key: 'calendar', icon: 'calendar', label: 'Calendar', section: 'views', accentColor: findLeafWithView(layout, 'calendar') ? LABEL_ACCENT['Calendar'] : undefined, onClick: (e) => launchView('calendar', undefined, e.shiftKey) },
    { key: 'loose-ends', icon: 'scatter', label: 'Loose Ends', section: 'views', accentColor: findLeafWithView(layout, 'loose-ends') ? LABEL_ACCENT['Loose Ends'] : undefined, onClick: (e) => launchView('loose-ends', undefined, e.shiftKey) },
    { key: 'divider-work', divider: true },
    { key: 'notebooks', icon: 'book', label: 'Notebooks', section: 'work', onClick: () => navigateToScreen('notebooks') },
    { key: 'projects', icon: 'briefcase', label: 'Projects', section: 'work', onClick: () => navigateToScreen('projects') },
    { key: 'divider-system', divider: true },
    { key: 'engine', icon: 'engine', label: 'Engine', section: 'system', accentColor: activeScreen === 'engine' ? LABEL_ACCENT['Connection Engine'] : undefined, onClick: () => navigateToScreen('engine') },
    { key: 'settings', icon: 'gear', label: 'Settings', section: 'system', onClick: () => navigateToScreen('settings') },
  ];

  return (
    <aside className={`${styles.rail}${visible ? '' : ` ${styles.railHidden}`}`} style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      {/* Brand abbreviation */}
      <Link
        href="/commonplace"
        title="CommonPlace"
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--cp-sidebar-text)',
          textDecoration: 'none',
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          marginBottom: 8,
          flexShrink: 0,
        }}
      >
        C
      </Link>

      {/* Navigation items */}
      {railItems.map((item) => {
        if ('divider' in item) {
          return (
            <div
              key={item.key}
              style={{
                width: 24,
                height: 1,
                margin: '4px 0',
                background: 'var(--cp-sidebar-border)',
              }}
            />
          );
        }

        return (
          <RailIconButton
            key={item.key}
            icon={item.icon}
            label={item.label}
            section={item.section}
            accentColor={item.accentColor}
            onClick={item.onClick}
          />
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Engine status dot */}
      <div
        title="Engine status"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--cp-term-green)',
          marginBottom: 4,
          opacity: 0.7,
        }}
      />
    </aside>
  );
}

function RailIconButton({
  icon,
  label,
  section,
  accentColor,
  onClick,
}: {
  icon: string;
  label: string;
  section?: string;
  accentColor?: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: hovered,
    onOpenChange: setHovered,
    placement: 'right',
    middleware: [offset(8), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);
  const Icon = RAIL_ICON_COMPONENTS[icon] ?? Activity;

  return (
    <div>
      <button
        ref={refs.setReference}
        type="button"
        className={`${styles.railBtn} ${styles.sidebarItem}`}
        aria-label={label}
        title={label}
        data-section={section}
        data-active={accentColor ? 'true' : undefined}
        onClick={onClick}
        {...getReferenceProps()}
      >
        <Icon width={16} height={16} />
      </button>
      {hovered && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            className={`commonplace-theme ${styles.railTooltip}`}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {label}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
