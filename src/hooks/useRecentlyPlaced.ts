import { useState, useEffect, useMemo } from 'react';

/**
 * Returns a CSS class name for the glow phase:
 * 'board-glow-strong' (0 to 5s), 'board-glow-medium' (5 to 15s),
 * 'board-glow-fade' (15 to 30s), or null (after 30s).
 */

function getPhase(ms: number): string | null {
  if (ms < 5_000) return 'board-glow-strong';
  if (ms < 15_000) return 'board-glow-medium';
  if (ms < 30_000) return 'board-glow-fade';
  return null;
}

export function useRecentlyPlaced(placedAt: number | null): string | null {
  const initialPhase = useMemo(() => {
    if (!placedAt) return null;
    const elapsed = Date.now() - placedAt;
    return getPhase(elapsed);
  }, [placedAt]);

  const [phase, setPhase] = useState<string | null>(initialPhase);

  // Sync state when placedAt changes
  useEffect(() => {
    if (!placedAt) return;
    const elapsed = Date.now() - placedAt;
    if (elapsed >= 30_000) return;

    const interval = setInterval(() => {
      const now = Date.now() - placedAt;
      const next = getPhase(now);
      setPhase(next);
      if (!next) clearInterval(interval);
    }, 1_000);

    return () => clearInterval(interval);
  }, [placedAt]);

  // Reset when placedAt clears
  useEffect(() => {
    if (!placedAt) setPhase(null);
  }, [placedAt]);

  return phase;
}
