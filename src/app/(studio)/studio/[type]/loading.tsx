export default function ContentListLoading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '12px',
      padding: '24px', maxWidth: '720px', margin: '0 auto',
    }}>
      <div className="studio-skeleton" style={{ width: '200px', height: '28px', borderRadius: '4px' }} />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="studio-skeleton" style={{
          width: '100%', height: '56px', borderRadius: '4px',
        }} />
      ))}
    </div>
  );
}
