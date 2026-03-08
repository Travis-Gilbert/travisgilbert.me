'use client';

import { useEffect, useState, useCallback } from 'react';

interface StageStampProps {
  stage: string;
  stageColor: string;
  onComplete: () => void;
}

/**
 * Wax-seal stamp animation that plays when content advances to a new stage.
 *
 * Three phases: stamp press (0.3s scale-in), settle wobble (0.4s rotation),
 * fade out (0.5s). Total duration 1.2s. SVG circle with textPath rim text
 * modeled after DocumentStamp pattern.
 */
export default function StageStamp({ stage, stageColor, onComplete }: StageStampProps) {
  const [phase, setPhase] = useState<'stamp' | 'settle' | 'fade'>('stamp');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('settle'), 300);
    const t2 = setTimeout(() => setPhase('fade'), 700);
    const t3 = setTimeout(onComplete, 1200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  const rimText = `${stage.toUpperCase()} \u2022 `.repeat(4);

  return (
    <div className={`stage-stamp stage-stamp--${phase}`}>
      <svg viewBox="0 0 80 80" width="80" height="80">
        <defs>
          <path
            id="stamp-rim"
            d="M40,6 a34,34 0 1,1 0,68 a34,34 0 1,1 0,-68"
          />
        </defs>
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke={stageColor}
          strokeWidth="2"
          strokeDasharray="4 3"
          opacity="0.7"
        />
        <text
          fontSize="6"
          fill={stageColor}
          fontFamily="var(--studio-font-mono)"
          letterSpacing="0.12em"
        >
          <textPath href="#stamp-rim">{rimText}</textPath>
        </text>
        <circle cx="40" cy="40" r="4" fill={stageColor} opacity="0.6" />
      </svg>
    </div>
  );
}

/**
 * Hook to manage stamp visibility. Returns the current stamp props
 * (or null) and a trigger function.
 */
export function useStageStamp() {
  const [stamp, setStamp] = useState<{
    stage: string;
    color: string;
  } | null>(null);

  const trigger = useCallback((stage: string, color: string) => {
    setStamp({ stage, color });
  }, []);

  const clear = useCallback(() => setStamp(null), []);

  return { stamp, trigger, clear };
}
