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
  { href: '/essays',      label: 'WIP',          icon: 'file-text' },
  { href: '/field-notes', label: 'Field Notes',   icon: 'note-pencil' },
  { href: '/research',    label: 'Paper Trails',  icon: 'magnifying-glass' },
  { href: '/projects',    label: 'Projects',      icon: 'briefcase' },
  { href: '/toolkit',     label: 'Toolkit',       icon: 'wrench' },
  { href: '/shelf',       label: 'Shelf',         icon: 'book-open' },
  { href: '/connect',     label: 'Connect',       icon: 'chat-circle' },
];

const README_LINK = { href: '/readme', label: 'README' };

// Three-stop color system: full (active), muted (dormant text), dim (dormant LED)
// Plus individual RGB channels for rgba() blending in CSS
interface NavTabColor {
  color: string;
  muted: string;
  dim: string;
  r: number;
  g: number;
  b: number;
}

const NAV_TAB_COLORS: Record<string, NavTabColor> = {
  '/essays':      { color: 'var(--nav-terracotta)',  muted: 'var(--nav-terracotta-muted)',  dim: 'var(--nav-terracotta-dim)',  r: 204, g: 126, b: 82 },
  '/field-notes': { color: 'var(--nav-teal)',        muted: 'var(--nav-teal-muted)',        dim: 'var(--nav-teal-dim)',        r: 74,  g: 154, b: 170 },
  '/research':    { color: 'var(--nav-teal)',        muted: 'var(--nav-teal-muted)',        dim: 'var(--nav-teal-dim)',        r: 74,  g: 154, b: 170 },
  '/projects':    { color: 'var(--nav-gold)',        muted: 'var(--nav-gold-muted)',        dim: 'var(--nav-gold-dim)',        r: 196, g: 154, b: 74 },
  '/toolkit':     { color: 'var(--nav-terracotta)',  muted: 'var(--nav-terracotta-muted)',  dim: 'var(--nav-terracotta-dim)',  r: 204, g: 126, b: 82 },
  '/shelf':       { color: 'var(--nav-gold)',        muted: 'var(--nav-gold-muted)',        dim: 'var(--nav-gold-dim)',        r: 196, g: 154, b: 74 },
  '/connect':     { color: 'var(--nav-teal)',        muted: 'var(--nav-teal-muted)',        dim: 'var(--nav-teal-dim)',        r: 74,  g: 154, b: 170 },
  '/readme':      { color: 'var(--nav-cream)',       muted: 'var(--nav-cream-muted)',       dim: 'var(--nav-cream-dim)',       r: 240, g: 235, b: 228 },
};

