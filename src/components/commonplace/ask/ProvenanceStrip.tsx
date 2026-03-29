'use client';

import styles from './ProvenanceStrip.module.css';

interface ProvenanceStripProps {
  engines: string[];
  objectCount: number;
  claimCount: number;
}

export default function ProvenanceStrip({ engines, objectCount, claimCount }: ProvenanceStripProps) {
  return (
    <div className={styles.strip}>
      <span className={styles.label}>Engines</span>
      {engines.map((e) => (
        <span key={e} className={styles.badge}>{e}</span>
      ))}
      <span className={styles.counts}>
        {objectCount} objects, {claimCount} claims
      </span>
    </div>
  );
}
