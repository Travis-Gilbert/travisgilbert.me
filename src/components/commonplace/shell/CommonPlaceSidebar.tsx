'use client';

import { useState, useCallback, useEffect } from 'react';
import type { ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  Archive,
  BellNotification,
  Book,
  Box3dCenter,
  BrainResearch,
  Calendar,
  ClipboardCheck,
  DotsGrid3x3,
  EditPencil,
  Folder,
  HelpCircle,
  NavArrowRight,
  RoundFlask,
  Settings,
  UserStar,
} from 'iconoir-react';
import { toast } from 'sonner';
import { SIDEBAR_SECTIONS } from '@/lib/commonplace';
import type { CapturedObject, ViewType } from '@/lib/commonplace';
import { syncCapture } from '@/lib/commonplace-capture';
import { findLeafWithView } from '@/lib/commonplace-layout';
import { useLayout } from '@/lib/providers/layout-provider';
import { useDrawer } from '@/lib/providers/drawer-provider';
import { useWorkspace } from '@/lib/providers/workspace-provider';
import { useCapture } from '@/lib/providers/capture-provider';
import {
  fetchNotebooks,
  fetchProjects,
  fetchPinnedObjects,
  fetchObjectDetail,
  useApiData,
} from '@/lib/commonplace-api';
import { useIsAppShellMobile } from '@/hooks/useIsAppShellMobile';
import MobileDrawer from '@/components/mobile-shell/MobileDrawer';
import styles from './CommonPlaceSidebar.module.css';
import CubeScanIcon from '../icons/CubeScanIcon';
import KeyframesSolidIcon from '../icons/KeyframesSolidIcon';
import SubstractIcon from '../icons/SubstractIcon';
import CaptureButton from '../capture/CaptureButton';
import ObjectPalette from '../shared/ObjectPalette';
import RecentCaptures from '../capture/RecentCaptures';
import DropZone from '../board/DropZone';
import ComponentToolbox from '../shared/ComponentToolbox';

