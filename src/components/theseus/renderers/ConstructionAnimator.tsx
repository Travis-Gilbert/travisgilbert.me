'use client';

import { useEffect } from 'react';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { ConstructionPlayback, PhaseName } from './rendering';

interface ConstructionAnimatorProps {
  construction: SceneDirective['construction'];
  onUpdate: (playback: ConstructionPlayback) => void;
  onComplete?: () => void;
}

const PHASE_NAMES: PhaseName[] = [
  'focal_nodes_appear',
  'supporting_nodes_appear',
  'edges_draw',
  'clusters_coalesce',
  'data_builds',
  'labels_fade_in',
  'crystallize',
];

function emptyPlayback(totalMs: number): ConstructionPlayback {
  return {
    elapsedMs: 0,
    totalMs,
    phaseProgress: {
      focal_nodes_appear: 0,
      supporting_nodes_appear: 0,
      edges_draw: 0,
      clusters_coalesce: 0,
      data_builds: 0,
      labels_fade_in: 0,
      crystallize: 0,
    },
    isComplete: false,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export default function ConstructionAnimator({
  construction,
  onUpdate,
  onComplete,
}: ConstructionAnimatorProps) {
  useEffect(() => {
    let rafId = 0;
    let completed = false;
    const totalMs = Math.max(
      construction.total_duration_ms,
      ...construction.phases.map((phase) => phase.delay_ms + phase.duration_ms),
      0,
    );
    const start = performance.now();

    onUpdate(emptyPlayback(totalMs));

    const tick = (now: number) => {
      const elapsedMs = now - start;
      const phaseProgress = emptyPlayback(totalMs).phaseProgress;

      PHASE_NAMES.forEach((phaseName) => {
        const phase = construction.phases.find((candidate) => candidate.name === phaseName);
        if (!phase) {
          phaseProgress[phaseName] = phaseName === 'data_builds' ? 0 : 1;
          return;
        }

        const localElapsed = elapsedMs - phase.delay_ms;
        phaseProgress[phaseName] = clamp(localElapsed / Math.max(phase.duration_ms, 1));
      });

      const playback: ConstructionPlayback = {
        elapsedMs,
        totalMs,
        phaseProgress,
        isComplete: elapsedMs >= totalMs,
      };

      onUpdate(playback);

      if (elapsedMs < totalMs) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (!completed) {
        completed = true;
        onComplete?.();
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [construction, onComplete, onUpdate]);

  return null;
}
