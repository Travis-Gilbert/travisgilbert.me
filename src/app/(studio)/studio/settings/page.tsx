import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { STUDIO_API_BASE } from '@/lib/studio';

export const metadata: Metadata = {
  title: 'Settings',
};

export const dynamic = 'force-dynamic';

interface StudioSettingsLogItem {
  id: string;
  content_type: string;
  content_slug: string;
  content_title: string;
  success: boolean;
  commit_sha: string;
  commit_url: string;
  error_message: string;
  created_at: string;
}

interface StudioSettingsResponse {
  connection: {
    status: 'ok' | 'error';
    checked_at: string;
    message: string;
  };
  design_tokens: {
    colors: Record<string, string>;
    fonts: Record<string, string>;
    spacing: Record<string, string>;
    section_colors: Record<string, string>;
  };
  navigation: Array<{
    id: string;
    label: string;
    path: string;
    icon: string;
    visible: boolean;
    order: number;
  }>;
  seo: {
    title_template: string;
    description: string;
    og_fallback: string;
  };
  publishing: {
    last_deploy: StudioSettingsLogItem | null;
    publish_log: StudioSettingsLogItem[];
  };
}

interface SettingsLoadResult {
  data: StudioSettingsResponse | null;
  connected: boolean;
  error: string | null;
}

function isColorValue(value: string): boolean {
  const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  return (
    hexPattern.test(value) ||
    value.startsWith('rgb(') ||
    value.startsWith('rgba(') ||
    value.startsWith('hsl(') ||
    value.startsWith('hsla(')
  );
}

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    return 'Unknown';
  }
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function loadSettings(): Promise<SettingsLoadResult> {
  const requestUrl = `${STUDIO_API_BASE}/settings/`;

  try {
    const response = await fetch(requestUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        data: null,
        connected: false,
        error: `Request failed (${response.status})`,
      };
    }

    const payload = (await response.json()) as StudioSettingsResponse;
    return {
      data: payload,
      connected: payload.connection?.status === 'ok',
      error: null,
    };
  } catch {
    return {
      data: null,
      connected: false,
      error: 'Could not reach Django editor API',
    };
  }
}

function SectionWrap({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: '24px' }}>
      <div className="studio-section-head" style={{ marginTop: 0 }}>
        <span className="studio-section-label">{title}</span>
        <span className="studio-section-line" />
      </div>
      {children}
    </section>
  );
}

function DataField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
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

