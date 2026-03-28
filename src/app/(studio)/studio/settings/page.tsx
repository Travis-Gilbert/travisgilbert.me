/**
 * /studio/settings: Overview page with connection status and publish log.
 *
 * Sub-pages handle individual settings sections (tokens, navigation, SEO,
 * compositions). This overview shows the Django connection health check
 * and recent publish history.
 */

import { fetchSettings, type StudioSettingsLogItem } from '@/lib/studio-api';
import HighlightSettings from '@/components/studio/HighlightSettings';

export const dynamic = 'force-dynamic';

/* ── Helpers ──────────────────────────────── */

function formatDateTime(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 'Unknown';
  return dt.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function LogRow({ log }: { log: StudioSettingsLogItem }) {
  return (
    <div
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
          {log.contentTitle}
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
          {log.contentType} · {formatDateTime(log.createdAt)}
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
  );
}

/* ── Page ─────────────────────────────────── */

export default async function SettingsOverview() {
  const settings = await fetchSettings();
  const connected = settings?.connection.status === 'ok';
  const lastDeploy = settings?.publishing.lastDeploy ?? null;
  const publishLog = settings?.publishing.publishLog ?? [];

  return (
    <>
      {/* Connection status */}
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
          Django connection: {connected ? 'Connected' : 'Disconnected'}
          {!settings ? ' (could not reach API)' : ''}
        </div>
      </div>

      {/* Last deploy */}
      <section style={{ marginBottom: '20px' }}>
        <div className="studio-section-head" style={{ marginTop: 0 }}>
          <span className="studio-section-label">Last Deploy</span>
          <span className="studio-section-line" />
        </div>
        <div
          style={{
            border: '1px solid var(--studio-border)',
            borderRadius: '6px',
            padding: '10px 12px',
            backgroundColor: 'var(--studio-surface)',
          }}
        >
          {lastDeploy ? (
            <div
              style={{
                fontFamily: 'var(--studio-font-body)',
                fontSize: '13px',
                color: 'var(--studio-text-1)',
                lineHeight: 1.4,
              }}
            >
              {lastDeploy.contentTitle} ({lastDeploy.contentType}) at{' '}
              {formatDateTime(lastDeploy.createdAt)}
              {lastDeploy.commitSha
                ? `, commit ${lastDeploy.commitSha.slice(0, 7)}`
                : ''}
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
              No successful deploy found.
            </div>
          )}
        </div>
      </section>

      {/* Publish log */}
      <section>
        <div className="studio-section-head" style={{ marginTop: 0 }}>
          <span className="studio-section-label">Publish Log</span>
          <span className="studio-section-line" />
        </div>
        {publishLog.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {publishLog.slice(0, 8).map((log) => (
              <LogRow key={log.id} log={log} />
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
      </section>

      {/* Highlight color configuration */}
      <div style={{ marginTop: '22px' }}>
        <HighlightSettings />
      </div>
    </>
  );
}
