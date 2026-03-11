'use client';

interface TerminalBlockProps {
  title: string;
  status?: 'idle' | 'running' | 'complete' | 'error' | 'degraded';
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function TerminalBlock({
  title,
  status = 'idle',
  children,
  compact,
  className,
  style,
}: TerminalBlockProps) {
  const statusColor =
    status === 'error' ? 'var(--cp-term-red)' :
    status === 'running' ? 'var(--cp-term-amber)' :
    status === 'degraded' ? 'var(--cp-term-amber)' :
    'var(--cp-term-green)';

  return (
    <div
      className={className}
      style={{
        background: 'var(--cp-term)',
        border: '1px solid var(--cp-term-border)',
        borderRadius: 4,
        overflow: 'hidden',
        ...style,
      }}
    >
      {!compact && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderBottom: '1px solid var(--cp-term-border)',
        }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusColor,
            animation: status === 'running' ? 'cpPulse 2s ease-in-out infinite' : 'none',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--cp-term-muted)',
            fontFeatureSettings: 'var(--cp-kern-mono)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
          <span style={{
            marginLeft: 'auto',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            fontWeight: 600,
            color: statusColor,
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}>
            {status.toUpperCase()}
          </span>
        </div>
      )}
      <div style={{
        padding: compact ? '6px 10px' : '8px 12px',
        fontFamily: 'var(--cp-font-mono)',
        fontSize: 11,
        fontWeight: 400,
        color: 'var(--cp-term-text)',
        lineHeight: 1.7,
        fontFeatureSettings: 'var(--cp-kern-mono)',
      }}>
        {children}
      </div>
    </div>
  );
}
