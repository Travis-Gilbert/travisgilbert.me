'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchWindow } from 'iconoir-react';
import styles from './AskBar.module.css';

interface AskBarProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  /** Date label for the integrated prefix (e.g. "Mar 28") */
  dateLabel?: string;
  /** IQ score for the integrated prefix */
  iq?: number;
}

export default function AskBar({ onSubmit, disabled, value, onChange, dateLabel, iq }: AskBarProps) {
  const [local, setLocal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const text = value ?? local;
  const setText = onChange ?? setLocal;

  const handleSubmit = useCallback(() => {
    const q = text.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setText('');
  }, [text, disabled, onSubmit, setText]);

  /* Press `/` anywhere to focus the ask bar */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={styles.askBar}>
      {(dateLabel || (iq != null && iq > 0)) && (
        <div className={styles.prefix}>
          {dateLabel && <span className={styles.prefixDate}>{dateLabel}</span>}
          {iq != null && iq > 0 && <span className={styles.prefixIq}>{iq.toFixed(1)}</span>}
        </div>
      )}
      <span className={styles.icon}>
        <SearchWindow width={16} height={16} strokeWidth={1.5} />
      </span>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        placeholder="Ask your graph something..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        disabled={disabled}
        aria-label="Ask Theseus a question"
      />
      <button
        className={styles.send}
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        aria-label="Submit question"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );
}
