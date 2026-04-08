'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

function ThreePointsCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.5" fill="none" aria-hidden="true">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 6C5.55228 6 6 5.55228 6 5C6 4.44772 5.55228 4 5 4C4.44772 4 4 4.44772 4 5C4 5.55228 4.44772 6 5 6Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20C5.55228 20 6 19.5523 6 19C6 18.4477 5.55228 18 5 18C4.44772 18 4 18.4477 4 19C4 19.5523 4.44772 20 5 20Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 20C19.5523 20 20 19.5523 20 19C20 18.4477 19.5523 18 19 18C18.4477 18 18 18.4477 18 19C18 19.5523 18.4477 20 19 20Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 19H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 19H13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExtrudeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="1.5" fill="none" aria-hidden="true">
      <path d="M21 12.353L21 16.647C21 16.8649 20.8819 17.0656 20.6914 17.1715L12.2914 21.8381C12.1102 21.9388 11.8898 21.9388 11.7086 21.8381L3.30861 17.1715C3.11814 17.0656 3 16.8649 3 16.647L2.99998 12.353C2.99998 12.1351 3.11812 11.9344 3.3086 11.8285L11.7086 7.16188C11.8898 7.06121 12.1102 7.06121 12.2914 7.16188L20.6914 11.8285C20.8818 11.9344 21 12.1351 21 12.353Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.52844 12.2936L11.7086 16.8382C11.8898 16.9388 12.1102 16.9388 12.2914 16.8382L20.5 12.2778" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 21.5V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12V2M12 2L14.5 4.5M12 2L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function isArtifacts(pathname: string): boolean {
  return pathname.startsWith('/theseus/artifacts') || pathname.startsWith('/theseus/library');
}

function isModels(pathname: string): boolean {
  return pathname.startsWith('/theseus/models');
}

function isMapDetail(pathname: string): boolean {
  return pathname.startsWith('/theseus/truth-maps/');
}

export default function TheseusNav() {
  const pathname = usePathname() ?? '';
  const prefersReducedMotion = usePrefersReducedMotion();
  const inArtifacts = isArtifacts(pathname);
  const inModels = isModels(pathname);
  const inMapDetail = isMapDetail(pathname);
  const inSubpage = inArtifacts || inModels || inMapDetail;

  return (
    <nav className="theseus-nav" aria-label="Theseus navigation">
      {/* Left: brand + breadcrumbs */}
      <div className="theseus-nav-left">
        {inSubpage && (
          <Link
            className="theseus-nav-back"
            href={inMapDetail ? '/theseus/artifacts' : '/theseus'}
            aria-label={inMapDetail ? 'Back to Artifacts' : 'Back to Ask'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <Link className="theseus-nav-brand" href="/theseus">
          Theseus
        </Link>
        {inArtifacts && (
          <>
            <span className="theseus-nav-sep">/</span>
            <span className="theseus-nav-page">artifacts</span>
          </>
        )}
        {inModels && (
          <>
            <span className="theseus-nav-sep">/</span>
            <span className="theseus-nav-page">models</span>
          </>
        )}
        {inMapDetail && (
          <>
            <span className="theseus-nav-sep">/</span>
            <Link className="theseus-nav-page theseus-nav-page-link" href="/theseus/artifacts">
              artifacts
            </Link>
            <span className="theseus-nav-sep">/</span>
            <span className="theseus-nav-page">map</span>
          </>
        )}
      </div>

      {/* Center: nav pills are rendered only under prefers-reduced-motion,
          as a static fallback for users who won't see the dot-substrate
          attractor buttons. Default path hides them entirely. */}
      {prefersReducedMotion && (
        <div className="theseus-nav-center">
          <Link
            className={`theseus-nav-pill theseus-nav-pill-artifacts${inArtifacts ? ' is-active' : ''}`}
            href="/theseus/artifacts"
            aria-label="Artifacts"
          >
            <ThreePointsCircleIcon />
            <span>Artifacts</span>
          </Link>
          <Link
            className={`theseus-nav-pill theseus-nav-pill-models${inModels ? ' is-active' : ''}`}
            href="/theseus/models"
            aria-label="Models"
          >
            <ExtrudeIcon />
            <span>Models</span>
          </Link>
        </div>
      )}

      {/* Right: empty for balance */}
      <div className="theseus-nav-right" />
    </nav>
  );
}
