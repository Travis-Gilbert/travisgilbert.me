'use client';

import { useEffect, useState } from 'react';
import type { OrganizeTimeframe } from '@/lib/commonplace-graphql';

interface DailyProgressProps {
  done: number;
  total: number;
  timeframe: OrganizeTimeframe;
  onTimeframeChange: (tf: OrganizeTimeframe) => void;
}

const FRAMES: { key: OrganizeTimeframe; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

/**
 * The persistent daily-progress component (spec D5). Shows completion, not time
 * elapsed: "4 of 7 done" with a teal fill, plus a Day/Week/Month toggle that
 * re-requests the snapshot. A completion bar measures agency; capping the
 * denominator at the timeframe's filed-vs-arrived keeps it reachable.
 */
export default function DailyProgress({ done, total, timeframe, onTimeframeChange }: DailyProgressProps) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setFill(pct), 150);
    return () => clearTimeout(t);
  }, [pct]);

  const mono = 'var(--font-metadata, "Courier Prime", monospace)';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cp-text-faint)' }}>
          Progress
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--cp-text-muted)' }}>
          {done} of {total} done
        </span>
      </div>

      <div style={{ height: 6, backgroundColor: 'rgba(42,36,32,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            width: `${fill}%`,
            height: '100%',
            backgroundColor: 'var(--cp-teal)',
            borderRadius: 3,
            transition: 'width 900ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
        {FRAMES.map(({ key, label }) => {
          const active = key === timeframe;
          return (
            <button
              key={key}
              onClick={() => onTimeframeChange(key)}
              style={{
                flex: 1,
                fontFamily: mono,
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                padding: '4px 0',
                borderRadius: 5,
                cursor: 'pointer',
                border: active
                  ? '1px solid color-mix(in srgb, var(--cp-teal) 35%, transparent)'
                  : '1px solid rgba(42,36,32,0.1)',
                backgroundColor: active ? 'color-mix(in srgb, var(--cp-teal) 10%, transparent)' : 'transparent',
                color: active ? 'var(--cp-teal)' : 'var(--cp-text-faint)',
                transition: 'background 150ms ease, color 150ms ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
