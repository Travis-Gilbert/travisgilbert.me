'use client';

import type { MouseEvent } from 'react';
import styles from '@/app/(spacetime)/spacetime/spacetime.module.css';
import { COLOR_TOPIC_A, COLOR_TOPIC_B, type SpacetimeTopic } from '@/lib/spacetime/types';
import type { HoveredId } from './Globe';

interface TimelinePaneProps {
  topicA: SpacetimeTopic | null;
  topicB: SpacetimeTopic | null;
  /** [min, max] of the combined span across both topics. */
  tlMin: number;
  tlMax: number;
  /** Current playhead year. */
  year: number;
  prehistory: boolean;
  paused: boolean;
  hovered: HoveredId | null;
  onHover: (h: HoveredId | null) => void;
  onScrub: (year: number) => void;
  onTogglePause: () => void;
  /** Hint shown below the timeline (varies by single vs compare mode). */
  hint: string;
}

export default function TimelinePane({
  topicA,
  topicB,
  tlMin,
  tlMax,
  year,
  prehistory,
  paused,
  hovered,
  onHover,
  onScrub,
  onTogglePause,
  hint,
}: TimelinePaneProps) {
  const playheadPct = ((year - tlMin) / (tlMax - tlMin)) * 100;
  const formatYear = (y: number) =>
    prehistory ? `${Math.abs(y).toFixed(2)} Mya` : String(Math.round(y));

  function handleScrub(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const f = Math.max(0, Math.min(1, x / rect.width));
    const v = tlMin + f * (tlMax - tlMin);
    onScrub(prehistory ? Math.round(v * 100) / 100 : Math.round(v));
  }

  return (
    <div className={styles.timelinePane}>
      <div className={styles.timelineMeta}>
        <span>{prehistory ? `${Math.abs(tlMin)} Mya` : tlMin}</span>
        <span className={styles.nowReadout}>
          <button
            type="button"
            className={styles.playBtn}
            onClick={onTogglePause}
            aria-label="Play / Pause"
          >
            {paused ? '▶' : '❚❚'}
          </button>
          {formatYear(year)}
        </span>
        <span>{prehistory ? `${Math.abs(tlMax)} Mya` : tlMax}</span>
      </div>
      <div
        className={styles.timelineTrack}
        onMouseDown={handleScrub}
        onMouseMove={e => {
          if (e.buttons === 1) handleScrub(e);
        }}
      >
        <div className={styles.trackLine} />
        <div className={styles.ticks}>
          {Array.from({ length: 11 }).map((_, i) => (
            <span
              key={i}
              className={`${styles.tick} ${i % 5 === 0 ? styles.tickMajor : ''}`}
            />
          ))}
        </div>

        {/* Topic A event ticks (above line) */}
        {topicA?.events.map(ev => {
          const f = (ev.year - tlMin) / (tlMax - tlMin);
          const isHov = hovered?.topic === 'A' && hovered?.id === ev.id;
          const isPast = ev.year <= year;
          return (
            <span
              key={`A${ev.id}`}
              className={`${styles.eventTick} ${isHov ? styles.eventTickHov : ''} ${isPast ? styles.eventTickPast : ''}`}
              style={{ left: `${f * 100}%`, background: COLOR_TOPIC_A, top: 6 }}
              onMouseEnter={() => onHover({ topic: 'A', id: ev.id })}
              onMouseLeave={() => onHover(null)}
            >
              <span
                className={styles.eventTickLabel}
                style={{ color: COLOR_TOPIC_A, top: -16 }}
              >
                {ev.city}
              </span>
            </span>
          );
        })}

        {/* Topic B event ticks (below line) */}
        {topicB?.events.map(ev => {
          const f = (ev.year - tlMin) / (tlMax - tlMin);
          const isHov = hovered?.topic === 'B' && hovered?.id === ev.id;
          const isPast = ev.year <= year;
          return (
            <span
              key={`B${ev.id}`}
              className={`${styles.eventTick} ${isHov ? styles.eventTickHov : ''} ${isPast ? styles.eventTickPast : ''}`}
              style={{ left: `${f * 100}%`, background: COLOR_TOPIC_B, top: 32 }}
              onMouseEnter={() => onHover({ topic: 'B', id: ev.id })}
              onMouseLeave={() => onHover(null)}
            >
              <span
                className={styles.eventTickLabel}
                style={{ color: COLOR_TOPIC_B, top: 22 }}
              >
                {ev.city}
              </span>
            </span>
          );
        })}

        <div
          className={styles.playhead}
          style={{ left: `calc(${playheadPct}% - 1px)` }}
        >
          <div className={styles.playheadKnob} />
          <div className={styles.playheadLabel}>{formatYear(year)}</div>
        </div>
      </div>
      <div className={styles.timelineHint}>{hint}</div>
    </div>
  );
}
