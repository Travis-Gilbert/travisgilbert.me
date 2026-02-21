'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Invisible Client Component that listens for Ctrl+Shift+E (or Cmd+Shift+E
 * on Mac) and opens the Studio editing interface for the current page.
 *
 * The Studio app is auth-protected, so even if someone discovers the shortcut,
 * they just land on a login page.
 *
 * Path mapping:
 *   /essays/the-parking-lot-problem  ->  STUDIO/essays/the-parking-lot-problem/
 *   /field-notes/some-note           ->  STUDIO/field-notes/some-note/
 *   /shelf                           ->  STUDIO/shelf/
 *   /projects                        ->  STUDIO/projects/
 *   /now                             ->  STUDIO/now/
 *   / (or anything else)             ->  STUDIO/ (dashboard)
 */

const STUDIO_BASE = process.env.NEXT_PUBLIC_STUDIO_URL || 'http://localhost:8000';

function mapPathToStudio(pathname: string): string {
  // Essay detail page
  const essayMatch = pathname.match(/^\/essays\/([^/]+)$/);
  if (essayMatch) return `${STUDIO_BASE}/essays/${essayMatch[1]}/`;

  // Field note detail page
  const noteMatch = pathname.match(/^\/field-notes\/([^/]+)$/);
  if (noteMatch) return `${STUDIO_BASE}/field-notes/${noteMatch[1]}/`;

  // Section listing pages
  if (pathname === '/essays' || pathname === '/essays/') return `${STUDIO_BASE}/essays/`;
  if (pathname.startsWith('/field-notes')) return `${STUDIO_BASE}/field-notes/`;
  if (pathname.startsWith('/shelf')) return `${STUDIO_BASE}/shelf/`;
  if (pathname.startsWith('/projects')) return `${STUDIO_BASE}/projects/`;
  if (pathname.startsWith('/now')) return `${STUDIO_BASE}/now/`;

  // Project detail page
  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) return `${STUDIO_BASE}/projects/${projectMatch[1]}/`;

  // Everything else goes to dashboard
  return `${STUDIO_BASE}/`;
}

export default function StudioShortcut() {
  const pathname = usePathname();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+E or Cmd+Shift+E
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        const studioUrl = mapPathToStudio(pathname);
        window.open(studioUrl, '_blank', 'noopener');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pathname]);

  return null;
}
