'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { AskRetrievalObject } from '@/lib/ask-theseus';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import styles from './AskRetrievalStrip.module.css';

interface AskRetrievalStripProps {
  objects: AskRetrievalObject[];
}

export default function AskRetrievalStrip({ objects }: AskRetrievalStripProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={styles.retrieval}
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.3 }}
    >
      <div className={styles.head}>
        <span className={styles.pulse} />
        <span className={styles.label}>retrieving from graph</span>
      </div>
      <div className={styles.chips}>
        {objects.map((obj, i) => {
          const identity = getObjectTypeIdentity(obj.object_type_slug);
          return (
            <motion.div
              key={obj.id}
              className={styles.chip}
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? { duration: 0 } : { duration: 0.3, delay: i * 0.08 }}
            >
              <span
                className={styles.dot}
                style={{ background: identity.color }}
              />
              <span className={styles.chipTitle}>{obj.title}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
