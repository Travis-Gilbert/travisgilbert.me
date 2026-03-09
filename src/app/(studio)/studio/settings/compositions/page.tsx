/**
 * /studio/settings/compositions: Page composition viewer.
 *
 * Displays per-page composition settings (homepage, essay listing, etc.)
 * from the Django PageComposition model. Read-only on this side; editing
 * happens in Django Studio at /compose/.
 */

import { fetchSettings, type StudioComposition } from '@/lib/studio-api';

export const dynamic = 'force-dynamic';

function CompositionCard({ comp }: { comp: StudioComposition }) {
  const settingKeys = Object.keys(comp.settings);

  return (
    <div
      style={{
        border: '1px solid var(--studio-border)',
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: 'var(--studio-surface)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px',
          borderBottom:
            settingKeys.length > 0
              ? '1px solid var(--studio-border)'
              : 'none',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--studio-text-1)',
            }}
          >
            {comp.pageLabel}
          </div>
          <div
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginTop: '2px',
            }}
          >
            {comp.pageKey}
          </div>
        </div>
        {comp.updatedAt && (
          <div
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              color: 'var(--studio-text-3)',
              whiteSpace: 'nowrap',
            }}
          >
            {new Date(comp.updatedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </div>
        )}
      </div>

      {/* Settings entries */}
      {settingKeys.length > 0 && (
        <div style={{ padding: '8px 12px' }}>
          {settingKeys.map((key) => {
            const value = comp.settings[key];
            const display =
              typeof value === 'string'
                ? value
                : JSON.stringify(value, null, 2);

            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  gap: '8px',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(58, 54, 50, 0.06)',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '10px',
                    color: 'var(--studio-text-2)',
                    minWidth: '100px',
                    flexShrink: 0,
                  }}
                >
                  {key}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '10px',
                    color: 'var(--studio-text-3)',
                    wordBreak: 'break-word',
                    whiteSpace: typeof value === 'string' ? 'normal' : 'pre',
                  }}
                >
                  {display || 'null'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {settingKeys.length === 0 && (
        <div style={{ padding: '8px 12px' }}>
          <div
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
              color: 'var(--studio-text-3)',
              fontStyle: 'italic',
            }}
          >
            No settings configured
          </div>
        </div>
      )}
    </div>
  );
}

export default async function CompositionsPage() {
  const settings = await fetchSettings();
  const compositions = settings?.compositions ?? [];

  return (
    <>
      <div className="studio-section-head" style={{ marginTop: 0 }}>
        <span className="studio-section-label">Page Compositions</span>
        <span className="studio-section-line" />
      </div>

      {compositions.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '8px',
          }}
        >
          {compositions.map((comp) => (
            <CompositionCard key={comp.id} comp={comp} />
          ))}
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            color: 'var(--studio-text-3)',
            fontStyle: 'italic',
          }}
        >
          No page compositions configured. Create them in Django Studio at
          /compose/.
        </p>
      )}

      <div
        style={{
          marginTop: '12px',
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          color: 'var(--studio-text-3)',
          letterSpacing: '0.06em',
        }}
      >
        {compositions.length} composition{compositions.length !== 1 ? 's' : ''}{' '}
        configured
      </div>
    </>
  );
}
