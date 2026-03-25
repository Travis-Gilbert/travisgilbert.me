export default function StudioOffline() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      fontFamily: 'var(--studio-font-body)',
      color: 'var(--studio-text-2)',
      textAlign: 'center',
      padding: '24px',
    }}>
      <h1 style={{
        fontFamily: 'var(--studio-font-mono)',
        fontSize: '14px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--studio-text-3)',
        marginBottom: '12px',
      }}>
        Offline
      </h1>
      <p style={{ fontSize: '14px', maxWidth: '360px', lineHeight: 1.6 }}>
        Studio needs a connection for this page.
        Your drafts are safe in local storage.
        Connect to the internet and reload.
      </p>
    </div>
  );
}
