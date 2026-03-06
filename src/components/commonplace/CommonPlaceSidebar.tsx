'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { SIDEBAR_SECTIONS, OBJECT_TYPES } from '@/lib/commonplace';
import type { CapturedObject } from '@/lib/commonplace';
import { createCapturedObject, syncCapture } from '@/lib/commonplace-capture';
import { useCommonPlace } from '@/lib/commonplace-context';
import CaptureButton from './CaptureButton';
import ObjectPalette from './ObjectPalette';
import RecentCaptures from './RecentCaptures';
import DropZone from './DropZone';

/**
 * CommonPlace sidebar: warm dark panel (#1A1614) with terracotta
 * gradient bloom from top-left. Paper grain at 5% opacity (matte
 * card stock feel).
 *
 * Four intent-based sections:
 *   CAPTURE: Capture button, + Object button, Recent captures
 *   VIEW: Timeline, Networks, Calendar, Loose Ends
 *   WORK: Notebooks (expandable), Projects (expandable)
 *   SYSTEM: Connection Engine, Reminders, Resurface, Settings
 *
 * Branding: "CommonPlace" in Vollkorn italic at top.
 * Section titles: Courier Prime uppercase.
 */
export default function CommonPlaceSidebar() {
  const pathname = usePathname();
  const { notifyCaptured } = useCommonPlace();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['Notebooks', 'Projects'])
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [captures, setCaptures] = useState<CapturedObject[]>([]);

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const handleCapture = useCallback((object: CapturedObject) => {
    /* Optimistic: show immediately in sidebar */
    setCaptures((prev) => [object, ...prev]);

    /* Background sync to Django API */
    syncCapture(object).then((result) => {
      setCaptures((prev) =>
        prev.map((c) => {
          if (c.id !== object.id) return c;
          if (result.ok) {
            /* Signal timeline to refetch now that API has the new object */
            notifyCaptured();
            return {
              ...c,
              id: result.slug ?? c.id,
              status: 'synced' as const,
              enrichedTitle: result.enrichedTitle,
              title: result.enrichedTitle ?? c.title,
            };
          }
          return { ...c, status: 'error' as const };
        }),
      );
    });
  }, [notifyCaptured]);

  return (
    <aside
      className="cp-scrollbar cp-grain cp-grain-sidebar cp-sidebar-desktop"
      style={{
        width: 'var(--cp-sidebar-width)',
        flexShrink: 0,
        backgroundColor: 'var(--cp-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Terracotta corner glow */}
      <div className="cp-sidebar-glow" aria-hidden="true" />

      {/* Branding: "CommonPlace" in Vollkorn italic */}
      <div style={{ padding: '20px 16px 12px', position: 'relative', zIndex: 2 }}>
        <Link
          href="/commonplace"
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontStyle: 'italic',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--cp-sidebar-text)',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          CommonPlace
        </Link>
      </div>

      {/* Navigation sections */}
      <nav style={{ flex: 1, padding: '0 8px', position: 'relative', zIndex: 2 }}>
        {SIDEBAR_SECTIONS.map((section, sectionIdx) => (
          <div key={section.title} style={{ position: 'relative' }}>
            {sectionIdx > 0 && <div className="cp-sidebar-divider" />}
            <div className="cp-section-title">{section.title}</div>

            {/* Capture section: replace action buttons with real components */}
            {section.title === 'Capture' ? (
              <div style={{ padding: '0 4px' }}>
                <CaptureButton onCapture={handleCapture} />
                <div style={{ marginTop: 4, position: 'relative' }}>
                  <button
                    type="button"
                    className="cp-sidebar-item"
                    onClick={() => setIsPaletteOpen(!isPaletteOpen)}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'left',
                    }}
                  >
                    <SidebarIcon name="molecule" />
                    <span>+ Object</span>
                  </button>
                  <ObjectPalette
                    isOpen={isPaletteOpen}
                    onClose={() => setIsPaletteOpen(false)}
                    onCapture={handleCapture}
                  />
                </div>
              </div>
            ) : (
              section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (pathname?.startsWith(item.href + '/') && item.href !== '/commonplace') ||
                  (item.href === '/commonplace' && pathname === '/commonplace');

                if (item.expandable) {
                  const isExpanded = expandedGroups.has(item.label);
                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        className="cp-sidebar-item"
                        data-active={isActive}
                        onClick={() => toggleGroup(item.label)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'left',
                        }}
                      >
                        <SidebarIcon name={item.icon} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        <ChevronIcon open={isExpanded} />
                      </button>
                      {isExpanded && item.children && item.children.length > 0 && (
                        <div style={{ paddingLeft: 20 }}>
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="cp-sidebar-item"
                              data-active={pathname === child.href}
                              style={{ textDecoration: 'none', fontSize: 12 }}
                            >
                              <SidebarIcon name={child.icon} />
                              <span>{child.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {isExpanded && (!item.children || item.children.length === 0) && (
                        <div
                          style={{
                            padding: '4px 12px 4px 32px',
                            fontFamily: 'var(--cp-font-mono)',
                            fontSize: 11,
                            color: 'var(--cp-sidebar-text-faint)',
                            fontStyle: 'italic',
                          }}
                        >
                          None yet
                        </div>
                      )}
                    </div>
                  );
                }

                /* Any remaining action buttons (shouldn't appear outside Capture) */
                if (item.href.startsWith('#')) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      className="cp-sidebar-item"
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                      }}
                    >
                      <SidebarIcon name={item.icon} />
                      <span>{item.label}</span>
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="cp-sidebar-item"
                    data-active={isActive}
                    style={{ textDecoration: 'none' }}
                  >
                    <SidebarIcon name={item.icon} />
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 10,
                          fontFamily: 'var(--cp-font-mono)',
                          color: 'var(--cp-sidebar-text-faint)',
                          backgroundColor: 'var(--cp-sidebar-surface)',
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        ))}

        {/* Object Types quick-create palette */}
        <div className="cp-sidebar-divider" />
        <div className="cp-section-title">Object Types</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
            padding: '0 4px',
          }}
        >
          {OBJECT_TYPES.map((objType) => (
            <button
              key={objType.slug}
              type="button"
              title={`New ${objType.label}`}
              className="cp-sidebar-item"
              onClick={() => {
                const object = createCapturedObject({
                  text: '',
                  objectType: objType.slug,
                  captureMethod: 'quick-create',
                });
                object.title = `New ${objType.label}`;
                handleCapture(object);
              }}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                gap: 6,
                border: 'none',
                background: 'transparent',
              }}
            >
              <span
                className="cp-type-dot"
                style={{ backgroundColor: objType.color }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {objType.label}
              </span>
            </button>
          ))}
        </div>

        {/* Recent captures feed */}
        {captures.length > 0 && (
          <>
            <div className="cp-sidebar-divider" />
            <div className="cp-section-title">Recent</div>
            <RecentCaptures captures={captures} />
          </>
        )}
      </nav>

      {/* DropZone: fixed overlay, lives here to share capture state */}
      <DropZone onCapture={handleCapture} />

      {/* Bottom: back to main site */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--cp-sidebar-border)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Link
          href="/"
          className="cp-sidebar-item"
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 11,
            color: 'var(--cp-sidebar-text-faint)',
            textDecoration: 'none',
            letterSpacing: '0.05em',
            padding: '4px 0',
          }}
        >
          <SidebarIcon name="arrow-left" />
          travisgilbert.me
        </Link>
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────────
   Sidebar icons: minimal SVG glyphs for navigation.
   16px viewbox, stroke-based, felt-tip pen feel.
   ───────────────────────────────────────────────── */

