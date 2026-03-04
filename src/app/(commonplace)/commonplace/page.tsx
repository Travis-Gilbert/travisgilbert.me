import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Timeline',
  description: 'The immutable record of everything. Objects exist. Nodes happen.',
};

/**
 * CommonPlace home: The Timeline.
 *
 * This is a shell placeholder. Session 7 builds the full
 * Timeline view with paginated Nodes, type icons, timestamps,
 * retrospective notes, and date range search.
 *
 * For now it renders the warm studio atmosphere with
 * the split pane system (Session 5) wrapping this content.
 */
export default function CommonPlacePage() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <h1
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontStyle: 'italic',
            fontSize: 32,
            fontWeight: 600,
            color: 'var(--cp-text)',
            marginBottom: 12,
          }}
        >
          CommonPlace
        </h1>
        <p
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--cp-text-faint)',
            marginBottom: 32,
          }}
        >
          Objects exist. Nodes happen.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            maxWidth: 320,
            margin: '0 auto',
          }}
        >
          <StatCard label="Objects" value="0" />
          <StatCard label="Nodes" value="0" />
          <StatCard label="Edges" value="0" />
          <StatCard label="Notebooks" value="0" />
        </div>

        <p
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 14,
            color: 'var(--cp-text-muted)',
            marginTop: 32,
            lineHeight: 1.6,
          }}
        >
          Capture something to begin. The Timeline will fill with
          Nodes as Objects are created, connected, and revisited.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="cp-grain cp-grain-card"
      style={{
        background: 'var(--cp-card)',
        borderRadius: 8,
        padding: '16px 12px',
        border: '1px solid var(--cp-border-faint)',
        boxShadow: 'var(--cp-shadow-sm)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: 28,
          fontWeight: 700,
          color: 'var(--cp-text)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--cp-font-mono)',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--cp-text-faint)',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
