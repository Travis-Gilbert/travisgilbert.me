/**
 * Phase B: Leiden community pulse.
 *
 * Sequential community lighting. Top 6 communities by dot count pulse
 * bright in turn (150ms each), then decay to a baseline. Reads as
 * Theseus considering each region of the graph in sequence.
 */
import type { DotGridHandle } from '@/components/theseus/TheseusDotGrid';

const PULSE_DURATION_MS = 150;
const PULSE_OPACITY = 0.85;
const BASELINE_OPACITY = 0.45;
const MAX_COMMUNITIES = 6;

export function animateCommunityPulse(
  grid: DotGridHandle,
  communityAssignments: Record<string, number>,
  _pagerankScores: Record<string, number>,
  objectIdToDotIndex: Map<number, number>,
  prefersReducedMotion: boolean,
): () => void {
  // Group dot indices by community id.
  const byCommunity = new Map<number, number[]>();
  for (const [objIdStr, communityId] of Object.entries(communityAssignments)) {
    const objId = parseInt(objIdStr, 10);
    if (!Number.isFinite(objId)) continue;
    const dotIdx = objectIdToDotIndex.get(objId);
    if (dotIdx === undefined) continue;
    let bucket = byCommunity.get(communityId);
    if (!bucket) {
      bucket = [];
      byCommunity.set(communityId, bucket);
    }
    bucket.push(dotIdx);
  }

  // Score each community by dot count, pick top N.
  const scored = Array.from(byCommunity.entries()).map(([id, dots]) => ({ id, dots, score: dots.length }));
  scored.sort((a, b) => b.score - a.score);
  const topCommunities = scored.slice(0, MAX_COMMUNITIES);
  if (topCommunities.length === 0) return () => {};

  if (prefersReducedMotion) {
    for (const { dots } of topCommunities) {
      for (const idx of dots) {
        grid.setDotGalaxyState(idx, { opacityOverride: BASELINE_OPACITY });
      }
    }
    grid.wakeAnimation();
    return () => {};
  }

  let cancelled = false;
  const timers: number[] = [];

  topCommunities.forEach(({ dots }, i) => {
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      for (const idx of dots) {
        grid.setDotGalaxyState(idx, { opacityOverride: PULSE_OPACITY });
      }
      grid.wakeAnimation();
      const decayTimer = window.setTimeout(() => {
        if (cancelled) return;
        for (const idx of dots) {
          grid.setDotGalaxyState(idx, { opacityOverride: BASELINE_OPACITY });
        }
        grid.wakeAnimation();
      }, PULSE_DURATION_MS);
      timers.push(decayTimer);
    }, i * PULSE_DURATION_MS);
    timers.push(startTimer);
  });

  return () => {
    cancelled = true;
    for (const id of timers) window.clearTimeout(id);
  };
}
