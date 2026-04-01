'use client';

import { useState, useCallback } from 'react';
import { submitProblemSolvingFeedback } from '@/lib/ask-theseus';
import type { ProblemSolvingSignal } from '@/lib/ask-theseus';

interface ProblemSolvingStripProps {
  questionId: string;
  retrievedObjectIds: number[];
  disabled?: boolean;
  styles: Record<string, string>;
}

const CONFIRMATIONS: Record<ProblemSolvingSignal, string> = {
  solved: 'Great! Signal recorded.',
  somewhat: 'Noted. Signal recorded.',
  not_helpful: "Noted. We'll improve.",
};

export default function ProblemSolvingStrip({
  questionId,
  retrievedObjectIds,
  disabled,
  styles,
}: ProblemSolvingStripProps) {
  const [signal, setSignal] = useState<ProblemSolvingSignal | null>(null);

  const handleSignal = useCallback(
    (s: ProblemSolvingSignal) => {
      if (disabled || signal) return;
      setSignal(s);
      submitProblemSolvingFeedback(questionId, s, retrievedObjectIds).catch(() => {});
    },
    [disabled, signal, questionId, retrievedObjectIds],
  );

  return (
    <div className={styles.problemBar}>
      <span className={styles.problemLabel}>Did this help?</span>
      {signal ? (
        <span className={styles.problemConfirm}>{CONFIRMATIONS[signal]}</span>
      ) : (
        <>
          <button
            className={`${styles.problemBtn} ${styles.problemNot}`}
            onClick={() => handleSignal('not_helpful')}
            disabled={disabled}
          >
            Not really
          </button>
          <button
            className={`${styles.problemBtn} ${styles.problemSomewhat}`}
            onClick={() => handleSignal('somewhat')}
            disabled={disabled}
          >
            Somewhat
          </button>
          <button
            className={`${styles.problemBtn} ${styles.problemSolved}`}
            onClick={() => handleSignal('solved')}
            disabled={disabled}
          >
            Solved it!
          </button>
        </>
      )}
    </div>
  );
}
