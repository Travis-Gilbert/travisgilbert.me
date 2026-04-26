'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import rough from 'roughjs';
import styles from '@/app/(spacetime)/spacetime/spacetime.module.css';
import type { SpacetimeTopic } from '@/lib/spacetime/types';

interface SearchRowProps {
  topicA: SpacetimeTopic | null;
  topicB: SpacetimeTopic | null;
  /** True once the user clicks "+ Compare another topic" but before the
   *  second topic has loaded. Lets the second search input render
   *  immediately rather than waiting on the network. */
  compareEnabled?: boolean;
  onSubmitA: (query: string) => void;
  onSubmitB: (query: string) => void;
  onAddCompare: () => void;
  onRemoveB: () => void;
}

interface SketchedSearchProps {
  seed: number;
  /** Hand-drawn outline color. */
  stroke: string;
  className?: string;
  children: React.ReactNode;
  onSubmit: (e: FormEvent) => void;
}

/**
 * Search box with the same hand-drawn instrument language as the info
 * cards: rough.js outline, semi-transparent terracotta wash, backdrop
 * blur. Used for both Topic A and Topic B inputs.
 */
function SketchedSearch({ seed, stroke, className = '', children, onSubmit }: SketchedSearchProps) {
  const containerRef = useRef<HTMLFormElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.min(rect.width, 8192));
      const h = Math.max(1, Math.min(rect.height, 8192));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const rc = rough.canvas(canvas);
      rc.rectangle(2, 2, w - 4, h - 4, {
        roughness: 0.7,
        bowing: 0.7,
        strokeWidth: 1.2,
        stroke,
        seed,
      });
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [seed, stroke]);

  return (
    <form ref={containerRef} className={`${styles.searchBox} ${className}`} onSubmit={onSubmit}>
      <canvas ref={canvasRef} aria-hidden className={styles.searchBoxCanvas} />
      <div className={styles.searchBoxInner}>{children}</div>
    </form>
  );
}

/**
 * Search row pinned below the globe. Topic A always present; Topic B
 * appears as either an "add compare" button (single mode) or a second
 * search input with a remove `×` (compare mode).
 */
export default function SearchRow({
  topicA,
  topicB,
  compareEnabled = false,
  onSubmitA,
  onSubmitB,
  onAddCompare,
  onRemoveB,
}: SearchRowProps) {
  const [queryA, setQueryA] = useState('');
  const [queryB, setQueryB] = useState('');

  // Render the second input as soon as the user clicks "+ Compare another
  // topic" (compareEnabled), even before topicB resolves over the network.
  const compareMode = !!topicB || compareEnabled;

  function handleA(e: FormEvent) {
    e.preventDefault();
    onSubmitA(queryA);
    setQueryA('');
  }
  function handleB(e: FormEvent) {
    e.preventDefault();
    onSubmitB(queryB);
    setQueryB('');
  }

  return (
    <>
      <div
        className={styles.searchRow}
        data-cmp-style="Solid"
      >
        <SketchedSearch seed={29} stroke="#9A4A22" onSubmit={handleA}>
          <input
            type="text"
            value={queryA}
            onChange={e => setQueryA(e.target.value)}
            placeholder={topicA?.title || 'Search a topic'}
          />
          <span className={styles.kbd}>⏎</span>
        </SketchedSearch>

        {!compareMode ? (
          <button type="button" className={styles.addCompare} onClick={onAddCompare}>
            <span className={styles.plus}>＋</span>
            Compare another topic
          </button>
        ) : (
          <SketchedSearch seed={53} stroke="#1F4148" className={styles.compare} onSubmit={handleB}>
            <input
              type="text"
              value={queryB}
              onChange={e => setQueryB(e.target.value)}
              placeholder={topicB?.title || 'Search a second topic'}
            />
            <button
              type="button"
              className={styles.closeB}
              onClick={onRemoveB}
              aria-label="Remove topic B"
            >
              ×
            </button>
          </SketchedSearch>
        )}
      </div>
    </>
  );
}
