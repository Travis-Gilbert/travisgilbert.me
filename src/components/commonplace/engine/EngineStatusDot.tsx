'use client';

import type { EngineStatus } from '@/lib/commonplace-models';

interface EngineStatusDotProps {
  status: EngineStatus;
}

const STATUS_COLORS: Record<EngineStatus, string> = {
  idle: '#2E8A3E',
  recalculating: '#D4944A',
  error: '#C44A4A',
};

export default function EngineStatusDot({ status }: EngineStatusDotProps) {
  const color = STATUS_COLORS[status];
  const isPulsing = status === 'recalculating';

  return (
    <span
      role="status"
      aria-label={
        status === 'idle'
          ? 'Engine ready'
          : status === 'recalculating'
            ? 'Engine recalculating'
            : 'Engine unavailable'
      }
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        animation: isPulsing ? 'engine-pulse 1.2s ease-in-out infinite' : undefined,
        flexShrink: 0,
      }}
    />
  );
}
