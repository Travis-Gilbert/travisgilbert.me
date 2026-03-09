'use client';

/**
 * Settings layout: persistent tab navigation for settings sub-pages.
 *
 * Tabs: Overview, Design Tokens, Navigation, SEO, Compositions.
 * Active tab highlighted with terracotta underline.
 */

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';

const SETTINGS_TABS = [
  { label: 'Overview', href: '/studio/settings' },
  { label: 'Tokens', href: '/studio/settings/tokens' },
  { label: 'Navigation', href: '/studio/settings/navigation' },
  { label: 'SEO', href: '/studio/settings/seo' },
  { label: 'Compositions', href: '/studio/settings/compositions' },
] as const;

export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div style={{ padding: '32px 40px', maxWidth: '980px' }}>
      <div className="studio-section-head" style={{ marginTop: 0 }}>
        <span className="studio-section-label">Settings</span>
        <span className="studio-section-line" />
      </div>

      {/* Tab bar */}
      <nav
        style={{
          display: 'flex',
          gap: '2px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--studio-border)',
        }}
      >
        {SETTINGS_TABS.map((tab) => {
          const isActive =
            tab.href === '/studio/settings'
              ? pathname === '/studio/settings'
              : pathname?.startsWith(tab.href) ?? false;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: '8px 14px',
                fontFamily: 'var(--studio-font-mono)',
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.04em',
                color: isActive
                  ? 'var(--studio-tc-bright)'
                  : 'var(--studio-text-3)',
                textDecoration: 'none',
                borderBottom: isActive
                  ? '2px solid var(--studio-tc)'
                  : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'color 0.12s ease, border-color 0.12s ease',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