export default function TopNav({ navItems }: TopNavProps) {
  const allLinks: NavLink[] = navItems
    ? navItems.map((item) => ({
        href: item.path,
        label: item.label,
        icon: item.icon as IconName,
      }))
    : DEFAULT_NAV_LINKS;

  // Separate README from main nav (it renders with special styling)
  const navLinks = allLinks.filter((link) => link.href !== '/readme');
  const hasReadme = allLinks.some((link) => link.href === '/readme') || !navItems;

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
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <nav
      aria-label="Main navigation"
      className="sticky top-0 z-50 nav-fade safe-area-pad-top"
      style={{
        background: 'linear-gradient(to bottom, rgba(28, 28, 32, 0.78), rgba(28, 28, 32, 0.6))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 1px 12px rgba(28, 28, 32, 0.5)',
      }}
    >
      {/* Patent grid background (etched into the chrome surface) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(244,243,240,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(244,243,240,0.035) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          zIndex: 0,
        }}
      />

      <div className="relative w-full" style={{ zIndex: 1 }}>
        {/* Header row: site name + utilities */}
        <div className="flex items-center py-1.5 pb-1 px-4">
          {/* Site title (left) */}
          <Link
            href="/"
            className="no-underline hover:text-terracotta transition-colors shrink-0 flex flex-col"
            style={{ color: 'var(--color-hero-text)', fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: 15 }}
          >
            <span className="leading-tight">Travis Gilbert</span>
            <span
              className="hidden lg:block leading-tight"
              style={{
                fontFamily: 'var(--font-code)',
                fontSize: 9,
                letterSpacing: '0.1em',
                color: 'var(--color-teal)',
              }}
            >
              i&apos;m working here
            </span>
          </Link>

          {/* Utilities (right) */}
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            {/* Search trigger */}
            <button
              onClick={() => window.dispatchEvent(new Event('open-terminal'))}
              className="hover:text-terracotta transition-colors px-2 py-0.5 bg-transparent border-none min-h-[36px] inline-flex items-center gap-1.5 cursor-pointer"
              aria-label="Search (Cmd+K)"
              style={{ color: 'var(--color-hero-text-muted)' }}
            >
              <SketchIcon name="magnifying-glass" size={16} />
              <kbd
                className="hidden sm:inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono"
                style={{
                  fontSize: 10,
                  color: 'var(--color-hero-text-muted)',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                ⌘K
              </kbd>
            </button>

            {/* Theme toggle */}
            <ThemeToggle />

            {/* Mobile hamburger */}
            <button
              ref={hamburgerRef}
              className="lg:hidden flex flex-col items-center justify-center gap-1.5 p-3 -m-1 bg-transparent border-none cursor-pointer min-h-[44px] min-w-[44px]"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <span
                className={`block w-5 h-0.5 transition-transform ${
                  mobileOpen ? 'translate-y-2 rotate-45' : ''
                }`}
                style={{ backgroundColor: 'var(--color-hero-text)' }}
              />
              <span
                className={`block w-5 h-0.5 transition-opacity ${
                  mobileOpen ? 'opacity-0' : ''
                }`}
                style={{ backgroundColor: 'var(--color-hero-text)' }}
              />
              <span
                className={`block w-5 h-0.5 transition-transform ${
                  mobileOpen ? '-translate-y-2 -rotate-45' : ''
                }`}
                style={{ backgroundColor: 'var(--color-hero-text)' }}
              />
            </button>
          </div>
        </div>

        {/* Desktop tab bar */}
        <div className="hidden lg:block pb-0 px-3 relative">
          {/* Main tabs: centered */}
          <div className="flex items-end justify-center gap-0.5">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            const colors = NAV_TAB_COLORS[link.href];
            if (!colors) return null;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className="nav-tab group relative no-underline uppercase"
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: 11.5,
                  fontWeight: active ? 700 : 600,
                  letterSpacing: '0.06em',
                  padding: '4px 10px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: '5px 5px 0 0',
                  border: '1px solid transparent',
                  borderBottom: 'none',
                  transition: 'all 0.25s ease',
                  position: 'relative',
                  cursor: 'pointer',
                  // Color state
                  color: active ? colors.color : colors.muted,
                  background: active ? `rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.08)` : 'transparent',
                  borderColor: active ? `rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.22)` : 'transparent',
                  transform: active ? 'translateY(-4px)' : 'none',
                  zIndex: active ? 2 : 1,
                  marginBottom: active ? -1 : 0,
                  // CSS custom properties for hover styles
                  '--tab-color': colors.color,
                  '--tab-color-muted': colors.muted,
                  '--tab-r': String(colors.r),
                  '--tab-g': String(colors.g),
                  '--tab-b': String(colors.b),
                } as React.CSSProperties}
              >
                {/* Top edge marker (active only) */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[5px] right-[5px]"
                    style={{
                      top: 2,
                      height: 2,
                      borderRadius: 1,
                      background: colors.color,
                      boxShadow: `0 0 6px rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.45)`,
                    }}
                  />
                )}

                {/* LED indicator */}
                <span
                  aria-hidden="true"
                  className="led-dot"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    flexShrink: 0,
                    transition: 'all 0.3s',
                    background: active ? colors.color : colors.dim,
                    borderColor: active ? colors.color : colors.dim,
                    boxShadow: active
                      ? `0 0 4px rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.55), 0 0 10px rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.25)`
                      : 'none',
                  }}
                />

                {/* Icon: 50% dormant, 70% hover (via CSS), 100% active */}
                <span className="nav-tab-icon transition-opacity" style={{ opacity: active ? 1 : 0.5, display: 'flex' }}>
                  <SketchIcon
                    name={link.icon}
                    size={13}
                    strokeWidth={1.5}
                  />
                </span>

                {/* Label */}
                {link.label}
              </Link>
            );
          })}
          </div>

          {/* README tab: right-aligned, achromatic, no icon, no LED */}
          {hasReadme && (() => {
            const active = isActive(README_LINK.href);
            const colors = NAV_TAB_COLORS[README_LINK.href];
            if (!colors) return null;

            return (
              <Link
                href={README_LINK.href}
                aria-current={active ? 'page' : undefined}
                className="nav-tab nav-tab-readme no-underline uppercase"
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  padding: '4px 10px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '5px 5px 0 0',
                  border: '1px solid transparent',
                  borderBottom: 'none',
                  transition: 'all 0.25s ease',
                  position: 'absolute',
                  right: 60,
                  bottom: 0,
                  cursor: 'pointer',
                  color: active ? colors.color : colors.muted,
                  background: active ? `rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.06)` : 'transparent',
                  borderColor: active ? `rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.15)` : 'transparent',
                  transform: active ? 'translateY(-4px)' : 'none',
                  zIndex: active ? 2 : 1,
                  marginBottom: active ? -1 : 0,
                }}
              >
                {/* Top edge marker (active only) */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-[5px] right-[5px]"
                    style={{
                      top: 2,
                      height: 2,
                      borderRadius: 1,
                      background: colors.color,
                      boxShadow: `0 0 6px rgba(${colors.r}, ${colors.g}, ${colors.b}, 0.3)`,
                    }}
                  />
                )}
                {README_LINK.label}
              </Link>
            );
          })()}
        </div>

        {/* Tab edge line */}
        <div
          className="hidden lg:block mx-3"
          style={{
            height: 1,
            background: 'rgba(244, 243, 240, 0.06)',
          }}
        />
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div ref={mobileMenuRef} className="lg:hidden relative" style={{ backgroundColor: 'var(--color-nav-bg)', zIndex: 1 }}>
          <ul className="list-none m-0 px-3 py-4 flex flex-col gap-3">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              const colors = NAV_TAB_COLORS[link.href];
              if (!colors) return null;

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className="uppercase tracking-widest no-underline py-2 inline-flex items-center gap-2 min-h-[44px] transition-colors"
                    style={{
                      fontFamily: 'var(--font-code)',
                      fontSize: 14,
                      fontWeight: active ? 800 : 600,
                      letterSpacing: '0.1em',
                      color: active ? colors.color : colors.muted,
                    }}
                    onClick={closeMobile}
                  >
                    <SketchIcon
                      name={link.icon}
                      size={16}
                      className="transition-opacity"
                      strokeWidth={1.5}
                    />
                    {link.label}
                  </Link>
                </li>
              );
            })}

            {/* README separator + link */}
            {hasReadme && <li
              style={{
                borderTop: '1px solid rgba(244,243,240,0.08)',
                paddingTop: 12,
                marginTop: 4,
              }}
            >
              <Link
                href={README_LINK.href}
                aria-current={isActive(README_LINK.href) ? 'page' : undefined}
                className="uppercase tracking-widest no-underline py-2 inline-flex items-center min-h-[44px] transition-colors"
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: '0.1em',
                  color: isActive(README_LINK.href)
                    ? NAV_TAB_COLORS[README_LINK.href]?.color
                    : NAV_TAB_COLORS[README_LINK.href]?.muted,
                }}
                onClick={closeMobile}
              >
                {README_LINK.label}
              </Link>
            </li>}
          </ul>
        </div>
      )}
    </nav>
  );
}