function SidebarIcon({ name }: { name: string }) {
  const size = 16;
  const style = {
    width: size,
    height: size,
    flexShrink: 0 as const,
    opacity: 0.7,
  };

  const paths: Record<string, string> = {
    /* Capture section */
    'capture': 'M8 2v12M2 8h12',
    'molecule': 'M8 4a2 2 0 100-4 2 2 0 000 4zM3 13a2 2 0 100-4 2 2 0 000 4zM13 13a2 2 0 100-4 2 2 0 000 4zM6.5 4.5L4 9M9.5 4.5L12 9M5 11h6',

    /* View section */
    'timeline': 'M4 2v12M4 4h8M4 8h6M4 12h10',
    'filter': 'M2 3h12M4 7h8M6 11h4',
    'graph': 'M3 11a2 2 0 104 0 2 2 0 00-4 0zM9 5a2 2 0 104 0 2 2 0 00-4 0zM6.5 9.5l3-3M9 11a2 2 0 104 0 2 2 0 00-4 0z',
    'frame': 'M2 2h4v4H2zM10 2h4v4h-4zM2 10h4v4H2zM10 10h4v4h-4z',
    'calendar': 'M2 5h12M2 3h12v11H2zM5 1v3M11 1v3',
    'scatter': 'M3 5a1 1 0 100-2 1 1 0 000 2zM9 4a1 1 0 100-2 1 1 0 000 2zM6 9a1 1 0 100-2 1 1 0 000 2zM12 8a1 1 0 100-2 1 1 0 000 2zM4 13a1 1 0 100-2 1 1 0 000 2zM11 13a1 1 0 100-2 1 1 0 000 2z',

    /* Work section */
    'book': 'M2 2h5a2 2 0 012 0h5v11h-5a1 1 0 00-1 1 1 1 0 00-1-1H2z',
    'briefcase': 'M2 6h12v8H2zM5 6V4a1 1 0 011-1h4a1 1 0 011 1v2',

    /* System section */
    'engine': 'M8 10a2 2 0 100-4 2 2 0 000 4zM2 8h2M12 8h2M8 2v2M8 12v2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5l1.5-1.5M11 5l1.5-1.5',
    'bell': 'M6 14h4M4 10h8l-1-3a3 3 0 00-6 0l-1 3z',
    'sparkle': 'M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2',
    'gear': 'M8 10a2 2 0 100-4 2 2 0 000 4zM13 8l-1.5-.5a3.5 3.5 0 000-1l1.5-.5-1-1.5-1.5.5a3.5 3.5 0 00-.7-.7l.5-1.5L8.8 3l-.5 1.5a3.5 3.5 0 00-1 0L7.2 3 5.7 4l.5 1.5c-.3.2-.5.4-.7.7L4 5.7 3 7.2l1.5.5a3.5 3.5 0 000 1L3 9.2l1 1.5 1.5-.5c.2.3.4.5.7.7l-.5 1.5 1.5 1 .5-1.5a3.5 3.5 0 001 0l.5 1.5 1.5-1-.5-1.5c.3-.2.5-.4.7-.7l1.5.5z',

    /* Object types */
    'note-pencil': 'M2 14l1-4L11 2l3 3-8 8zM10 3l3 3',
    'book-open': 'M2 3h4a2 2 0 012 2v9l-1-1H2zM14 3h-4a2 2 0 00-2 2v9l1-1h5z',
    'person': 'M8 7a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM3 14c0-2.8 2.2-5 5-5s5 2.2 5 5',
    'map-pin': 'M8 14s5-4.5 5-8A5 5 0 003 6c0 3.5 5 8 5 8zM8 8a2 2 0 100-4 2 2 0 000 4z',
    'building': 'M3 14V3h10v11M6 5h1M9 5h1M6 8h1M9 8h1M6 11h4v3H6z',
    'lightbulb': 'M8 1a4 4 0 00-2 7.5V11h4V8.5A4 4 0 008 1zM6 13h4M6 14.5h4',
    'quote': 'M3 6c0-2 1.5-3 3-3M10 6c0-2 1.5-3 3-3M3 6v3a1.5 1.5 0 003 0V6M10 6v3a1.5 1.5 0 003 0V6',
    'code': 'M5 4L1 8l4 4M11 4l4 4-4 4M9 2l-2 12',
    'check-circle': 'M8 15A7 7 0 108 1a7 7 0 000 14zM5.5 8l2 2 3.5-4',

    /* Utility */
    'arrow-left': 'M10 3L5 8l5 5',
    'plus': 'M8 3v10M3 8h10',
  };

  const d = paths[name] ?? paths['note-pencil'];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}

/* ─────────────────────────────────────────────────
   Chevron icon for expandable groups
   ───────────────────────────────────────────────── */

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        opacity: 0.5,
        transition: 'transform 200ms',
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      <path d="M4 2l4 4-4 4" />
    </svg>
  );
}
