export default function EssaysLoading() {
  const pulse = 'studio-skeleton-pulse 1.5s ease-in-out infinite';
  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Section header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: '22px' }}>
        <div style={{
          height: '10px',
          width: '80px',
          backgroundColor: 'var(--studio-surface)',
          borderRadius: '2px',
          animation: pulse,
        }} />
        <div style={{ flex: 1, height: '1px', background: 'rgba(180, 90, 45, 0.1)' }} />
      </div>

      {/* Hero zone skeleton */}
      <div style={{
        padding: '20px 22px',
        marginBottom: '24px',
        backgroundColor: 'var(--studio-surface)',
        borderRadius: '6px',
        border: '1px solid var(--studio-border)',
      }}>
        <div style={{ height: '22px', width: '60%', backgroundColor: 'var(--studio-bg)', borderRadius: '3px', marginBottom: '12px', animation: pulse }} />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <div style={{ height: '24px', width: '80px', backgroundColor: 'var(--studio-bg)', borderRadius: '5px', animation: pulse }} />
          <div style={{ height: '24px', width: '120px', backgroundColor: 'var(--studio-bg)', borderRadius: '5px', animation: pulse, animationDelay: '0.15s' }} />
        </div>
        <div style={{ height: '14px', width: '40%', backgroundColor: 'var(--studio-bg)', borderRadius: '2px', animation: pulse, animationDelay: '0.3s' }} />
      </div>

      {/* Card list skeletons */}
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          padding: '12px 14px',
          marginBottom: '4px',
          backgroundColor: 'var(--studio-surface)',
          borderRadius: '4px',
          border: '1px solid var(--studio-border)',
        }}>
          <div style={{ height: '14px', width: `${50 + i * 8}%`, backgroundColor: 'var(--studio-bg)', borderRadius: '2px', animation: pulse, animationDelay: `${i * 0.1}s` }} />
        </div>
      ))}
    </div>
  );
}
