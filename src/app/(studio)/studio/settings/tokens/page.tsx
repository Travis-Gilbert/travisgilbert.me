/**
 * /studio/settings/tokens: Design token viewer.
 *
 * Displays color swatches, font stacks, spacing values, and section
 * colors from the Django DesignTokenSet singleton. Read-only on this
 * side; editing happens in Django Studio at /settings/tokens/.
 */

import { fetchSettings } from '@/lib/studio-api';

export const dynamic = 'force-dynamic';

/* ── Helpers ──────────────────────────────── */

function isColorValue(value: string): boolean {
  const hex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  return (
    hex.test(value) ||
    value.startsWith('rgb(') ||
    value.startsWith('rgba(') ||
    value.startsWith('hsl(') ||
    value.startsWith('hsla(')
  );
}

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--studio-border)',
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: 'var(--studio-surface)',
      }}
    >
      <div
        style={{
          height: '32px',
          backgroundColor: value,
          borderBottom: '1px solid var(--studio-border)',
        }}
      />
      <div style={{ padding: '8px 10px' }}>
        <div
          style={{
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '9px',
            color: 'var(--studio-text-2)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {name}
        </div>
        <div
          style={{
            marginTop: '2px',
            fontFamily: 'var(--studio-font-mono)',
            fontSize: '11px',
            color: 'var(--studio-text-3)',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

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

/* ── Page ─────────────────────────────────── */

export default async function TokensPage() {
  const settings = await fetchSettings();
  const tokens = settings?.designTokens;

  const colors = tokens?.colors ?? {};
  const sectionColors = tokens?.sectionColors ?? {};
  const fonts = tokens?.fonts ?? {};
  const spacing = tokens?.spacing ?? {};

  const swatches = [
    ...Object.entries(colors),
    ...Object.entries(sectionColors).map(
      ([key, value]) => [`section.${key}`, value] as const,
    ),
  ].filter(([, value]) => isColorValue(value));

  return (
    <>
      {/* Color swatches */}
      <section style={{ marginBottom: '20px' }}>
        <div className="studio-section-head" style={{ marginTop: 0 }}>
          <span className="studio-section-label">Colors</span>
          <span className="studio-section-line" />
        </div>
        {swatches.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '8px',
            }}
          >
            {swatches.map(([name, value]) => (
              <ColorSwatch key={name} name={name} value={value} />
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
            No color token values available.
          </p>
        )}
      </section>

      {/* Fonts */}
      <section style={{ marginBottom: '20px' }}>
        <div className="studio-section-head" style={{ marginTop: 0 }}>
          <span className="studio-section-label">Fonts</span>
          <span className="studio-section-line" />
        </div>
        {Object.keys(fonts).length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '8px',
            }}
          >
            {Object.entries(fonts).map(([key, value]) => (
              <DataField key={key} label={key} value={value} />
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
            No font tokens available.
          </p>
        )}
      </section>

      {/* Spacing */}
      <section>
        <div className="studio-section-head" style={{ marginTop: 0 }}>
          <span className="studio-section-label">Spacing</span>
          <span className="studio-section-line" />
        </div>
        {Object.keys(spacing).length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: '8px',
            }}
          >
            {Object.entries(spacing).map(([key, value]) => (
              <DataField key={key} label={key} value={value} />
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
            No spacing tokens available.
          </p>
        )}
      </section>
    </>
  );
}
