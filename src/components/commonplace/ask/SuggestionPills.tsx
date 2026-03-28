'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { AskSuggestion } from '@/lib/ask-theseus';
import styles from './SuggestionPills.module.css';

interface SuggestionPillsProps {
  suggestions: AskSuggestion[];
  onSelect: (text: string) => void;
}

export default function SuggestionPills({ suggestions, onSelect }: SuggestionPillsProps) {
  const reduced = useReducedMotion();

  if (!suggestions.length) return null;

  return (
    <div className={styles.pills}>
      {suggestions.map((s, i) => (
        <motion.button
          key={s.text}
          className={styles.pill}
          onClick={() => onSelect(s.text)}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.3, delay: i * 0.06 }}
        >
          <span className={styles.prefix}>{s.type === 'tension' ? '!' : '?'}</span>
          {s.text}
        </motion.button>
      ))}
    </div>
  );
}
