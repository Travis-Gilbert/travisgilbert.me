'use client';

/**
 * DynamicIslandTOC
 *
 * Sticky pill anchored to the top of the viewport on /act. Reference:
 * https://21st.dev/community/components/digitalzone0707/dynamic-island-toc/default
 *
 * Roles, in order of priority:
 *   1. Always-on drop zone. A document file dragged anywhere over the
 *      window is captured here; the page no longer requires the user
 *      to find the analyzer well to drop a file.
 *   2. Loading indicator. After a drop, the island expands to show
 *      "PARSING <filename>" with a progress strip until analysis
 *      resolves.
 *   3. Condensed panel. When analysis has completed, the island shows
 *      the four readouts (average ACC + trustworthy/mixed/unreliable
 *      counts) in pill form, replacing the standalone readouts row in
 *      the body. The standalone readouts section is removed from the
 *      page; its content is owned here.
 *
 * State machine:
 *   idle           — empty page, no analysis
 *   dragOver       — user is dragging a file over the window
 *   loading        — analyzer is parsing
 *   loaded         — analysis available
 *
 * Drop handler delegates to the parent via `onDropFile(file)` so the
 * existing `analyzeDocument` pipeline owns the work.
 */

import { useEffect, useState } from 'react';
import styles from './DynamicIslandTOC.module.css';
import type { AnalysisResult } from '@/lib/act';
import { formatScore } from '@/lib/act';

type IslandStatus = 'idle' | 'reading' | 'scoring' | 'ready' | 'error';

interface DynamicIslandTOCProps {
  analysis: AnalysisResult | null;
  status: IslandStatus;
  message: string;
  onDropFile: (file: File) => void;
}

export function DynamicIslandTOC({
  analysis,
  status,
  message,
  onDropFile,
}: DynamicIslandTOCProps) {
  const [isDraggingWindow, setIsDraggingWindow] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  /* Window-wide drag listener. The island is the page's drop zone, so
     drag events are tracked at the window level, not at a specific
     element. Counter handling avoids the flicker that crossing a
     child boundary would otherwise cause. */
  useEffect(() => {
    const onEnter = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      setDragCounter((c) => c + 1);
      setIsDraggingWindow(true);
    };
    const onLeave = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      setDragCounter((c) => {
        const next = Math.max(0, c - 1);
        if (next === 0) setIsDraggingWindow(false);
        return next;
      });
    };
    const onDragOver = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types?.includes('Files')) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      }
    };
    const onDrop = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      setDragCounter(0);
      setIsDraggingWindow(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onDropFile(file);
    };

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [onDropFile]);

  // Pick the active state.
  let activeState: 'idle' | 'dragOver' | 'loading' | 'loaded';
  if (isDraggingWindow) {
    activeState = 'dragOver';
  } else if (status === 'reading' || status === 'scoring') {
    activeState = 'loading';
  } else if (analysis) {
    activeState = 'loaded';
  } else {
    activeState = 'idle';
  }

  return (
    <div
      className={`${styles.island} ${styles[`state_${activeState}`]}`}
      role="status"
      aria-live="polite"
      aria-label="Document analyzer status"
    >
      {activeState === 'idle' && (
        <span className={styles.idle}>
          <span className={styles.led} aria-hidden />
          <span>Drop a document anywhere to inspect</span>
          <span className={styles.glyph} aria-hidden>⇣</span>
        </span>
      )}

      {activeState === 'dragOver' && (
        <span className={styles.dragOver}>
          <span className={styles.glyphLarge} aria-hidden>⇣</span>
          <span className={styles.dropLabel}>Drop to inspect</span>
        </span>
      )}

      {activeState === 'loading' && (
        <span className={styles.loading}>
          <span className={styles.progressBar} aria-hidden>
            <span className={styles.progressFill} />
          </span>
          <span className={styles.loadingLabel}>{message || 'Parsing'}</span>
        </span>
      )}

      {activeState === 'loaded' && analysis && (
        <span className={styles.loaded}>
          <span className={styles.cell}>
            <span className={styles.glyph}>Σ</span>
            <span className={styles.value}>{formatScore(analysis.overall_score)}</span>
            <span className={styles.label}>ACC</span>
          </span>
          <span className={styles.divider} aria-hidden />
          <span className={styles.cell}>
            <span className={styles.glyph}>↑</span>
            <span className={styles.value}>{analysis.trustworthy_count}</span>
            <span className={styles.label}>trust</span>
          </span>
          <span className={styles.divider} aria-hidden />
          <span className={styles.cell}>
            <span className={styles.glyph}>~</span>
            <span className={styles.value}>{analysis.mixed_count}</span>
            <span className={styles.label}>mixed</span>
          </span>
          <span className={styles.divider} aria-hidden />
          <span className={`${styles.cell} ${styles.cellUnreliable}`}>
            <span className={styles.glyph}>!</span>
            <span className={styles.value}>{analysis.unreliable_count}</span>
            <span className={styles.label}>unrel</span>
          </span>
        </span>
      )}
    </div>
  );
}