export default function CommonPlaceSidebar({ onCollapse }: { onCollapse?: () => void }) {
  const pathname = usePathname();
  const {
    activeScreen,
    layout,
    launchView,
    navigateToScreen,
  } = useLayout();
  const { openDrawer } = useDrawer();
  const {
    mobileSidebarOpen,
    closeMobileSidebar,
  } = useWorkspace();
  const { notifyCaptured } = useCapture();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set()
  );
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [captures, setCaptures] = useState<CapturedObject[]>([]);
  const isMobile = useIsAppShellMobile();

  /* Fetch notebooks, projects, and pinned objects */
  const { data: notebooks } = useApiData(() => fetchNotebooks(), []);
  const { data: projects } = useApiData(() => fetchProjects(), []);
  const { data: pinnedObjects } = useApiData(() => fetchPinnedObjects(), []);

  useEffect(() => {
    if (!isMobile) return;
    closeMobileSidebar();
  }, [pathname, isMobile, closeMobileSidebar]);

  useEffect(() => {
    if (!isMobile) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileSidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobile, mobileSidebarOpen]);

  function toggleGroup(label: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const closeDrawerIfMobile = useCallback(() => {
    if (isMobile) closeMobileSidebar();
  }, [isMobile, closeMobileSidebar]);

  const handleCapture = useCallback((object: CapturedObject) => {
    /* Optimistic: show immediately in sidebar */
    setCaptures((prev) => [object, ...prev]);

    closeDrawerIfMobile();

    /* Background sync to Django API */
    syncCapture(object).then(async (result) => {
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

      if (!result.ok) {
        toast.error(result.error || 'Capture sync failed');
        return;
      }

      const captureLabel = result.enrichedTitle || object.title || 'Object captured';
      toast.success(`${captureLabel}`);

      if (result.slug) {
        try {
          const detail = await fetchObjectDetail(result.slug);
          const connectionCount = detail.edges.length;
          if (connectionCount > 0) {
            toast.success(
              `${connectionCount} new connection${connectionCount === 1 ? '' : 's'} found`,
            );
          }
        } catch {
          // Best effort only: capture already succeeded.
        }
      }
    });
  }, [notifyCaptured, closeDrawerIfMobile]);

  const sidebarInner = (
    <>
      {/* Chrome shell glow */}
      <div className={styles.sidebarGlow} aria-hidden="true" />

      {/* Brand zone */}
      <div style={{
        padding: '16px 18px 12px',
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <Link
          href="/commonplace"
          onClick={closeDrawerIfMobile}
          style={{ textDecoration: 'none', display: 'block' }}
        >
          <span style={{
            display: 'block',
            fontFamily: 'var(--cp-font-title)',
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--cp-sidebar-text)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>Common</span>
          <span style={{
            display: 'block',
            fontFamily: 'var(--cp-font-title)',
            fontSize: 22,
            fontWeight: 700,
            color: 'rgba(55, 120, 130, 0.6)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>Place</span>
        </Link>
        {onCollapse && !isMobile && (
          <button
            onClick={onCollapse}
            title="Collapse to rail"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              marginTop: 4,
              opacity: 0.4,
              transition: 'opacity 150ms',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.4'; }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--cp-sidebar-text-muted)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6L9 12L15 18" />
            </svg>
          </button>
        )}
      </div>

      <nav style={{ flex: 1, overflow: 'auto', scrollbarWidth: 'none', padding: '8px 6px', position: 'relative', zIndex: 2 }}>
        {SIDEBAR_SECTIONS.map((section, sectionIdx) => {
          const sectionKey = (section.title || 'capture').toLowerCase() as 'capture' | 'views' | 'work' | 'system';
          const SECTION_GROUP_STYLES: Record<string, string> = {
            capture: styles.sidebarSectionCapture,
            views: styles.sidebarSectionViews,
            work: styles.sidebarSectionWork,
            system: styles.sidebarSectionSystem,
          };
          const sectionGroupClass = SECTION_GROUP_STYLES[sectionKey] ?? '';
          /* Divider color hints at the NEXT section's accent */
          const DIVIDER_COLORS: Record<string, string> = {
            views: 'rgba(93, 155, 120, 0.25)',
            work: 'rgba(123, 143, 160, 0.25)',
            system: 'rgba(110, 112, 120, 0.25)',
          };
          return (
            <div key={section.title || `section-${sectionIdx}`} style={{ position: 'relative' }}>
              {sectionIdx > 0 && (
                <div
                  className={styles.sidebarDivider}
                  style={{ '--divider-color': DIVIDER_COLORS[sectionKey] } as React.CSSProperties}
                />
              )}
              <div className={sectionGroupClass}>
              {section.title && section.title !== 'Capture' && (
              <div className={styles.sectionTitle} data-section={sectionKey}>{section.title}</div>
            )}

            {section.title === 'Capture' ? (
              <div style={{ padding: '0 4px' }}>
                <div className={styles.captureGlow}>
                  <CaptureButton onCapture={handleCapture} />
                </div>
                <ObjectPalette
                  isOpen={isPaletteOpen}
                  onClose={() => setIsPaletteOpen(false)}
                  onCapture={handleCapture}
                />
              </div>
            ) : (
              section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (pathname?.startsWith(item.href + '/') &&
                    item.href !== '/commonplace') ||
                  (item.href === '/commonplace' &&
                    pathname === '/commonplace');

                if (item.expandable) {
                  const isExpanded = expandedGroups.has(item.label);

                  /* Map static children (viewType entries) from SIDEBAR_SECTIONS */
                  const staticChildren = (item.children ?? []).map((child) => ({
                    key: child.href,
                    label: child.label,
                    color: undefined as string | undefined,
                    icon: child.icon,
                    onClick: (e: React.MouseEvent) => {
                      if (child.screenType) {
                        navigateToScreen(child.screenType);
                      } else if (child.viewType) {
                        launchView(child.viewType, undefined, e.shiftKey);
                      }
                      closeDrawerIfMobile();
                    },
                  }));

                  const dynamicItems =
                    item.label === 'Notebooks'
                      ? [
                          ...staticChildren,
                          ...(notebooks ?? []).map((nb) => ({
                            key: nb.slug,
                            label: nb.name,
                            color: nb.color as string | undefined,
                            icon: undefined as string | undefined,
                            onClick: () => {
                              launchView('notebook', { slug: nb.slug });
                              closeDrawerIfMobile();
                            },
                          })),
                        ]
                      : item.label === 'Projects'
                        ? (projects ?? []).map((pj) => ({
                            key: pj.slug,
                            label: pj.name,
                            color: undefined as string | undefined,
                            icon: undefined as string | undefined,
                            onClick: () => {
                              launchView('project', { slug: pj.slug });
                              closeDrawerIfMobile();
                            },
                        }))
                        : staticChildren;
                  const childCount = dynamicItems.length;

                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        className={styles.sidebarItem}
                        data-active={isActive}
                        data-section={sectionKey}
                        onClick={() => {
                          toggleGroup(item.label);
                          /* Parent click also opens the associated view */
                          if (item.screenType) {
                            navigateToScreen(item.screenType);
                            closeDrawerIfMobile();
                          } else if (item.viewType) {
                            launchView(item.viewType, item.viewContext);
                            closeDrawerIfMobile();
                          }
                        }}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'left',
                        }}
                      >
                        <SidebarIcon name={item.icon} color={isActive ? LABEL_ACCENT[item.label] : undefined} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.label !== 'Models' && (
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: 'var(--cp-font-mono)',
                              color: 'var(--cp-sidebar-text-faint)',
                            }}
                          >
                            {childCount}
                          </span>
                        )}
                        <ChevronIcon open={isExpanded} />
                      </button>
                      {isExpanded && dynamicItems.length > 0 && (
                        <div style={{ paddingLeft: 20 }}>
                          {dynamicItems.map((child) => (
                            <button
                              key={child.key}
                              type="button"
                              className={styles.sidebarItem}
                              onClick={child.onClick}
                              style={{
                                width: '100%',
                                border: 'none',
                                background: 'transparent',
                                textAlign: 'left',
                                fontSize: 12,
                              }}
                            >
                              {child.color && (
                                <span
                                  className="cp-type-dot"
                                  style={{ backgroundColor: child.color }}
                                />
                              )}
                              {!child.color && <SidebarIcon name={child.icon ?? 'briefcase'} />}
                              <span>{child.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {isExpanded && dynamicItems.length === 0 && (
                        <div
                          style={{
                            padding: '4px 12px 4px 32px',
                            fontFamily: 'var(--cp-font-mono)',
                            fontSize: 11,
                            color: 'var(--cp-sidebar-text-faint)',
                          }}
                        >
                          None yet
                        </div>
                      )}
                    </div>
                  );
                }

                /* Items with viewType open pane tabs instead of navigating */
                if (item.mode === 'screen' && item.screenType) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      className={styles.sidebarItem}
                      data-active={isActive || activeScreen === item.screenType}
                      data-section={sectionKey}
                      onClick={() => {
                        navigateToScreen(item.screenType!);
                        closeDrawerIfMobile();
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                      }}
                    >
                      <SidebarIcon name={item.icon} color={(isActive || activeScreen === item.screenType) ? LABEL_ACCENT[item.label] : undefined} />
                      <span>{item.label}</span>
                    </button>
                  );
                }

                if (item.viewType) {
                  const viewIsOpen = Boolean(findLeafWithView(layout, item.viewType));
                  return (
                    <button
                      key={item.href}
                      type="button"
                      className={styles.sidebarItem}
                      data-active={isActive || viewIsOpen}
                      data-section={sectionKey}
                      onClick={(e) => {
                        launchView(item.viewType!, undefined, e.shiftKey);
                        closeDrawerIfMobile();
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        textAlign: 'left',
                      }}
                    >
                      <SidebarIcon name={item.icon} color={(isActive || viewIsOpen) ? LABEL_ACCENT[item.label] : undefined} />
                      <span>{item.label}</span>
                      {viewIsOpen && (
                        <span
                          aria-hidden="true"
                          style={{
                            marginLeft: 'auto',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            backgroundColor: '#C67A4A',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeDrawerIfMobile}
                    className={styles.sidebarItem}
                    data-active={isActive}
                    data-section={sectionKey}
                    style={{ textDecoration: 'none' }}
                  >
                    <SidebarIcon name={item.icon} color={isActive ? LABEL_ACCENT[item.label] : undefined} />
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
          </div>
          );
        })}

        {/* Pinned objects: 2x3 type-colored grid of starred objects.
            Each item opens the Vaul drawer via openDrawer(slug). */}
        {pinnedObjects && pinnedObjects.length > 0 && (
          <>
            <div className={styles.sidebarDivider} />
            <div className={styles.sectionTitle}>Objects</div>
            <div className={styles.pinnedGrid}>
              {pinnedObjects.map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  className={styles.pinnedItem}
                  onClick={() => openDrawer(obj.slug)}
                  title={obj.title}
                >
                  <div className={styles.pinnedItemHeader}>
                    <span
                      className="cp-type-dot"
                      style={{ backgroundColor: obj.objectTypeColor || 'var(--cp-text-muted)' }}
                    />
                    <span className={styles.pinnedItemTitle}>{obj.title}</span>
                  </div>
                  {obj.edgeCount > 0 && (
                    <div className={styles.pinnedItemCount}>{obj.edgeCount} edges</div>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Recent captures feed */}
        {captures.length > 0 && (
          <>
            <div className={styles.sidebarDivider} />
            <div className={styles.sectionTitle}>Recent</div>
            <RecentCaptures captures={captures} />
          </>
        )}
      </nav>

      {/* DropZone: fixed overlay, lives here to share capture state */}
      <DropZone onCapture={handleCapture} />

      {/* Component toolbox: drag tiles onto objects */}
      <ComponentToolbox />

      {/* Engine bar: anchored at bottom */}
      <button
        type="button"
        onClick={() => navigateToScreen('engine')}
        style={{
          marginTop: 'auto',
          padding: '10px 14px',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: 'none',
          borderTopStyle: 'solid',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.04)',
          cursor: 'pointer',
          position: 'relative',
          zIndex: 2,
          width: '100%',
        }}
      >
        {/* Green status dot */}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#5D9B78',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontWeight: 500,
            fontSize: 10.5,
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            color: '#5D9B78',
          }}
        >
          Engine
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--cp-font-mono)',
            fontWeight: 500,
            fontSize: 10.5,
            color: '#50525A',
          }}
        >
          {/* Event count placeholder */}
        </span>
      </button>
    </>
  );

  if (isMobile) {
    return (
      <MobileDrawer
        open={mobileSidebarOpen}
        onClose={closeMobileSidebar}
        ariaLabel="CommonPlace navigation drawer"
        backdropClassName="cp-mobile-backdrop"
        panelClassName="cp-mobile-drawer cp-scrollbar cp-grain cp-grain-sidebar"
        panelStyle={{
          width: 'min(84vw, 320px)',
          backgroundColor: 'var(--cp-sidebar)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          height: '100dvh',
        }}
      >
        {sidebarInner}
      </MobileDrawer>
    );
  }

  return (
    <aside
      className="cp-scrollbar cp-grain cp-grain-sidebar cp-sidebar-desktop"
      style={{
        width: 232,
        flexShrink: 0,
        background: [
          'radial-gradient(120% 140% at 0% 0%, rgba(75, 141, 144, 0.035) 0%, transparent 28%)',
          'radial-gradient(90% 120% at 100% 20%, rgba(86, 109, 150, 0.055) 0%, transparent 36%)',
          'linear-gradient(180deg, #1A1B1F 0%, #151619 100%)',
        ].join(', '),
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.02)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {sidebarInner}
    </aside>
  );
}

const RAIL_ICON_COMPONENTS: Record<string, ComponentType<{ width?: number; height?: number }>> = {
  grid: DotsGrid3x3,
  timeline: Activity,
  graph: Activity,
  calendar: Calendar,
  scatter: HelpCircle,
  engine: Box3dCenter,
  model: BrainResearch,
  bell: BellNotification,
  gear: Settings,
  book: Book,
  briefcase: Folder,
  'note-pencil': EditPencil,
  'brain-research': BrainResearch,
  'round-flask': RoundFlask,
  'user-star': UserStar,
  'check-list': ClipboardCheck,
  archive: Archive,
  'cube-scan': CubeScanIcon,
  'keyframes-solid': KeyframesSolidIcon,
  'substract': SubstractIcon,
};

/* Per-section accent colors: shown on the icon when the item is active.
   Updated for the cool-slate sidebar palette per Spec F. */
const LABEL_ACCENT: Record<string, string> = {
  /* Capture section: terracotta */
  'Library':            '#C67A4A',
  'Models':             '#C67A4A',
  'Artifacts':          '#C67A4A',
  'Compose':            '#C67A4A',
  /* Views section: green */
  'Timeline':           '#5D9B78',
  'Map':                '#5D9B78',
  'Calendar':           '#5D9B78',
  'Loose Ends':         '#5D9B78',
  /* Work section: slate-blue */
  'Notebooks':          '#7B8FA0',
  'Projects':           '#7B8FA0',
  /* System section: neutral gray */
  'Connection Engine':  '#6E7078',
  'Engine':             '#6E7078',
  'Review Queue':       '#6E7078',
  'Settings':           '#6E7078',
};

/* Sidebar icons: Iconoir 24x24 path data, rendered at 16px display size.
   Stroke-based, felt-tip pen feel. Multi-path icons use string arrays. */

function SidebarIcon({ name, color }: { name: string; color?: string }) {
  const size = 16;
  const style = {
    width: size,
    height: size,
    flexShrink: 0 as const,
    opacity: color ? 1 : 0.7,
  };

  const paths: Record<string, string | string[]> = {
    /* Capture section */
    'capture': 'M6 12H12M18 12H12M12 12V6M12 12V18',
    'molecule': [
      'M4.40434 13.6099C3.51517 13.1448 3 12.5924 3 12C3 10.3431 7.02944 9 12 9C16.9706 9 21 10.3431 21 12C21 12.7144 20.2508 13.3705 19 13.8858',
      'M12 11.01L12.01 10.9989',
      'M16.8827 6C16.878 4.97702 16.6199 4.25309 16.0856 3.98084C14.6093 3.22864 11.5832 6.20912 9.32664 10.6379C7.07005 15.0667 6.43747 19.2668 7.91374 20.019C8.44117 20.2877 9.16642 20.08 9.98372 19.5',
      'M9.60092 4.25164C8.94056 3.86579 8.35719 3.75489 7.91369 3.98086C6.43742 4.73306 7.06999 8.93309 9.32658 13.3619C11.5832 17.7907 14.6092 20.7712 16.0855 20.019C17.3977 19.3504 17.0438 15.9577 15.3641 12.1016',
    ],

    /* View section */
    'timeline': [
      'M12 6L12 12L18 12',
      'M21.8883 10.5C21.1645 5.68874 17.013 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C16.1006 22 19.6248 19.5318 21.1679 16',
      'M17 16H21.4C21.7314 16 22 16.2686 22 16.6V21',
    ],
    'filter': 'M3.99961 3H19.9997C20.552 3 20.9997 3.44764 20.9997 3.99987L20.9999 5.58569C21 5.85097 20.8946 6.10538 20.707 6.29295L14.2925 12.7071C14.105 12.8946 13.9996 13.149 13.9996 13.4142L13.9996 19.7192C13.9996 20.3698 13.3882 20.8472 12.7571 20.6894L10.7571 20.1894C10.3119 20.0781 9.99961 19.6781 9.99961 19.2192L9.99961 13.4142C9.99961 13.149 9.89425 12.8946 9.70672 12.7071L3.2925 6.29289C3.10496 6.10536 2.99961 5.851 2.99961 5.58579V4C2.99961 3.44772 3.44732 3 3.99961 3Z',
    'graph': [
      'M5.164 17C5.453 15.951 5.833 14.949 6.296 14M11.5 7.794C12.282 7.228 13.118 6.726 14 6.296',
      'M4.5 22C3.119 22 2 20.881 2 19.5C2 18.119 3.119 17 4.5 17C5.881 17 7 18.119 7 19.5C7 20.881 5.881 22 4.5 22Z',
      'M9.5 12C8.119 12 7 10.881 7 9.5C7 8.119 8.119 7 9.5 7C10.881 7 12 8.119 12 9.5C12 10.881 10.881 12 9.5 12Z',
      'M19.5 7C18.119 7 17 5.881 17 4.5C17 3.119 18.119 2 19.5 2C20.881 2 22 3.119 22 4.5C22 5.881 20.881 7 19.5 7Z',
    ],
    'grid': [
      'M3 3H9V9H3V3Z',
      'M15 3H21V9H15V3Z',
      'M3 15H9V21H3V15Z',
      'M15 15H21V21H15V15Z',
    ],
    'frame': [
      'M19.4 20H4.6C4.26863 20 4 19.7314 4 19.4V4.6C4 4.26863 4.26863 4 4.6 4H19.4C19.7314 4 20 4.26863 20 4.6V19.4C20 19.7314 19.7314 20 19.4 20Z',
      'M11 12V4',
      'M4 12H20',
    ],
    'calendar': [
      'M15 4V2M15 4V6M15 4H10.5M3 10V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V10H3Z',
      'M3 10V6C3 4.89543 3.89543 4 5 4H7',
      'M7 2V6',
      'M21 10V6C21 4.89543 20.1046 4 19 4H18.5',
    ],
    'scatter': [
      'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z',
      'M9 9C9 5.49997 14.5 5.5 14.5 9C14.5 11.5 12 10.9999 12 13.9999',
      'M12 17.01L12.01 16.9989',
    ],

    /* Work section */
    'book': [
      'M4 19V5C4 3.89543 4.89543 3 6 3H19.4C19.7314 3 20 3.26863 20 3.6V16.7143',
      'M6 17L20 17',
      'M6 21L20 21',
      'M6 21C4.89543 21 4 20.1046 4 19C4 17.8954 4.89543 17 6 17',
      'M9 7L15 7',
    ],
    'briefcase': [
      'M7 6L17 6',
      'M7 9L17 9',
      'M9 17H15',
      'M3 12H2.6C2.26863 12 2 12.2686 2 12.6V21.4C2 21.7314 2.26863 22 2.6 22H21.4C21.7314 22 22 21.7314 22 21.4V12.6C22 12.2686 21.7314 12 21.4 12H21M3 12V2.6C3 2.26863 3.26863 2 3.6 2H20.4C20.7314 2 21 2.26863 21 2.6V12M3 12H21',
    ],

    /* System section */
    'engine': [
      'M12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17Z',
      'M21 7.353V16.647C21 16.865 20.882 17.066 20.691 17.172L12.291 21.838C12.11 21.939 11.89 21.939 11.709 21.838L3.309 17.172C3.118 17.066 3 16.865 3 16.647V7.353C3 7.135 3.118 6.934 3.309 6.829L11.709 2.162C11.89 2.061 12.11 2.061 12.291 2.162L20.691 6.829C20.882 6.934 21 7.135 21 7.353Z',
      'M20.5 16.722L12.291 12.162C12.11 12.061 11.89 12.061 11.709 12.162L3.5 16.722',
      'M3.528 7.294L11.709 11.838C11.89 11.939 12.11 11.939 12.291 11.838L20.5 7.278',
      'M12 3V12',
      'M12 19.5V22',
    ],
    'model': [
      'M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z',
      'M12 8V12L15 15',
      'M8 12H12M12 12V16',
    ],
    'bell': [
      'M18 8.4C18 6.70261 17.3679 5.07475 16.2426 3.87452C15.1174 2.67428 13.5913 2 12 2C10.4087 2 8.88258 2.67428 7.75736 3.87452C6.63214 5.07475 6 6.70261 6 8.4C6 15.8667 3 18 3 18H21C21 18 18 15.8667 18 8.4Z',
      'M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21',
    ],
    'sparkle': [
      'M8 15C12.8747 15 15 12.949 15 8C15 12.949 17.1104 15 22 15C17.1104 15 15 17.1104 15 22C15 17.1104 12.8747 15 8 15Z',
      'M2 6.5C5.13376 6.5 6.5 5.18153 6.5 2C6.5 5.18153 7.85669 6.5 11 6.5C7.85669 6.5 6.5 7.85669 6.5 11C6.5 7.85669 5.13376 6.5 2 6.5Z',
    ],
    'gear': [
      'M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z',
      'M19.6224 10.3954L18.5247 7.7448L20 6L18 4L16.2647 5.48295L13.5578 4.36974L12.9353 2H10.981L10.3491 4.40113L7.70441 5.51596L6 4L4 6L5.45337 7.78885L4.3725 10.4463L2 11V13L4.40111 13.6555L5.51575 16.2997L4 18L6 20L7.79116 18.5403L10.397 19.6123L11 22H13L13.6045 19.6132L16.2551 18.5155C16.6969 18.8313 18 20 18 20L20 18L18.5159 16.2494L19.6139 13.598L21.9999 12.9772L22 11L19.6224 10.3954Z',
    ],

    /* Object types */
    'note-pencil': [
      'M20 12V5.74853C20 5.5894 19.9368 5.43679 19.8243 5.32426L16.6757 2.17574C16.5632 2.06321 16.4106 2 16.2515 2H4.6C4.26863 2 4 2.26863 4 2.6V21.4C4 21.7314 4.26863 22 4.6 22H11',
      'M8 10H16M8 6H12M8 14H11',
      'M17.9541 16.9394L18.9541 15.9394C19.392 15.5015 20.102 15.5015 20.5399 15.9394V15.9394C20.9778 16.3773 20.9778 17.0873 20.5399 17.5252L19.5399 18.5252M17.9541 16.9394L14.963 19.9305C14.8131 20.0804 14.7147 20.2741 14.6821 20.4835L14.4394 22.0399L15.9957 21.7973C16.2052 21.7646 16.3988 21.6662 16.5487 21.5163L19.5399 18.5252M17.9541 16.9394L19.5399 18.5252',
      'M16 2V5.4C16 5.73137 16.2686 6 16.6 6H20',
    ],
    'book-open': [
      'M12 21V7C12 5.89543 12.8954 5 14 5H21.4C21.7314 5 22 5.26863 22 5.6V18.7143',
      'M12 21V7C12 5.89543 11.1046 5 10 5H2.6C2.26863 5 2 5.26863 2 5.6V18.7143',
      'M14 19L22 19',
      'M10 19L2 19',
      'M12 21C12 19.8954 12.8954 19 14 19',
      'M12 21C12 19.8954 11.1046 19 10 19',
    ],
    'person': [
      'M5 20V19C5 15.134 8.13401 12 12 12V12C15.866 12 19 15.134 19 19V20',
      'M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z',
    ],
    'map-pin': [
      'M20 10C20 14.4183 12 22 12 22C12 22 4 14.4183 4 10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10Z',
      'M12 11C12.5523 11 13 10.5523 13 10C13 9.44772 12.5523 9 12 9C11.4477 9 11 9.44772 11 10C11 10.5523 11.4477 11 12 11Z',
    ],
    'building': [
      'M10 9.01L10.01 8.99889',
      'M14 9.01L14.01 8.99889',
      'M10 13.01L10.01 12.9989',
      'M14 13.01L14.01 12.9989',
      'M10 17.01L10.01 16.9989',
      'M14 17.01L14.01 16.9989',
      'M6 20.4V5.6C6 5.26863 6.26863 5 6.6 5H12V3.6C12 3.26863 12.2686 3 12.6 3H17.4C17.7314 3 18 3.26863 18 3.6V20.4C18 20.7314 17.7314 21 17.4 21H6.6C6.26863 21 6 20.7314 6 20.4Z',
    ],
    'lightbulb': [
      'M9 18H15',
      'M10 21H14',
      'M9.00082 15C9.00098 13 8.50098 12.5 7.50082 11.5C6.50067 10.5 6.02422 9.48689 6.00082 8C5.95284 4.95029 8.00067 3 12.0008 3C16.001 3 18.0488 4.95029 18.0008 8C17.9774 9.48689 17.5007 10.5 16.5008 11.5C15.501 12.5 15.001 13 15.0008 15',
    ],
    'quote': [
      'M10 12H5C4.44772 12 4 11.5523 4 11V7.5C4 6.94772 4.44772 6.5 5 6.5H9C9.55228 6.5 10 6.94772 10 7.5V12ZM10 12C10 14.5 9 16 6 17.5',
      'M20 12H15C14.4477 12 14 11.5523 14 11V7.5C14 6.94772 14.4477 6.5 15 6.5H19C19.5523 6.5 20 6.94772 20 7.5V12ZM20 12C20 14.5 19 16 16 17.5',
    ],
    'code': [
      'M13.5 6L10 18.5',
      'M6.5 8.5L3 12L6.5 15.5',
      'M17.5 8.5L21 12L17.5 15.5',
    ],
    'check-circle': [
      'M7 12.5L10 15.5L17 8.5',
      'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z',
    ],

    /* Custom: design-nib (Compose) */
    'design-nib': [
      'M17.6744 11.4075L15.7691 17.1233C15.7072 17.309 15.5586 17.4529 15.3709 17.5087L3.69348 20.9803C3.22819 21.1186 2.79978 20.676 2.95328 20.2155L6.74467 8.84131C6.79981 8.67588 6.92419 8.54263 7.08543 8.47624L12.472 6.25822C12.696 6.166 12.9535 6.21749 13.1248 6.38876L17.5294 10.7935C17.6901 10.9542 17.7463 11.1919 17.6744 11.4075Z',
      'M3.2959 20.6016L9.65986 14.2376',
      'M17.7917 11.0557L20.6202 8.22724C21.4012 7.44619 21.4012 6.17986 20.6202 5.39881L18.4989 3.27749C17.7178 2.49645 16.4515 2.49645 15.6704 3.27749L12.842 6.10592',
      'M11.7814 12.1163C11.1956 11.5305 10.2458 11.5305 9.66004 12.1163C9.07426 12.7021 9.07426 13.6519 9.66004 14.2376C10.2458 14.8234 11.1956 14.8234 11.7814 14.2376C12.3671 13.6519 12.3671 12.7021 11.7814 12.1163Z',
    ],
    /* Custom: lens-plus (Artifacts) */
    'lens-plus': [
      'M2.99219 6H5.99219M8.99219 6H5.99219M5.99219 6V3M5.99219 6V9',
      'M2.11169 13.5C2.83542 18.3113 6.98691 22 11.9999 22C17.5228 22 21.9999 17.5229 21.9999 12C21.9999 6.98697 18.3112 2.83548 13.4999 2.11176',
      'M17.1973 9C17.0976 8.82774 16.9896 8.66089 16.8739 8.5',
      'M17.811 13.5C17.2683 15.6084 15.6084 17.2683 13.5 17.811',
    ],
    /* Custom: cellar (Home) */
    'cellar': [
      'M3 21H21V12C21 9.61305 20.0518 7.32387 18.364 5.63604C16.6761 3.94821 14.3869 3 12 3C9.61305 3 7.32387 3.94821 5.63604 5.63604C3.94821 7.32387 3 9.61305 3 12V21Z',
      'M3 17L21 17',
      'M9 17V13H21',
      'M13 13V9H20',
    ],
    /* Custom: strategy (Projects) */
    'strategy': [
      'M6 20.5C7 11 11.5 8 20 6',
      'M15.9086 3.80941L20.3946 5.90126L18.3028 10.3873',
      'M5 7C6.10457 7 7 6.10457 7 5C7 3.89543 6.10457 3 5 3C3.89543 3 3 3.89543 3 5C3 6.10457 3.89543 7 5 7Z',
      'M16 20.2426L18.1213 18.1213M18.1213 18.1213L20.2426 16M18.1213 18.1213L16 16M18.1213 18.1213L20.2426 20.2426',
    ],

    /* Utility */
    'arrow-left': 'M15 6L9 12L15 18',
    'plus': 'M6 12H12M18 12H12M12 12V6M12 12V18',
    'check-list': [
      'M7 12.5L10 15.5L17 8.5',
      'M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z',
    ],
    'round-flask': [
      'M10 2L10 7L4 17C3 19 4 22 7 22L17 22C20 22 21 19 20 17L14 7L14 2',
      'M8 2L16 2',
      'M7 15L17 15',
    ],
    'user-star': [
      'M5 20V19C5 15.134 8.13401 12 12 12V12C15.866 12 19 15.134 19 19V20',
      'M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z',
    ],
  };

  const pathData = paths[name];

  /* If no inline SVG path, fall back to the Iconoir component from RAIL_ICON_COMPONENTS */
  if (!pathData) {
    const IconComp = RAIL_ICON_COMPONENTS[name];
    if (IconComp) {
      return <IconComp width={size} height={size} />;
    }
  }

  const dValues = Array.isArray(pathData) ? pathData : [pathData ?? paths['note-pencil']];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {dValues.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

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
