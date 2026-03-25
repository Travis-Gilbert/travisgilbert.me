'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  BookStack,
  KanbanBoard,
  ClockRotateRight,
  PageEdit,
  Settings,
  HalfMoon,
  Notes,
  JournalPage,
  SunLight,
  Tools,
  Archive,
  VideoCamera,
  NavArrowLeft,
  NavArrowRight,
} from 'iconoir-react';
import { SIDEBAR_SECTIONS, SIDEBAR_TIMELINE_ITEM } from '@/lib/studio';
import { fetchContentList } from '@/lib/studio-api';
import { useStudioView } from './StudioViewContext';
import { useStudioWorkbench } from './WorkbenchContext';
import SheetList from './SheetList';
import NewContentModal from './NewContentModal';

/**
 * Studio sidebar: 232px fixed navigation panel.
 *
 * Sections: MAKE STUFF, COLLECT, BUILD.
 * Timeline is rendered as a distinct bottom action.
 *
 * "Studio." wordmark at top (54px Vollkorn), terracotta period.
 * Terracotta glow bloom from upper left, grid lines at 5% opacity,
 * heavier grain texture. Content type counts from Studio API.
 * Active route highlighting with 2px terracotta left bar.
 */
export default function StudioSidebar({
  collapsed = false,
  onToggleCollapse,
  sheetsMode = false,
  onExitSheetsMode,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  sheetsMode?: boolean;
  onExitSheetsMode?: () => void;
} = {}) {
  const pathname = usePathname();
  const { themeMode, toggleThemeMode } = useStudioView();
  const { editorState } = useStudioWorkbench();
  const [showNewModal, setShowNewModal] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const iconByName = {
    'file-text': PageEdit,
    'note-pencil': Notes,
    video: VideoCamera,
    'book-open': BookStack,
    notebook: JournalPage,
    wrench: Tools,
    briefcase: KanbanBoard,
    gear: Settings,
    tray: Archive,
    timeline: ClockRotateRight,
  } as const;

  const timelineActive =
    pathname === SIDEBAR_TIMELINE_ITEM.href ||
    pathname?.startsWith(`${SIDEBAR_TIMELINE_ITEM.href}/`);

  useEffect(() => {
    let cancelled = false;

    const loadCounts = async () => {
      try {
        const items = await fetchContentList();
        if (cancelled) return;

        const nextCounts: Record<string, number> = {};
        for (const item of items) {
          const key = item.contentType;
          nextCounts[key] = (nextCounts[key] ?? 0) + 1;
        }
        setCounts(nextCounts);
      } catch {
        if (!cancelled) {
          setCounts({});
        }
      }
    };

    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const hrefToType: Record<string, string> = {
    '/studio/essays': 'essay',
    '/studio/field-notes': 'field-note',
    '/studio/shelf': 'shelf',
    '/studio/videos': 'video',
    '/studio/projects': 'project',
    '/studio/toolkit': 'toolkit',
  };

  /* ── Sheets mode: full sidebar replacement ── */
  if (sheetsMode && !collapsed) {
    return (
      <aside
        className="studio-sidebar-desktop studio-sidebar-grid studio-grain"
        style={{
          width: 'var(--studio-sidebar-width)',
          flexShrink: 0,
          height: '100%',
          backgroundColor: 'var(--studio-bg-sidebar)',
          borderRight: '1px solid var(--studio-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div className="studio-sidebar-glow" aria-hidden="true" />

        <button
          type="button"
          onClick={onExitSheetsMode}
          className="studio-sheets-back-nav"
        >
          &larr; Back to navigation
        </button>

        <SheetList fullPanel />

        <SheetsFooter />
      </aside>
    );
  }

  return (
    <aside
      className="studio-sidebar-desktop studio-sidebar-grid studio-scrollbar studio-grain"
      style={{
        width: collapsed ? 56 : 'var(--studio-sidebar-width)',
        flexShrink: 0,
        height: '100%',
        backgroundColor: 'var(--studio-bg-sidebar)',
        borderRight: '1px solid var(--studio-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Corner glow bloom */}
      <div className="studio-sidebar-glow" aria-hidden="true" />

      {/* Wordmark */}
      <Link
        href="/studio"
        style={{
          display: 'block',
          padding: collapsed ? '18px 0 10px' : '26px 20px 10px 12px',
          textDecoration: 'none',
          position: 'relative',
          zIndex: 2,
          textAlign: collapsed ? 'center' : undefined,
        }}
      >
        {collapsed ? (
          <span
            style={{
              fontFamily: 'var(--studio-font-title)',
              fontWeight: 700,
              fontSize: '28px',
              color: 'var(--studio-tc)',
              lineHeight: 1,
            }}
          >
            .
          </span>
        ) : (
          <>
            <span
              style={{
                fontFamily: 'var(--studio-font-title)',
                fontWeight: 700,
                fontSize: '42px',
                color: 'var(--studio-text-bright)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              Studio
              <span style={{ color: 'var(--studio-tc)' }}>.</span>
            </span>
          </>
        )}
      </Link>

      <div style={{ padding: collapsed ? '4px 8px 10px' : '8px 12px 14px', position: 'relative', zIndex: 2 }}>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          title={collapsed ? 'New content' : undefined}
          style={{
            width: '100%',
            padding: collapsed ? '8px 0' : '9px 14px',
            backgroundColor: 'transparent',
            border: '1px solid var(--studio-border-tc)',
            borderRadius: '6px',
            color: 'var(--studio-tc-bright)',
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.12s ease',
            textAlign: 'center',
          }}
        >
          {collapsed ? '+' : '+ New'}
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
            {!collapsed && (
              <div
                className="studio-nav-section-label"
                style={section.labelColor ? { color: section.labelColor } : undefined}
              >
                {section.title}
              </div>
            )}

            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/studio' && pathname?.startsWith(item.href));
              const countType = hrefToType[item.href];
              const count = countType ? (counts[countType] ?? 0) : undefined;
              const Icon = iconByName[item.icon as keyof typeof iconByName] ?? PageEdit;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="studio-nav-item"
                  data-active={isActive ? 'true' : undefined}
                  title={collapsed ? item.label : undefined}
                  style={collapsed ? { justifyContent: 'center', padding: '8px 0' } : undefined}
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
                    <Icon width={16} height={16} aria-hidden="true" />
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && count !== undefined && (
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
          padding: collapsed ? '10px 0 18px' : '10px 12px 18px',
          borderTop: '1px solid var(--studio-border)',
        }}
      >
        <Link
          href={SIDEBAR_TIMELINE_ITEM.href}
          className="studio-nav-item studio-nav-item-timeline"
          data-active={timelineActive ? 'true' : undefined}
          title={collapsed ? SIDEBAR_TIMELINE_ITEM.label : undefined}
          style={collapsed ? { justifyContent: 'center', padding: '8px 0' } : undefined}
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
            <ClockRotateRight width={16} height={16} aria-hidden="true" />
          </span>
          {!collapsed && <span>{SIDEBAR_TIMELINE_ITEM.label}</span>}
        </Link>

        <button
          type="button"
          onClick={toggleThemeMode}
          className="studio-nav-item"
          style={collapsed ? { marginTop: '4px', justifyContent: 'center', padding: '8px 0' } : { marginTop: '4px' }}
          aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={collapsed ? (themeMode === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
        >
          <span
            style={{
              width: '16px',
              color: 'var(--studio-gold)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {themeMode === 'dark' ? (
              <SunLight width={16} height={16} aria-hidden="true" />
            ) : (
              <HalfMoon width={16} height={16} aria-hidden="true" />
            )}
          </span>
          {!collapsed && <span>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

      </div>

      {showNewModal && (
        <NewContentModal onClose={() => setShowNewModal(false)} />
      )}
    </aside>
  );
}

/**
 * Footer for sheets mode sidebar: total word count + compile button.
 */
function SheetsFooter() {
  const { editorState } = useStudioWorkbench();
  const totalWords = editorState.sheets.reduce((sum, s) => sum + (s.wordCount ?? 0), 0);

  return (
    <div
      style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--studio-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 'auto',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '10px',
          color: 'var(--studio-text-3)',
        }}
      >
        {totalWords.toLocaleString()} words total
      </span>
    </div>
  );
}
