import WealthHealthChart from '@/components/charts/WealthHealthChart';

/**
 * Embed-safe route for the animated wealth-health bubble chart.
 */
export default function WealthHealthEmbedPage() {
  return (
    <main
      style={{
        margin: 0,
        padding: '10px',
        minHeight: '100vh',
        background: '#F5EEE4',
        color: '#2A2420',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1120px',
          margin: '0 auto',
          border: '1px solid rgba(42, 36, 32, 0.12)',
          borderRadius: '10px',
          background: '#FAF6F1',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          padding: '10px',
          overflow: 'hidden',
        }}
      >
        <WealthHealthChart dataUrl="/charts/nations.json" />
      </div>
    </main>
  );
}

