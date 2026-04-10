'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Icon: chat bubble (Home / Ask).
 * Matches the Claude.ai conversational style.
 */
function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <path
        d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.4876 3.36093 14.891 4 16.1272L3 21L7.8728 20C9.10904 20.6391 10.5124 21 12 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Icon: graph / network (Explorer).
 */
function GraphIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" aria-hidden="true">
      <circle cx="5" cy="6" r="2" stroke="currentColor" />
      <circle cx="12" cy="18" r="2" stroke="currentColor" />
      <circle cx="19" cy="6" r="2" stroke="currentColor" />
      <circle cx="12" cy="12" r="2" stroke="currentColor" />
      <path d="M6.5 7.5L10.5 11" stroke="currentColor" strokeLinecap="round" />
      <path d="M13.5 11L17.5 7.5" stroke="currentColor" strokeLinecap="round" />
      <path d="M12 14V16" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Icon: artifacts (three-point circle). Reused from original TheseusNav.
 */
function ArtifactsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.5" fill="none" aria-hidden="true">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6C5.55228 6 6 5.55228 6 5C6 4.44772 5.55228 4 5 4C4.44772 4 4 4.44772 4 5C4 5.55228 4.44772 6 5 6Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20C5.55228 20 6 19.5523 6 19C6 18.4477 5.55228 18 5 18C4.44772 18 4 18.4477 4 19C4 19.5523 4.44772 20 5 20Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 20C19.5523 20 20 19.5523 20 19C20 18.4477 19.5523 18 19 18C18.4477 18 18 18.4477 18 19C18 19.5523 18.4477 20 19 20Z" fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Icon: models (extrude/3D). Reused from original TheseusNav.
 */
function ModelsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.5" fill="none" aria-hidden="true">
      <path d="M21 12.353L21 16.647C21 16.8649 20.8819 17.0656 20.6914 17.1715L12.2914 21.8381C12.1102 21.9388 11.8898 21.9388 11.7086 21.8381L3.30861 17.1715C3.11814 17.0656 3 16.8649 3 16.647L2.99998 12.353C2.99998 12.1351 3.11812 11.9344 3.3086 11.8285L11.7086 7.16188C11.8898 7.06121 12.1102 7.06121 12.2914 7.16188L20.6914 11.8285C20.8818 11.9344 21 12.1351 21 12.353Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.52844 12.2936L11.7086 16.8382C11.8898 16.9388 12.1102 16.9388 12.2914 16.8382L20.5 12.2778" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 21.5V17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType;
  matchPrefix: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', href: '/theseus', icon: ChatIcon, matchPrefix: '/theseus' },
  { id: 'explorer', label: 'Explorer', href: '/theseus/explorer', icon: GraphIcon, matchPrefix: '/theseus/explorer' },
  { id: 'artifacts', label: 'Artifacts', href: '/theseus/artifacts', icon: ArtifactsIcon, matchPrefix: '/theseus/artifacts' },
  { id: 'models', label: 'Models', href: '/theseus/models', icon: ModelsIcon, matchPrefix: '/theseus/models' },
];

function isActive(pathname: string, item: NavItem): boolean {
  // Home matches exactly /theseus (not subpages)
  if (item.id === 'home') return pathname === '/theseus';
  // Truth-maps are nested under artifacts conceptually
  if (item.id === 'artifacts') {
    return pathname.startsWith('/theseus/artifacts') || pathname.startsWith('/theseus/truth-maps');
  }
  return pathname.startsWith(item.matchPrefix);
}

/**
 * TheseusSidebar: collapsible left rail with icon navigation.
 *
 * Always visible on desktop as a 48px icon rail. Expands to ~200px
 * on hover/focus to show labels. Hidden on mobile (TheseusMobileNav
 * renders the bottom bar instead).
 */
export default function TheseusSidebar() {
  const pathname = usePathname() ?? '';

  return (
    <nav className="theseus-sidebar" aria-label="Theseus navigation">
      {/* Brand */}
      <div className="theseus-sidebar-brand">
        <Link href="/theseus" className="theseus-sidebar-brand-link" aria-label="Theseus home">
          <span className="theseus-sidebar-brand-letter">T</span>
        </Link>
      </div>

      {/* Navigation items */}
      <div className="theseus-sidebar-items">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`theseus-sidebar-item${active ? ' is-active' : ''}`}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <span className="theseus-sidebar-icon">
                <Icon />
              </span>
              <span className="theseus-sidebar-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
