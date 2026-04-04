'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

function isAskPath(pathname: string): boolean {
  return pathname === '/theseus' || pathname.startsWith('/theseus/ask') || pathname.startsWith('/theseus/particle-test');
}

export default function TheseusNav() {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  return (
    <nav className="theseus-nav" aria-label="Theseus navigation">
      <div className="theseus-nav-left">
        <Link className="theseus-nav-brand" href="/theseus">
          Theseus
        </Link>
      </div>

      <div className="theseus-nav-right">
        <button
          type="button"
          className="theseus-nav-btn"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          Back
        </button>
        <button
          type="button"
          className="theseus-nav-btn"
          onClick={() => router.forward()}
          aria-label="Go forward"
        >
          Forward
        </button>
        <Link
          className={`theseus-nav-link ${isAskPath(pathname) ? 'is-active' : ''}`}
          href="/theseus"
          aria-current={isAskPath(pathname) ? 'page' : undefined}
        >
          Ask
        </Link>
        <Link
          className={`theseus-nav-link ${pathname.startsWith('/theseus/library') ? 'is-active' : ''}`}
          href="/theseus/library"
          aria-current={pathname.startsWith('/theseus/library') ? 'page' : undefined}
        >
          Library
        </Link>
      </div>
    </nav>
  );
}
