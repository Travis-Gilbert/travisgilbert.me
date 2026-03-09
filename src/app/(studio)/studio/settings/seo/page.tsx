/**
 * /studio/settings/seo: SEO settings viewer.
 *
 * Shows title template, meta description, and OG fallback image
 * from the Django SiteSettings singleton. Read-only; editing
 * happens in Django Studio at /settings/site/.
 */

import { fetchSettings } from '@/lib/studio-api';

export const dynamic = 'force-dynamic';

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--studio-border)',
        borderRadius: '6px',
        padding: '10px 12px',
        backgroundColor: 'var(--studio-surface)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--studio-text-3)',
          marginBottom: '4px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '13px',
          color: 'var(--studio-text-1)',
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
      >
        {value || 'Not set'}
      </div>
    </div>
  );
}

export default async function SeoPage() {
  const settings = await fetchSettings();
  const seo = settings?.seo;

  return (
    <>
      <div className="studio-section-head" style={{ marginTop: 0 }}>
        <span className="studio-section-label">SEO Settings</span>
        <span className="studio-section-line" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '8px',
        }}
      >
        <DataField
          label="Title Template"
          value={seo?.titleTemplate ?? ''}
        />
        <DataField
          label="Meta Description"
          value={seo?.description ?? ''}
        />
        <DataField
          label="OG Fallback Image"
          value={seo?.ogFallback ?? ''}
        />
      </div>

      {seo?.ogFallback && (
        <div style={{ marginTop: '16px' }}>
          <div
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--studio-text-3)',
              marginBottom: '6px',
            }}
          >
            Preview
          </div>
          <div
            style={{
              border: '1px solid var(--studio-border)',
              borderRadius: '6px',
              overflow: 'hidden',
              maxWidth: '400px',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={seo.ogFallback}
              alt="OG fallback preview"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
