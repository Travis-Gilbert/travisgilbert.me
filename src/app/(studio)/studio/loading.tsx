export default function StudioLoading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '24px',
      maxWidth: '960px',
      margin: '0 auto',
    }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="studio-skeleton" style={{
            width: '25%', height: '64px', borderRadius: '6px',
          }} />
        ))}
      </div>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="studio-skeleton" style={{
          width: '100%', height: '48px', borderRadius: '4px',
        }} />
      ))}
    </div>
  );
}
