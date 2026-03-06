'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClockCounterClockwise,
  FileText,
  House,
  NotePencil,
  Plus,
  Briefcase,
} from '@phosphor-icons/react';
import NewContentModal from './NewContentModal';

const MOBILE_DOCK_ITEMS = [
  { href: '/studio', label: 'Home', icon: House },
  { href: '/studio/essays', label: 'Essays', icon: FileText },
  { href: '/studio/field-notes', label: 'Notes', icon: NotePencil },
  { href: '/studio/projects', label: 'Projects', icon: Briefcase },
  { href: '/studio/timeline', label: 'Timeline', icon: ClockCounterClockwise },
];

export default function StudioMobileDock() {
  const pathname = usePathname();
  const [showNewModal, setShowNewModal] = useState(false);

  return (
    <>
      <nav className="studio-mobile-dock" aria-label="Studio mobile navigation">
        <div className="studio-mobile-dock-inner">
          {MOBILE_DOCK_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/studio' && pathname?.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="studio-mobile-dock-item"
                data-active={isActive ? 'true' : undefined}
              >
                <Icon size={16} weight="regular" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            className="studio-mobile-dock-new"
            onClick={() => setShowNewModal(true)}
            aria-label="Create new content"
          >
            <Plus size={16} weight="bold" aria-hidden="true" />
            <span>New</span>
          </button>
        </div>
      </nav>

      {showNewModal && (
        <NewContentModal onClose={() => setShowNewModal(false)} />
      )}
    </>
  );
}
