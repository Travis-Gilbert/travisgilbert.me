'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Books,
  Briefcase,
  ClockCounterClockwise,
  FileText,
  Gear,
  NotePencil,
  Notebook,
  Toolbox,
  VideoCamera,
} from '@phosphor-icons/react';
import { SIDEBAR_SECTIONS, SIDEBAR_TIMELINE_ITEM } from '@/lib/studio';
import { getMockContentItems } from '@/lib/studio-mock-data';
import NewContentModal from './NewContentModal';

/**
 * Studio sidebar: 232px fixed navigation panel.
 *
 * Sections: MAKE STUFF, COLLECT, BUILD.
 * Timeline is rendered as a distinct bottom action.
 *
 * "Studio." wordmark at top (54px Vollkorn), terracotta period.
 * Terracotta glow bloom from upper left, grid lines at 5% opacity,
 * heavier grain texture. Content type counts from mock data.
 * Active route highlighting with 2px terracotta left bar.
 */
export default function StudioSidebar() {
  const pathname = usePathname();
  const [showNewModal, setShowNewModal] = useState(false);

  const iconByName = {
    'file-text': FileText,
    'note-pencil': NotePencil,
    video: VideoCamera,
    'book-open': Books,
    notebook: Notebook,
    wrench: Toolbox,
    briefcase: Briefcase,
    gear: Gear,
    timeline: ClockCounterClockwise,
  } as const;

  const timelineActive =
    pathname === SIDEBAR_TIMELINE_ITEM.href ||
    pathname?.startsWith(`${SIDEBAR_TIMELINE_ITEM.href}/`);

  const items = getMockContentItems();
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = item.contentType;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const labelToType: Record<string, string> = {
    Essays: 'essay',
    'Field Notes': 'field-note',
    Shelf: 'shelf',
    Projects: 'project',
    Videos: 'video',
    Toolkit: 'toolkit',
  };

  return (
    <aside
      className="studio-sidebar-desktop studio-sidebar-grid studio-scrollbar studio-grain"
      style={{
        width: 'var(--studio-sidebar-width)',
        flexShrink: 0,
        backgroundColor: 'var(--studio-bg-sidebar)',
        borderRight: '1px solid var(--studio-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Corner glow bloom */}
      <div className="studio-sidebar-glow" aria-hidden="true" />

      {/* Wordmark */}
      <Link
        href="/studio"
        style={{
          display: 'block',
          padding: '26px 20px 10px 12px',
          textDecoration: 'none',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--studio-font-title)',
            fontWeight: 700,
            fontSize: '54px',
            color: 'var(--studio-text-bright)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          Studio
          <span style={{ color: 'var(--studio-tc)' }}>.</span>
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            color: 'var(--studio-text-3)',
            marginTop: '4px',
          }}
        >
          TRAVISGILBERT.ME
        </span>
      </Link>

      <div style={{ padding: '8px 12px 14px', position: 'relative', zIndex: 2 }}>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          style={{
            width: '100%',
            padding: '9px 14px',
            backgroundColor: 'var(--studio-tc-dim)',
            border: '1px solid var(--studio-border-tc)',
            borderRadius: '6px',
            color: 'var(--studio-tc-bright)',
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
            textAlign: 'left',
            boxShadow: '0 0 18px rgba(180, 90, 45, 0.34)',
          }}
        >
          + New
        </button>
      </div>

      <nav
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: '4px',
          paddingBottom: '12px',
        }}
      >
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: '4px' }}>
            <div className="studio-nav-section-label">{section.title}</div>

            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/studio' && pathname?.startsWith(item.href));
              const count = labelToType[item.label]
                ? counts[labelToType[item.label]]
                : undefined;
              const Icon = iconByName[item.icon as keyof typeof iconByName] ?? FileText;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="studio-nav-item"
                  data-active={isActive ? 'true' : undefined}
                >
                  <span
                    style={{
                      width: '16px',
                      color: item.dotColor ?? 'var(--studio-text-3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} weight="thin" aria-hidden="true" />
                  </span>
                  <span>{item.label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="studio-nav-badge">{count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div
        style={{
          padding: '10px 12px 18px',
          borderTop: '1px solid var(--studio-border)',
        }}
      >
        <Link
          href={SIDEBAR_TIMELINE_ITEM.href}
          className="studio-nav-item studio-nav-item-timeline"
          data-active={timelineActive ? 'true' : undefined}
        >
          <span
            style={{
              width: '16px',
              color: 'var(--studio-purple)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ClockCounterClockwise size={16} weight="thin" aria-hidden="true" />
          </span>
          <span>{SIDEBAR_TIMELINE_ITEM.label}</span>
        </Link>
      </div>

      {showNewModal && (
        <NewContentModal onClose={() => setShowNewModal(false)} />
      )}
    </aside>
  );
}
