'use client';

import { useState, useEffect } from 'react';

interface DualBarProps {
  label1: string;
  value1: number;
  color1: string;
  label2: string;
  value2: number;
  color2: string;
}

/**
 * Two side-by-side progress bars with labels and animated fill.
 * Used in hero sections and answer cards to show Evidence vs Tension scores.
 */
export default function DualBar({
  label1, value1, color1,
  label2, value2, color2,
}: DualBarProps) {
  const [fill1, setFill1] = useState(0);
  const [fill2, setFill2] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setFill1(value1), 200);
    const t2 = setTimeout(() => setFill2(value2), 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [value1, value2]);

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {[
        { label: label1, value: value1, fill: fill1, color: color1 },
        { label: label2, value: value2, fill: fill2, color: color2 },
      ].map(({ label, value, fill, color }) => (
        <div key={label} style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{
              fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--cp-text-faint)',
            }}>
              {label}
            </span>
            <span style={{
              fontFamily: 'var(--font-metadata, "Courier Prime", monospace)',
              fontSize: 10,
              color,
            }}>
              {value}
            </span>
          </div>
          <div style={{ height: 4, backgroundColor: 'rgba(42,36,32,0.06)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              width: `${fill}%`,
              height: '100%',
              backgroundColor: color,
              borderRadius: 2,
              transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}
