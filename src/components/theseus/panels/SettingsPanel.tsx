'use client';

/**
 * SettingsPanel: placeholder for future settings.
 * Will include: MCP connector directory, algorithm tuning.
 */
export default function SettingsPanel() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: 'var(--vie-font-title)',
          fontSize: 20,
          fontWeight: 400,
          color: 'var(--vie-text)',
          margin: '0 0 8px',
        }}>
          Settings
        </h2>
        <p style={{
          fontFamily: 'var(--vie-font-body)',
          fontSize: 13,
          color: 'var(--vie-text-dim)',
        }}>
          Algorithm tuning, connectors, and preferences.
        </p>
      </div>
    </div>
  );
}
