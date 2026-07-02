'use client';

import { cn } from '@/lib/utils';
import styles from './WeaveSpinner.module.css';

export function WeaveSpinner({
  className,
  size = 'default',
}: {
  className?: string;
  size?: 'default' | 'compact';
}) {
  return (
    <div
      className={cn(styles.wrapper, size === 'compact' && styles.compact, className)}
      role="status"
      aria-label="Thinking"
    >
      <div className={styles.container}>
        <div className={cn(styles.thread, styles.t1)} />
        <div className={cn(styles.thread, styles.t2)} />
        <div className={cn(styles.thread, styles.t3)} />
        <div className={cn(styles.thread, styles.t4)} />
        <div className={styles.node} />
      </div>
    </div>
  );
}
