'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClockRotateRight,
  PageEdit,
  Home,
  Notes,
  KanbanBoard,
  Tools,
} from 'iconoir-react';
import MobileTabs from '@/components/mobile-shell/MobileTabs';

interface StudioMobileDockProps {
  onOpenWorkbench: () => void;
}

const MOBILE_DOCK_ITEMS = [
  { key: 'home', href: '/studio', label: 'Home', icon: Home },
  { key: 'essays', href: '/studio/essays', label: 'Essays', icon: PageEdit },
  { key: 'notes', href: '/studio/field-notes', label: 'Notes', icon: Notes },
  { key: 'projects', href: '/studio/projects', label: 'Projects', icon: KanbanBoard },
  { key: 'timeline', href: '/studio/timeline', label: 'Timeline', icon: ClockRotateRight },
  { key: 'workbench', href: '', label: 'Workbench', icon: Tools },
] as const;

export default function StudioMobileDock({ onOpenWorkbench }: StudioMobileDockProps) {
  const pathname = usePathname();
  const router = useRouter();

  const activeKey = useMemo(() => {
    const matched = MOBILE_DOCK_ITEMS.find((item) => {
      if (!item.href) return false;
      return pathname === item.href || (item.href !== '/studio' && pathname?.startsWith(item.href));
    });

    return matched?.key ?? 'home';
  }, [pathname]);

  return (
    <MobileTabs
      items={MOBILE_DOCK_ITEMS.map((item) => {
        const Icon = item.icon;
        return {
          key: item.key,
          label: item.label,
          icon: <Icon width={16} height={16} aria-hidden="true" />,
          ariaLabel: item.label,
        };
      })}
      activeKey={activeKey}
      onChange={(key) => {
        const tab = MOBILE_DOCK_ITEMS.find((item) => item.key === key);
        if (!tab) return;

        if (tab.key === 'workbench') {
          onOpenWorkbench();
          return;
        }

        if (tab.href) {
          router.push(tab.href);
        }
      }}
      ariaLabel="Studio mobile navigation"
      containerClassName="studio-mobile-dock"
      itemClassName="studio-mobile-dock-item"
    />
  );
}
