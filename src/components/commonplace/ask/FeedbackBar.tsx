'use client';

import { useState, useCallback } from 'react';
import { submitFeedback } from '@/lib/ask-theseus';
import type { AskFeedbackSignal } from '@/lib/ask-theseus';
import ProblemSolvingStrip from './ProblemSolvingStrip';
import styles from './FeedbackBar.module.css';

interface FeedbackBarProps {
  questionId: string;
  retrievedObjectIds: number[];
}

export default function FeedbackBar({ questionId, retrievedObjectIds }: FeedbackBarProps) {
  const [vote, setVote] = useState<'positive' | 'negative' | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleVote = useCallback(async (signal: 'positive' | 'negative') => {
    const next = vote === signal ? null : signal;
    setVote(next);
    if (next) {
      submitFeedback(questionId, next, retrievedObjectIds).catch(() => {});
    }
  }, [vote, questionId, retrievedObjectIds]);

  const handleSave = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await submitFeedback(questionId, 'save' as AskFeedbackSignal, retrievedObjectIds);
      setSaved(true);
    } catch {
      setSaving(false);
    }
  }, [saving, saved, questionId, retrievedObjectIds]);

  if (saved) {
    return (
      <div className={styles.savedMsg}>
        Saved as object. Training signal recorded.
      </div>
    );
  }

  return (
    <div>
      <div className={styles.bar}>
        {/* Thumbs down */}
        <button
          className={`${styles.btn} ${vote === 'negative' ? styles.downOn : ''}`}
          onClick={() => handleVote('negative')}
          aria-label="Thumbs down"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
          </svg>
        </button>

        {/* Thumbs up */}
        <button
          className={`${styles.btn} ${vote === 'positive' ? styles.upOn : ''}`}
          onClick={() => handleVote('positive')}
          aria-label="Thumbs up"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
          </svg>
        </button>

        <span className={styles.spacer} />

        {/* Save */}
        <button
          className={`${styles.btn} ${styles.save}`}
          onClick={handleSave}
          disabled={saving}
          aria-label="Save answer as object"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <ProblemSolvingStrip
        questionId={questionId}
        retrievedObjectIds={retrievedObjectIds}
        styles={styles}
      />
    </div>
  );
}
