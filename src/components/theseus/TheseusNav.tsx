'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function getPageLabel(pathname: string): string | null {
  if (pathname.startsWith('/theseus/ask')) return 'ask';
  if (pathname.startsWith('/theseus/library')) return 'library';
  if (pathname === '/theseus' || pathname === '/theseus/') return null;
  return null;
}

export default function TheseusNav() {
  const pathname = usePathname() ?? '';
  const pageLabel = getPageLabel(pathname);

  return (
    <nav className="theseus-nav" aria-label="Theseus navigation">
      <div className="theseus-nav-left">
        <Link className="theseus-nav-brand" href="/theseus">
          Theseus
        </Link>
        {pageLabel && (
          <>
            <span className="theseus-nav-sep">/</span>
            <span className="theseus-nav-page">{pageLabel}</span>
          </>
        )}
      </div>

      <div className="theseus-nav-right">
        <Link
          className={`theseus-nav-link ${!pageLabel ? 'is-active' : ''}`}
          href="/theseus"
        >
          Ask
        </Link>
        <Link
          className={`theseus-nav-link ${pageLabel === 'library' ? 'is-active' : ''}`}
          href="/theseus/library"
        >
          Library
        </Link>
      </div>
    </nav>
  );
}
