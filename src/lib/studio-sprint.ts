export type SprintState = 'idle' | 'running' | 'paused' | 'done';

export interface Sprint {
  state: SprintState;
  durationMs: number;
  elapsedMs: number;
  startWords: number;
  wordsWritten: number;
}

export const SPRINT_PRESETS = [
  { label: '15m', ms: 15 * 60_000 },
  { label: '25m', ms: 25 * 60_000 },
  { label: '45m', ms: 45 * 60_000 },
] as const;

export function formatSprintTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
