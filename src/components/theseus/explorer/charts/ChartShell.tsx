'use client';

// Phase C chart shell.
//
// Every Explorer chart follows the same lifecycle:
//   1. await initMosaicCoordinator()       (DuckDB + Coordinator wired)
//   2. probe DuckDB for the backing column  (honest empty-state per project
//      CLAUDE.md: no fake bins, no mock data when the backend has not
//      populated the field yet)
//   3. build the vgplot spec                (returns a DOM element)
//   4. mount the element into a ref         (vgplot is imperative; React
//      owns the host div, vgplot owns the children)
//   5. on unmount, replaceChildren([])      (drop the plot element so
//      Mosaic can free its client; Selection clauses are keyed on the
//      mark/interactor so they disappear with the element)
//
// Size policy: each chart is a fixed-height strip. The width stretches to
// fill the flex column. vgplot measures on mount; if the container width
// is 0 at mount time we retry via ResizeObserver until it stabilises.
//
// Error policy: if the probe SQL throws (column missing, DuckDB not ready,
// etc.) we log once and render the empty-state body. We never crash the
// Explorer canvas from a chart failure.

import { useEffect, useRef, useState } from 'react';
import type { FC, ReactNode } from 'react';
import { initMosaicCoordinator } from '@/lib/theseus/mosaic/coordinator';
import { whenExplorerIngested, getLastIngestInfo } from '@/lib/theseus/mosaic/ingestExplorerData';
import { getSharedDuckDB } from '@/lib/theseus/cosmograph/duckdb';
import { onTheseusEvent } from '@/lib/theseus/events';

export type ChartProbeStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface ChartShellProps {
  /** Stable label for dev logs. Not rendered. */
  label: string;
  /** Pixel height of the chart strip (title + plot). Width is always 100%. */
  height: number;
  /** Honest empty-state copy shown when the probe finds zero non-null rows. */
  emptyCopy: string;
  /** SQL that returns a single row with a non-zero count when data is present.
   *  Example: `SELECT COUNT(*) AS n FROM objects WHERE captured_at IS NOT NULL`.
   *  The first column of the first row is coerced to Number and compared to 0. */
  probeSql: string;
  /** Build the vgplot spec. Called only after the probe reports data. Must
   *  return a DOM element (what `plot(...)` returns). Runs on the client. */
  buildPlot: () => Promise<HTMLElement | SVGElement>;
  /** Optional small heading rendered above the plot. */
  title?: ReactNode;
}

/** Internal: run the probe and return 'empty' / 'ready' / 'error'. */
async function runProbe(sql: string): Promise<Extract<ChartProbeStatus, 'ready' | 'empty' | 'error'>> {
  try {
    const { connection } = await getSharedDuckDB();
    const table = await connection.query(sql);
    if (table.numRows === 0) return 'empty';
    const col = table.getChildAt(0);
    if (!col) return 'empty';
    const raw = col.get(0);
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 'empty';
    return 'ready';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[ChartShell] probe failed', err);
    return 'error';
  }
}

const ChartShell: FC<ChartShellProps> = ({
  label,
  height,
  emptyCopy,
  probeSql,
  buildPlot,
  title,
}) => {
  const plotHostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<ChartProbeStatus>('loading');
  // Bumps each time `explorer:ingest-complete` fires. Charts re-run their
  // probe + build against the fresh tables. Starts at the most recent
  // ingest generation so a chart mounted mid-session picks up the current
  // data on first render without waiting for another event.
  const [ingestGen, setIngestGen] = useState<number>(() => getLastIngestInfo()?.generation ?? 0);

  useEffect(() => {
    return onTheseusEvent('explorer:ingest-complete', ({ generation }) => {
      setIngestGen(generation);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initMosaicCoordinator();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[ChartShell:${label}] coordinator init failed`, err);
        if (!cancelled) setStatus('error');
        return;
      }
      if (cancelled) return;

      // Wait for the Explorer to finish loading the DuckDB tables before
      // probing row counts. Without this gate, the chart's probe SQL races
      // the shell's ingest and fails with "Table does not exist".
      try {
        await whenExplorerIngested();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[ChartShell:${label}] ingest wait failed`, err);
        if (!cancelled) setStatus('error');
        return;
      }
      if (cancelled) return;

      setStatus('loading');
      const probe = await runProbe(probeSql);
      if (cancelled) return;
      if (probe !== 'ready') {
        setStatus(probe);
        return;
      }

      let element: HTMLElement | SVGElement;
      try {
        element = await buildPlot();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[ChartShell:${label}] buildPlot failed`, err);
        if (!cancelled) setStatus('error');
        return;
      }
      if (cancelled) return;
      const host = plotHostRef.current;
      if (!host) return;
      // vgplot's returned element honors its own width(...) config; wrap
      // in a stretching div so the host container's flex space is used.
      const wrap = document.createElement('div');
      wrap.style.cssText = 'width:100%;height:100%;display:block';
      wrap.appendChild(element);
      host.replaceChildren(wrap);
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
      // Drop the plot element so Mosaic frees its client + any interactor
      // clauses on the bound Selections clear via the interactor's dispose
      // path. The Selection singletons themselves keep their other clauses.
      const host = plotHostRef.current;
      if (host) host.replaceChildren();
    };
  }, [label, probeSql, buildPlot, ingestGen]);

  return (
    <div
      aria-label={label}
      style={{
        height,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px 10px 4px 10px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-hero-text)',
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-hero-text-muted)',
            lineHeight: 1.3,
          }}
        >
          {title}
        </div>
      )}
      <div
        ref={plotHostRef}
        style={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: status === 'ready' ? 'block' : 'none',
        }}
      />
      {status === 'loading' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--color-hero-text-muted)',
          }}
        >
          Loading
        </div>
      )}
      {status === 'empty' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            letterSpacing: '0.06em',
            textAlign: 'center',
            color: 'var(--color-hero-text-muted)',
            padding: '0 8px',
          }}
        >
          {emptyCopy}
        </div>
      )}
      {status === 'error' && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--vie-error, var(--color-error))',
          }}
        >
          Chart unavailable
        </div>
      )}
    </div>
  );
};

export default ChartShell;
