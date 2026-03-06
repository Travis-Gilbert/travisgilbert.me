'use client';

import type { ReactNode } from 'react';

export interface MobileTabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  ariaLabel?: string;
}

interface MobileTabsProps {
  items: MobileTabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  containerClassName?: string;
  itemClassName?: string;
}

export default function MobileTabs({
  items,
  activeKey,
  onChange,
  ariaLabel = 'Mobile navigation tabs',
  containerClassName,
  itemClassName,
}: MobileTabsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      className={containerClassName ?? 'mobile-shell-tabs'}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            className={itemClassName ?? 'mobile-shell-tab'}
            data-active={active ? 'true' : 'false'}
            aria-label={item.ariaLabel ?? item.label}
            onClick={() => onChange(item.key)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
