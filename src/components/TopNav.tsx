'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import SketchIcon from '@/components/rough/SketchIcon';
import type { IconName } from '@/components/rough/SketchIcon';
import ThemeToggle from '@/components/ThemeToggle';

interface NavLink {
  href: string;
  label: string;
  icon: IconName;
}

interface TopNavProps {
  navItems?: Array<{
    label: string;
    path: string;
    icon: string;
  }>;
}

const DEFAULT_NAV_LINKS: NavLink[] = [
  { href: '/essays', label: 'Works in Progress', icon: 'file-text' },
  { href: '/field-notes', label: 'Field Notes', icon: 'note-pencil' },
  { href: '/projects', label: 'Projects', icon: 'briefcase' },
  { href: '/toolkit', label: 'Toolkit', icon: 'wrench' },
  { href: '/shelf', label: 'Shelf', icon: 'book-open' },
  { href: '/connect', label: 'Connect', icon: 'chat-circle' },
];

export default function TopNav({ navItems }: TopNavProps) {
  const navLinks: NavLink[] = navItems
    ? navItems.map((item) => ({
        href: item.path,
        label: item.label,
        icon: item.icon as IconName,
      }))
    : DEFAULT_NAV_LINKS;

  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Close on Escape key + focus trap for mobile menu
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileOpen) {
        closeMobile();
        hamburgerRef.current?.focus();
        return;
      }

      // Focus trap: wrap Tab within the mobile menu
      if (e.key === 'Tab' && mobileOpen && mobileMenuRef.current) {
        const focusable = mobileMenuRef.current.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, closeMobile]);

  // Focus first menu item when mobile menu opens
  useEffect(() => {
    if (mobileOpen && mobileMenuRef.current) {
      const first = mobileMenuRef.current.querySelector<HTMLElement>('a');
      first?.focus();
    }
  }, [mobileOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  return (
    <nav aria-label="Main navigation" className="sticky top-0 z-50 backdrop-blur-sm border-b border-border" style={{ backgroundColor: 'color-mix(in srgb, var(--color-nav-bg) 95%, transparent)' }}>
      <div className="w-full px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Site title */}
        <Link
          href="/"
          className="text-xl text-ink no-underline hover:text-terracotta transition-colors"
          style={{ fontFamily: 'var(--font-name)', fontWeight: 400 }}
        >
          Travis Gilbert
        </Link>

        <div className="flex items-center gap-3">
          {/* Desktop nav */}
          <ul className="hidden md:flex items-center gap-4 list-none m-0 p-0">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`font-mono text-xs uppercase tracking-widest no-underline transition-colors inline-flex items-center gap-1.5 ${
                      active
                        ? 'text-terracotta font-bold'
                        : 'text-ink-secondary hover:text-terracotta'
                    }`}
                  >
                    <SketchIcon name={link.icon} size={16} />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Theme toggle (visible at all breakpoints) */}
          <ThemeToggle />

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            className="md:hidden flex flex-col gap-1.5 p-3 -m-1 bg-transparent border-none cursor-pointer"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <span
              className={`block w-5 h-0.5 bg-ink transition-transform ${
                mobileOpen ? 'translate-y-2 rotate-45' : ''
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-ink transition-opacity ${
                mobileOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block w-5 h-0.5 bg-ink transition-transform ${
                mobileOpen ? '-translate-y-2 -rotate-45' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div ref={mobileMenuRef} className="md:hidden bg-paper border-t border-border">
          <ul className="list-none m-0 p-4 flex flex-col gap-3">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`font-mono text-sm uppercase tracking-widest no-underline py-2 inline-flex items-center gap-2 ${
                      active
                        ? 'text-terracotta font-bold'
                        : 'text-ink-secondary hover:text-terracotta'
                    }`}
                    onClick={closeMobile}
                  >
                    <SketchIcon name={link.icon} size={16} />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
