/**
 * /studio/settings/navigation: Navigation item viewer.
 *
 * Lists all NavItem records with label, path, icon, visibility,
 * and sort order. Read-only; editing happens in Django Studio
 * at /settings/nav/.
 */

import { fetchSettings } from '@/lib/studio-api';

export const dynamic = 'force-dynamic';

export default async function NavigationPage() {
  const settings = await fetchSettings();
  const navigation = settings?.navigation ?? [];

  return (
    <>
      <div className="studio-section-head" style={{ marginTop: 0 }}>
        <span className="studio-section-label">Navigation Items</span>
        <span className="studio-section-line" />
      </div>

      {navigation.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navigation.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid var(--studio-border)',
                borderRadius: '6px',
                padding: '10px 12px',
                backgroundColor: 'var(--studio-surface)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'var(--studio-font-title)',
                    fontSize: '16px',
                    color: 'var(--studio-text-bright)',
                    lineHeight: 1.2,
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    marginTop: '3px',
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '10px',
                    color: 'var(--studio-text-3)',
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{item.path}</span>
                  {item.icon && (
                    <span style={{ opacity: 0.6 }}>icon: {item.icon}</span>
                  )}
                </div>
              </div>
              <div
                style={{
                  fontFamily: 'var(--studio-font-mono)',
                  fontSize: '10px',
                  color: item.visible ? '#6A9A5A' : '#A44A3A',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
              >
                <div>#{item.order}</div>
                <div>{item.visible ? 'Visible' : 'Hidden'}</div>
              </div>
            </div>
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
          Navigation settings not available.
        </p>
      )}

      <div
        style={{
          marginTop: '16px',
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '10px',
          color: 'var(--studio-text-3)',
        }}
      >
        {navigation.length} item{navigation.length !== 1 ? 's' : ''}
        {' · '}
        {navigation.filter((n) => n.visible).length} visible
      </div>
    </>
  );
}
