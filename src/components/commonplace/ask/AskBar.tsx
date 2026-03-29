'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { SearchWindow } from 'iconoir-react';
import styles from './AskBar.module.css';

interface AskBarProps {
  onSubmit: (question: string) => void;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

export default function AskBar({ onSubmit, disabled, value, onChange }: AskBarProps) {
  const [local, setLocal] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const text = value ?? local;
  const setText = onChange ?? setLocal;

  const handleSubmit = useCallback(() => {
    const q = text.trim();
    if (!q || disabled) return;
    onSubmit(q);
    setText('');
  }, [text, disabled, onSubmit, setText]);

  /* Press `/` or `Cmd+K` / `Ctrl+K` anywhere to focus the command bar */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Cmd+K or Ctrl+K
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // `/` shortcut (skip when inside editable elements)
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
    <div
      className={`${styles.cmdBar} ${focused ? styles.focused : ''}`}
      onClick={() => inputRef.current?.focus()}
    >
      <span className={styles.searchIcon}>
        <SearchWindow width={18} height={18} strokeWidth={1.5} />
      </span>
      <input
        ref={inputRef}
        className={styles.cmdInput}
        type="text"
        placeholder="What your notes want you to find"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        aria-label="Ask Theseus a question"
      />
      <span className={styles.cmdKbd}>
        <span className={styles.cmdSym}>{'\u2318'}</span>K
      </span>
    </div>
  );
}
