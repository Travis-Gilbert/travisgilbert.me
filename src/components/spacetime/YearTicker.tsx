'use client';

import styles from '@/app/(spacetime)/spacetime/spacetime.module.css';

interface YearTickerProps {
  year: number;
  era: string;
  prehistory: boolean;
}

/**
 * Massive faint year drifting behind everything. The era subtitle reads
 * `Million Years Ago` in prehistory mode, otherwise the named era band.
 */
export default function YearTicker({ year, era, prehistory }: YearTickerProps) {
  const display = prehistory ? Math.abs(year).toFixed(1) : String(year);
  return (
    <div className={styles.yearBg} aria-hidden>
      <div className={styles.yearNum}>{display}</div>
      <div className={styles.yearEra}>{prehistory ? 'Million Years Ago' : era}</div>
    </div>
  );
}
