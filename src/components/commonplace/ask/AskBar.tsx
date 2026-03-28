'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import styles from './AskBar.module.css';

interface AskBarProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

export default function AskBar({ onSubmit, disabled, value, onChange }: AskBarProps) {
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
      <span className={styles.icon}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        placeholder="Ask your graph a question..."
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
        <span className={styles.slash}>/</span>
      </button>
    </div>
  );
}
