import type { ReactNode } from 'react';

/**
 * Section wrapper for dashboard intelligence groups.
 *
 * Monospace uppercase header (9px, Courier Prime) with optional
 * count badge. Grid container for StudioCards: responsive 1/2/3
 * columns. Empty state message when section has zero items.
 */
export default function DashboardSection({
  title,
  count,
  emptyMessage = 'Nothing here right now.',
  children,
}: {
  title: string;
  count?: number;
  emptyMessage?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: '32px' }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '14px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'var(--studio-text-3)',
          }}
        >
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              fontWeight: 600,
              color: 'var(--studio-text-3)',
              backgroundColor: 'var(--studio-surface)',
              border: '1px solid var(--studio-border)',
              borderRadius: '3px',
              padding: '1px 5px',
            }}
          >
            {count}
          </span>
        )}
        <span
          style={{
            flex: 1,
            height: '1px',
            backgroundColor: 'var(--studio-border)',
          }}
        />
      </div>

      {/* Card grid or empty state (use count for reliable empty detection) */}
      {count !== undefined && count > 0 ? (
        <div className="studio-dashboard-grid">{children}</div>
      ) : (
        <p
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            color: 'var(--studio-text-3)',
            fontStyle: 'italic',
            padding: '8px 0',
          }}
        >
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
