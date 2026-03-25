export default function EditorLoading() {
  const pulse = 'studio-skeleton-pulse 1.5s ease-in-out infinite';
  return (
    <div>
      {/* Stage bar skeleton */}
      <div style={{
        backgroundColor: 'rgba(26, 24, 22, 0.96)',
        borderBottom: '1px solid var(--studio-border)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{ height: '20px', width: '60px', backgroundColor: 'var(--studio-surface)', borderRadius: '4px', animation: pulse }} />
        <div style={{ height: '6px', width: '6px', borderRadius: '50%', backgroundColor: 'var(--studio-surface)' }} />
        <div style={{ width: '24px', height: '1px', background: 'var(--studio-border)' }} />
        <div style={{ height: '6px', width: '6px', borderRadius: '50%', backgroundColor: 'var(--studio-surface)' }} />
      </div>

      {/* Writing area skeleton */}
      <div style={{ padding: '32px 48px', maxWidth: '720px' }}>
        <div style={{ height: '28px', width: '45%', backgroundColor: 'var(--studio-surface)', borderRadius: '3px', marginBottom: '20px', animation: pulse }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '14px', width: `${70 + i * 5}%`, backgroundColor: 'var(--studio-surface)', borderRadius: '2px', marginBottom: '10px', animation: pulse, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}
