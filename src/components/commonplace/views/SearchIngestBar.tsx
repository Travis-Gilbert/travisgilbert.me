'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Globe } from 'iconoir-react';
import styles from './SearchIngestBar.module.css';

interface SearchIngestBarProps {
  onSearch?: (query: string) => void;
  onIngest?: (url: string) => void;
}

const URL_RE = /^https?:\/\//i;

export default function SearchIngestBar({ onSearch, onIngest }: SearchIngestBarProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isUrl = URL_RE.test(value.trim());

  /* "/" shortcut: focus bar unless user is already inside another input */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  /* Debounced search */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setValue(v);

      if (timerRef.current) clearTimeout(timerRef.current);
      if (!URL_RE.test(v.trim()) && v.trim().length > 0) {
        timerRef.current = setTimeout(() => {
          onSearch?.(v.trim());
        }, 300);
      }
    },
    [onSearch],
  );

  const handleSubmit = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      if (isUrl) {
        onIngest?.(trimmed);
      } else {
        onSearch?.(trimmed);
      }
    },
    [value, isUrl, onIngest, onSearch],
  );

  return (
    <div className={styles.bar}>
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 21H4C2.89543 21 2 20.1046 2 19V5C2 3.89543 2.89543 3 4 3H20C21.1046 3 22 3.89543 22 5V14" />
        <path d="M2 7L22 7" />
        <path d="M5 5.01L5.01 4.99889" />
        <path d="M8 5.01L8.01 4.99889" />
        <path d="M11 5.01L11.01 4.99889" />
        <path d="M20.1241 20.1185C20.6654 19.5758 21 18.827 21 18C21 16.3431 19.6569 15 18 15C16.3431 15 15 16.3431 15 18C15 19.6569 16.3431 21 18 21C18.8299 21 19.581 20.663 20.1241 20.1185ZM20.1241 20.1185L22 22" />
      </svg>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search your graph or paste a URL..."
        spellCheck={false}
        autoComplete="off"
      />
      {isUrl && (
        <button
          className={styles.ingestButton}
          onClick={() => onIngest?.(value.trim())}
          type="button"
        >
          <Globe width={12} height={12} />
          Ingest
        </button>
      )}
      {!focused && !value && (
        <span className={styles.kbd}>/</span>
      )}
    </div>
  );
}
