'use client';

import { useEffect, useState } from 'react';

/**
 * On successful save, a terracotta ink wash sweeps across the paper surface
 * from left to right, then fades. Uses mix-blend-mode: multiply to look like
 * ink bleeding into paper.
 *
 * Increment `trigger` to fire the animation. Duration: 0.9s.
 */
export default function InkSoakOverlay({
  trigger,
  stageColor = '#B45A2D',
}: {
  trigger: number;
  stageColor?: string;
}) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setPlaying(true);
    const t = setTimeout(() => setPlaying(false), 900);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!playing) return null;

  return (
    <div
      className="ink-soak-overlay"
      style={{ '--ink-color': stageColor } as React.CSSProperties}
    />
  );
}