export default async function SettingsPage() {
  const { data, connected, error } = await loadSettings();

  const tokenColors = data?.design_tokens.colors ?? {};
  const sectionColors = data?.design_tokens.section_colors ?? {};
  const fonts = data?.design_tokens.fonts ?? {};
  const spacing = data?.design_tokens.spacing ?? {};
  const navigation = data?.navigation ?? [];
  const seo = data?.seo;
  const publishLog = data?.publishing.publish_log ?? [];
  const lastDeploy = data?.publishing.last_deploy ?? null;

  const swatches = [
    ...Object.entries(tokenColors),
    ...Object.entries(sectionColors).map(([key, value]) => [
      `section.${key}`,
      value,
    ] as const),
  ].filter(([, value]) => isColorValue(value));

  return (
    <div style={{ padding: '32px 40px', maxWidth: '980px' }}>
      <div className="studio-section-head" style={{ marginTop: 0 }}>
        <span className="studio-section-label">Settings</span>
        <span className="studio-section-line" />
      </div>

      <div
        style={{
          border: `1px solid ${connected ? 'rgba(90, 122, 74, 0.5)' : 'rgba(164, 74, 58, 0.5)'}`,
          backgroundColor: connected
            ? 'rgba(90, 122, 74, 0.12)'
            : 'rgba(164, 74, 58, 0.12)',
          borderRadius: '6px',
          padding: '10px 12px',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: connected ? '#6A9A5A' : '#A44A3A',
            flexShrink: 0,
          }}
        />
        <div
          style={{
            fontFamily: 'var(--studio-font-body)',
            fontSize: '13px',
            color: 'var(--studio-text-1)',
          }}
        >
          Django connection status: {connected ? 'Connected' : 'Disconnected'}
          {error ? ` (${error})` : ''}
        </div>
      </div>

      <SectionWrap title="Design Tokens">
        {swatches.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '8px',
              marginBottom: '10px',
            }}
          >
            {swatches.map(([key, value]) => (
              <div
                key={key}
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
                    {key}
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
            ))}
          </div>
        ) : (
          <p
            style={{
              margin: '0 0 10px',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '13px',
              color: 'var(--studio-text-3)',
              fontStyle: 'italic',
            }}
          >
            No color token values available.
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '8px',
          }}
        >
          {Object.entries(fonts).slice(0, 6).map(([key, value]) => (
            <DataField key={`font-${key}`} label={`Font: ${key}`} value={value} />
          ))}
          {Object.entries(spacing).slice(0, 6).map(([key, value]) => (
            <DataField key={`space-${key}`} label={`Spacing: ${key}`} value={value} />
          ))}
        </div>
      </SectionWrap>

      <SectionWrap title="Navigation">
        {navigation.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {navigation.map((item) => (
              <div
                key={item.id}
                style={{
                  border: '1px solid var(--studio-border)',
                  borderRadius: '6px',
                  padding: '9px 12px',
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
                      marginTop: '2px',
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '10px',
                      color: 'var(--studio-text-3)',
                    }}
                  >
                    {item.path}
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
                  }}
                >
                  #{item.order} {item.visible ? 'Visible' : 'Hidden'}
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
      </SectionWrap>

      <SectionWrap title="SEO">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '8px',
          }}
        >
          <DataField
            label="Title template"
            value={seo?.title_template ?? ''}
          />
          <DataField
            label="Description"
            value={seo?.description ?? ''}
          />
          <DataField
            label="OG fallback"
            value={seo?.og_fallback ?? ''}
          />
        </div>
      </SectionWrap>

      <SectionWrap title="Publishing">
        <div
          style={{
            border: '1px solid var(--studio-border)',
            borderRadius: '6px',
            padding: '10px 12px',
            backgroundColor: 'var(--studio-surface)',
            marginBottom: '10px',
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
            Last deploy
          </div>
          {lastDeploy ? (
            <div
              style={{
                fontFamily: 'var(--studio-font-body)',
                fontSize: '13px',
                color: 'var(--studio-text-1)',
                lineHeight: 1.4,
              }}
            >
              {lastDeploy.content_title} ({lastDeploy.content_type}) at{' '}
              {formatDateTime(lastDeploy.created_at)}
              {lastDeploy.commit_sha ? `, commit ${lastDeploy.commit_sha.slice(0, 7)}` : ''}
            </div>
          ) : (
            <div
              style={{
                fontFamily: 'var(--studio-font-body)',
                fontSize: '13px',
                color: 'var(--studio-text-3)',
                fontStyle: 'italic',
              }}
            >
              No successful deploy log found.
            </div>
          )}
        </div>

        {publishLog.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {publishLog.slice(0, 8).map((log) => (
              <div
                key={log.id}
                style={{
                  border: '1px solid var(--studio-border)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  backgroundColor: 'var(--studio-surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--studio-font-body)',
                      fontSize: '13px',
                      color: 'var(--studio-text-1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {log.content_title}
                  </div>
                  <div
                    style={{
                      marginTop: '2px',
                      fontFamily: 'var(--studio-font-mono)',
                      fontSize: '9px',
                      color: 'var(--studio-text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    {log.content_type} · {formatDateTime(log.created_at)}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--studio-font-mono)',
                    fontSize: '9px',
                    color: log.success ? '#6A9A5A' : '#A44A3A',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {log.success ? 'Success' : 'Failed'}
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
            Publish log is empty.
          </p>
        )}
      </SectionWrap>

      <SectionWrap title="Django Connection Status">
        <div
          style={{
            border: `1px solid ${connected ? 'rgba(90, 122, 74, 0.5)' : 'rgba(164, 74, 58, 0.5)'}`,
            backgroundColor: connected
              ? 'rgba(90, 122, 74, 0.12)'
              : 'rgba(164, 74, 58, 0.12)',
            borderRadius: '6px',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--studio-font-body)',
              fontSize: '13px',
              color: 'var(--studio-text-1)',
            }}
          >
            {data?.connection.message ?? 'Django API unavailable'}
          </div>
          <div
            style={{
              fontFamily: 'var(--studio-font-mono)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: connected ? '#6A9A5A' : '#A44A3A',
            }}
          >
            {connected ? 'Green' : 'Red'}
          </div>
        </div>
      </SectionWrap>
    </div>
  );
}
