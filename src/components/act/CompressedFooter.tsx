'use client';

/**
 * CompressedFooter
 *
 * Absorbs the page's Specifications section into the footer band so
 * the page body can stay focused on intake → graph → axes → outcome.
 *
 * Layered structure (top to bottom):
 *   1. Specifications strip — 8 key/value rows in 4 columns. Same
 *      semantic content as the in-body Specifications table the
 *      Retro Lab design previously rendered as its own section.
 *   2. Wave bars — animated rule of vertical bars (subtle), adapted
 *      from Index-API/Theseus/Design Components/Footer.md. Bars are
 *      static unless the section is in view AND the user has not set
 *      prefers-reduced-motion. Implemented with framer-motion?
 *      No — kept as plain CSS keyframes with IntersectionObserver,
 *      so the page does not pull in motion-heavy dependencies.
 *   3. Colophon row — Travis Gilbert · Anti-Conspiracy Theorem ·
 *      version | Built on Theorem | Fig. 04 · date.
 *
 * Inputs the footer needs:
 *   - The 8 specifications (algorithm version, extractor state, etc.)
 *   - The today date label for Fig. 04
 *   - The model card href
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import styles from './CompressedFooter.module.css';
import type { LoadProgress, RunnerState } from '@/lib/act';

/* `useSyncExternalStore` is the correct primitive for reading a live
   media query: a single subscription + snapshot pair, no synchronous
   `setState` inside `useEffect`. The SSR fallback returns `false` so
   the server renders the animation-on path; hydration then settles to
   the user's actual preference. */
const subscribeReducedMotion = (cb: () => void) => {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};
const getReducedMotionSnapshot = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const getReducedMotionServerSnapshot = () => false;

interface CompressedFooterProps {
  algorithmVersion: string;
  modelState: RunnerState;
  modelProgress: LoadProgress;
  extractorLabel: string;
  modelRowLabel: React.ReactNode;
  inputsLabel: string;
  todayLabel: string;
}

const BAR_COUNT = 23;

export function CompressedFooter({
  algorithmVersion,
  extractorLabel,
  modelRowLabel,
  inputsLabel,
  todayLabel,
}: CompressedFooterProps) {
  const footerRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(false);

  /* Honor prefers-reduced-motion via the external-store pattern so the
     read stays synchronous with React's render and lint stays clean
     (no setState-in-effect). */
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  /* Only animate when the footer is in view. Static bars otherwise. */
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setIsInView(entry.isIntersecting);
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const barsAnimated = isInView && !reducedMotion;

  return (
    <footer ref={footerRef} className={styles.footer}>
      {/* Specifications strip (absorbed from the body section) */}
      <section className={styles.specs} aria-label="Specifications">
        <h4 className={styles.specsHead}>Specifications</h4>
        <div className={styles.specsGrid}>
          <div className={styles.row}><span className={styles.k}>Process</span><span className={styles.v}>Instrument · open lab</span></div>
          <div className={styles.row}><span className={styles.k}>Algorithm</span><span className={styles.v}>ACC v{algorithmVersion} · structural + calibrated</span></div>
          <div className={styles.row}><span className={styles.k}>Extractor</span><span className={styles.v}>{extractorLabel}</span></div>
          <div className={styles.row}><span className={styles.k}>Inputs</span><span className={styles.v}>{inputsLabel}</span></div>
          <div className={styles.row}><span className={styles.k}>Method</span><span className={styles.v}>11 axes · weighted aggregate</span></div>
          <div className={styles.row}><span className={styles.k}>Model</span><span className={styles.v}>{modelRowLabel}</span></div>
          <div className={styles.row}><span className={styles.k}>License</span><span className={styles.v}>MIT · weights open</span></div>
          <div className={styles.row}>
            <span className={styles.k}>Status</span>
            <span className={styles.v}>
              <span className={`${styles.dot} ${styles.dotLive}`} />
              Live · accepting documents
            </span>
          </div>
        </div>
      </section>

      {/* Wave bars (subtle, animate only when in view + motion-OK) */}
      <div
        className={styles.waveRow}
        aria-hidden="true"
        data-animated={barsAnimated || undefined}
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            className={styles.bar}
            style={{ animationDelay: `${i * 0.06}s` }}
          />
        ))}
      </div>

      {/* Colophon row */}
      <div className={styles.colophon}>
        <div className={styles.left}>Travis Gilbert · Anti-Conspiracy Theorem · v0.4.2</div>
        <div className={styles.center}>Built on Theorem</div>
        <div className={styles.right}>Fig. 04 · {todayLabel}</div>
      </div>
    </footer>
  );
}
