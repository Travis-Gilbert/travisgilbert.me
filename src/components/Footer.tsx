import Link from 'next/link';
import { GitBranch } from '@phosphor-icons/react/dist/ssr';
import { getSiteConfig } from '@/lib/siteConfig';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const { footer } = getSiteConfig();

  return (
    <footer className="mt-auto border-t border-border-light py-8 px-3 sm:px-4 safe-area-pad-bottom">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-mono text-ink-light">
        <div className="flex flex-col items-center sm:items-start gap-1">
          {footer.tagline && (
            <p
              className="m-0 text-ink-muted italic"
              style={{ fontSize: 11, fontFamily: 'var(--font-annotation)' }}
            >
              {footer.tagline}
            </p>
          )}
          <p className="m-0" style={{ fontSize: 12 }}>
            &copy; {currentYear}{' '}
            <span
              className="text-ink-muted"
              style={{ fontFamily: 'var(--font-name)', fontWeight: 400 }}
            >
              Travis Gilbert
            </span>
          </p>
        </div>
        <nav aria-label="Footer navigation" className="flex items-center gap-4">
          <a
            href="/rss.xml"
            aria-label="RSS Feed"
            className="text-ink-light hover:text-terracotta no-underline min-h-[44px] inline-flex items-center"
            style={{ fontSize: 11 }}
          >
            RSS
          </a>
          {footer.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              className="text-ink-light hover:text-terracotta no-underline min-h-[44px] inline-flex items-center"
              style={{ fontSize: 11 }}
            >
              {link.label}
            </a>
          ))}
          <Link
            href="/research"
            className="inline-flex items-center gap-1 text-ink-light hover:text-terracotta no-underline min-h-[44px]"
            style={{ fontSize: 11 }}
          >
            <GitBranch size={12} weight="regular" />
            Paper Trails
          </Link>
          <Link
            href="/changelog"
            className="text-ink-light hover:text-terracotta no-underline min-h-[44px] inline-flex items-center"
            style={{ fontSize: 11 }}
          >
            Changelog
          </Link>
          <Link
            href="/stats"
            className="text-ink-light hover:text-terracotta no-underline min-h-[44px] inline-flex items-center"
            style={{ fontSize: 11 }}
          >
            Stats
          </Link>
          <span className="text-border-light" aria-hidden="true">|</span>
          <Link
            href="/colophon"
            className="text-terracotta hover:text-terracotta-hover no-underline min-h-[44px] inline-flex items-center"
            style={{ fontSize: 11 }}
          >
            How this site was built &rarr;
          </Link>
        </nav>
      </div>
    </footer>
  );
}
