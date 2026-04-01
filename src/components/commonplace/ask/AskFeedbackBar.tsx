'use client';

import { useState, useCallback } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { submitFeedback } from '@/lib/ask-theseus';
import type { AskFeedbackSignal } from '@/lib/ask-theseus';
import ProblemSolvingStrip from './ProblemSolvingStrip';
import styles from './AskFeedbackBar.module.css';

const SPRING_SNAPPY = { stiffness: 400, damping: 30 };

interface AskFeedbackBarProps {
  questionId: string;
  retrievedObjectIds: number[];
  onFeedback?: (signal: AskFeedbackSignal) => void;
  disabled?: boolean;
}

export default function AskFeedbackBar({
  questionId,
  retrievedObjectIds,
  onFeedback,
  disabled,
}: AskFeedbackBarProps) {
  const reduced = useReducedMotion();
  const [vote, setVote] = useState<'positive' | 'negative' | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleVote = useCallback(async (signal: 'positive' | 'negative') => {
    if (disabled) return;
    const next = vote === signal ? null : signal;
    setVote(next);
    if (next) {
      submitFeedback(questionId, next, retrievedObjectIds).catch(() => {});
      onFeedback?.(next);
    }
  }, [vote, disabled, questionId, retrievedObjectIds, onFeedback]);

  const handleSave = useCallback(async () => {
    if (disabled || saving || saved) return;
    setSaving(true);
    try {
      await submitFeedback(questionId, 'save', retrievedObjectIds);
      setSaved(true);
      onFeedback?.('save');
    } catch {
      setSaving(false);
    }
  }, [disabled, saving, saved, questionId, retrievedObjectIds, onFeedback]);

  if (saved) {
    return (
      <motion.div
        className={styles.savedMsg}
        initial={reduced ? false : { opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.25 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline
            points="20 6 9 17 4 12"
            className={styles.chkPath}
          />
        </svg>
        Saved as object. Training signal recorded for {retrievedObjectIds.length} retrieved objects.
      </motion.div>
    );
  }

  return (
    <div>
      <motion.div
        className={styles.bar}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.3, delay: 0.3 }}
      >
        {/* Thumbs down */}
        <motion.button
          className={`${styles.btn} ${vote === 'negative' ? styles.downOn : ''}`}
          onClick={() => handleVote('negative')}
          disabled={disabled}
          whileTap={reduced ? {} : { scale: 0.9 }}
          transition={SPRING_SNAPPY}
          aria-label="Thumbs down"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
          </svg>
        </motion.button>

        {/* Thumbs up */}
        <motion.button
          className={`${styles.btn} ${vote === 'positive' ? styles.upOn : ''}`}
          onClick={() => handleVote('positive')}
          disabled={disabled}
          whileTap={reduced ? {} : { scale: 0.9 }}
          transition={SPRING_SNAPPY}
          aria-label="Thumbs up"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        </motion.button>

        <span className={styles.spacer} />

        {/* Save */}
        <motion.button
          className={`${styles.btn} ${styles.save}`}
          onClick={handleSave}
          disabled={disabled || saving}
          whileTap={reduced ? {} : { scale: 0.9 }}
          transition={SPRING_SNAPPY}
          aria-label="Save answer as object"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {saving ? 'Saving...' : 'Save'}
        </motion.button>
      </motion.div>

      <ProblemSolvingStrip
        questionId={questionId}
        retrievedObjectIds={retrievedObjectIds}
        disabled={disabled}
        styles={styles}
      />
    </div>
  );
}
