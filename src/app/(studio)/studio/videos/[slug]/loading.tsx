export default function VideoEditorLoading() {
  return (
    <div style={{ display: 'flex', gap: '0', height: '100vh' }}>
      <div style={{ flex: 1, padding: '24px' }}>
        <div className="studio-skeleton" style={{ width: '60%', height: '32px', borderRadius: '4px', marginBottom: '16px' }} />
        <div className="studio-skeleton" style={{ width: '30%', height: '16px', borderRadius: '3px', marginBottom: '24px' }} />
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="studio-skeleton" style={{
            width: `${55 + i * 5}%`, height: '14px', borderRadius: '2px', marginBottom: '8px',
          }} />
        ))}
      </div>
      <div style={{
        width: '320px', borderLeft: '1px solid var(--studio-border)',
        padding: '16px',
      }}>
        <div className="studio-skeleton" style={{ width: '100%', height: '32px', borderRadius: '4px', marginBottom: '16px' }} />
        <div className="studio-skeleton" style={{ width: '100%', height: '200px', borderRadius: '4px' }} />
      </div>
    </div>
  );
}
