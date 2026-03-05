import Link from 'next/link';

export default function TimelineModeTabs({
  mode,
}: {
  mode: 'list' | 'graph';
}) {
  return (
    <div
      style={{
        padding: '16px 40px 0',
        display: 'flex',
        gap: '8px',
      }}
    >
      <Link
        href="/studio/timeline"
        className="studio-filter-pill"
        data-active={mode === 'list' ? 'true' : 'false'}
        style={{
          color: 'var(--studio-text-2)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        List view
      </Link>
      <Link
        href="/studio/timeline/graph"
        className="studio-filter-pill"
        data-active={mode === 'graph' ? 'true' : 'false'}
        style={{
          color: 'var(--studio-stage-revising)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        Graph view
      </Link>
    </div>
  );
}
