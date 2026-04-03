'use client';

import { useState } from 'react';
import ParticleField from '@/components/theseus/renderers/ParticleField';

export default function ParticleTestPage() {
  const [progress, setProgress] = useState(0);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <ParticleField progress={progress} />

      {/* Scrubber overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 18px',
          background: 'rgba(15,16,18,0.76)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--vie-font-mono, monospace)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            whiteSpace: 'nowrap',
          }}
        >
          progress
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={progress}
          onChange={(e) => setProgress(parseFloat(e.target.value))}
          style={{ width: 240, accentColor: '#4A8A96' }}
        />
        <span
          style={{
            fontFamily: 'var(--vie-font-mono, monospace)',
            fontSize: 13,
            color: '#4A8A96',
            minWidth: 40,
            textAlign: 'right',
          }}
        >
          {(progress * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
