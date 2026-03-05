import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
};

/**
 * Studio settings page.
 * Placeholder until API wiring (Batch 5).
 */
export default function SettingsPage() {
  return (
    <div style={{ padding: '32px 40px' }}>
      <div className="studio-section-head">
        <span className="studio-section-label">Settings</span>
        <span className="studio-section-line" />
      </div>
      <p
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '14px',
          color: 'var(--studio-text-2)',
          marginTop: '16px',
        }}
      >
        Site configuration, tokens, and publishing settings will appear here
        when connected to the Django API.
      </p>
    </div>
  );
}
