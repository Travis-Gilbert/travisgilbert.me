'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { NODE_TYPES, SIDEBAR_SECTIONS } from '@/lib/networks';

/**
 * Networks sidebar: dark panel (#15111A) with terracotta gradient edge.
 *
 * Sections: branding, navigation groups, and node type quick-create buttons.
 * 240px fixed width on desktop, collapsible on mobile (future session).
 */
export default function NetworksSidebar({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="nw-scrollbar"
      style={{
        width: mobile ? '100%' : 240,
        flexShrink: 0,
        backgroundColor: 'var(--nw-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        height: mobile ? '100%' : '100vh',
        position: mobile ? 'relative' : 'sticky',
        top: mobile ? undefined : 0,
      }}
    >
      {/* Terracotta corner glow: bloom from top-left */}
      <div className="nw-sidebar-glow" aria-hidden="true" />

      {/* Branding */}
      <div style={{ padding: '20px 16px 16px' }}>
        <Link
          href="/networks"
          onClick={onNavigate}
          style={{
            fontFamily: 'var(--nw-font-title)',
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--nw-text)',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          Networks.
        </Link>
      </div>

      {/* Navigation sections */}
      <nav style={{ flex: 1, padding: '0 8px' }}>
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.title} style={{ marginBottom: 20 }}>
            <div className="nw-sidebar-section-title">{section.title}</div>
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className="nw-sidebar-item"
                  data-active={isActive}
                  style={{ textDecoration: 'none' }}
                >
                  <SidebarIcon name={item.icon ?? 'note-pencil'} />
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 11,
                        fontFamily: 'var(--nw-font-mono)',
                        color: 'var(--nw-text-faint)',
                        backgroundColor: 'var(--nw-surface)',
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Node Types section with quick-create buttons */}
        <div style={{ marginBottom: 20 }}>
          <div className="nw-sidebar-section-title">Node Types</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 4,
              padding: '0 4px',
            }}
          >
            {NODE_TYPES.map((nodeType) => (
              <button
                key={nodeType.slug}
                type="button"
                title={`New ${nodeType.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--nw-text-muted)',
                  fontFamily: 'var(--nw-font-body)',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'background-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--nw-surface-hover)';
                  e.currentTarget.style.color = 'var(--nw-text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--nw-text-muted)';
                }}
              >
                <span
                  className="nw-type-dot"
                  style={{ backgroundColor: nodeType.color }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nodeType.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Bottom: back to main site */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--nw-border)',
        }}
      >
        <Link
          href="/"
          onClick={onNavigate}
          style={{
            fontFamily: 'var(--nw-font-mono)',
            fontSize: 11,
            color: 'var(--nw-text-faint)',
            textDecoration: 'none',
            letterSpacing: '0.05em',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--nw-text-muted)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--nw-text-faint)';
          }}
        >
          &larr; travisgilbert.me
        </Link>
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────────
   Sidebar icon: simple SVG glyphs for navigation
   ───────────────────────────────────────────────── */

function SidebarIcon({ name }: { name: string }) {
  const size = 16;
  const style = {
    width: size,
    height: size,
    flexShrink: 0 as const,
    opacity: 0.7,
  };

  // Minimal SVG icons for sidebar navigation
  const paths: Record<string, string> = {
    inbox: 'M3 8l4 4 4-4M3 12h10M2 4h12v10H2z',
    star: 'M8 1l2.2 4.5L15 6.2l-3.5 3.4.8 4.9L8 12.2 3.7 14.5l.8-4.9L1 6.2l4.8-.7z',
    briefcase: 'M2 6h12v8H2zM5 6V4a1 1 0 011-1h4a1 1 0 011 1v2',
    graph: 'M3 11a2 2 0 104 0 2 2 0 00-4 0zM9 5a2 2 0 104 0 2 2 0 00-4 0zM6.5 9.5l3-3M9 11a2 2 0 104 0 2 2 0 00-4 0z',
    link: 'M7 8.5l2-2a2.5 2.5 0 013.5 3.5l-2 2M9 7.5l-2 2a2.5 2.5 0 01-3.5-3.5l2-2',
    sparkle: 'M8 1v3M8 12v3M1 8h3M12 8h3M3.5 3.5l2 2M10.5 10.5l2 2M3.5 12.5l2-2M10.5 5.5l2-2',
    calendar: 'M2 5h12M2 3h12v11H2zM5 1v3M11 1v3',
    'note-pencil': 'M2 14l1-4L11 2l3 3-8 8zM10 3l3 3',
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
