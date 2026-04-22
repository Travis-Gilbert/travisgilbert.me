'use client';

interface AtlasScaleBarProps {
  zoom?: number;
}

/** Bottom-left cos-sim / zoom scale bar for the Explorer canvas. */
export default function AtlasScaleBar({ zoom }: AtlasScaleBarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        font: '500 10px/1 var(--font-mono)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--paper-ink-3)',
      }}
    >
      <span>cos sim</span>
      <div style={{ position: 'relative', width: 120, height: 1, background: 'var(--paper-ink-3)' }}>
        <span style={{ position: 'absolute', left: 0, top: -3, width: 1, height: 6, background: 'var(--paper-ink-3)' }} />
        <span style={{ position: 'absolute', right: 0, top: -3, width: 1, height: 6, background: 'var(--paper-ink-3)' }} />
      </div>
      <span>0 → 1{zoom != null && ` · ${zoom.toFixed(2)}×`}</span>
    </div>
  );
}
