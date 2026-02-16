'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import SketchIcon from '@/components/rough/SketchIcon';
import type { IconName } from '@/components/rough/SketchIcon';

interface NavLink {
  href: string;
  label: string;
  icon: IconName;
}

const navLinks: NavLink[] = [
  { href: '/investigations', label: 'On ...', icon: 'magnifying-glass' },
  { href: '/field-notes', label: 'Field Notes', icon: 'note-pencil' },
  { href: '/projects', label: 'Projects', icon: 'briefcase' },
  { href: '/toolkit', label: 'Toolkit', icon: 'wrench' },
  { href: '/connect', label: 'Connect', icon: 'chat-circle' },
];

export default function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileOpen) closeMobile();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, closeMobile]);

  // Close mobile menu on route change
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  return (
    <nav className="sticky top-0 z-50 bg-paper/95 backdrop-blur-sm border-b border-border">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Site title */}
        <Link
          href="/"
          className="text-xl text-ink no-underline hover:text-terracotta transition-colors"
          style={{ fontFamily: 'var(--font-name)', fontWeight: 400 }}
        >
          Travis Gilbert
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6 list-none m-0 p-0">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
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

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2 bg-transparent border-none cursor-pointer"
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

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden bg-paper border-t border-border">
          <ul className="list-none m-0 p-4 flex flex-col gap-3">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`font-mono text-sm uppercase tracking-widest no-underline py-1 inline-flex items-center gap-2 ${
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
