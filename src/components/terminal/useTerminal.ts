'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { search } from './pagefindSearch';
import { matchCommand } from './commands';
import type { SearchResult } from './pagefindSearch';

interface UseTerminalReturn {
  input: string;
  setInput: (value: string) => void;
  results: SearchResult[];
  activeIndex: number;
  commandOutput: string | null;
  handleSubmit: () => void;
  handleArrowUp: () => void;
  handleArrowDown: () => void;
  selectResult: (result: SearchResult) => void;
}

export function useTerminal(onClose: () => void): UseTerminalReturn {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [commandOutput, setCommandOutput] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) {
      setResults([]);
      setCommandOutput(null);
      return;
    }

    // Check for command match first
    const match = matchCommand(input);
    if (match) return; // Don't search if it looks like a command

    debounceRef.current = setTimeout(async () => {
      const found = await search(input);
      setResults(found);
      setActiveIndex(0);
      setCommandOutput(null);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;

    setHistory((prev) => [...prev, input]);
    setHistoryIndex(-1);

    const match = matchCommand(input);
    if (match) {
      const result = match.command.handler(match.args);
      if (result instanceof Promise) {
        result.then((r) => {
          if (r.type === 'redirect') { onClose(); router.push(r.content); }
          else setCommandOutput(r.content);
        });
      } else {
        if (result.type === 'redirect') { onClose(); router.push(result.content); }
        else setCommandOutput(result.content);
      }
      setInput('');
      return;
    }

    // If results exist and one is active, navigate to it
    if (results.length > 0 && results[activeIndex]) {
      onClose();
      router.push(results[activeIndex].url);
    }
  }, [input, results, activeIndex, onClose, router]);

  const handleArrowUp = useCallback(() => {
    if (results.length > 0) {
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (history.length > 0) {
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
    }
  }, [results.length, history, historyIndex]);

  const handleArrowDown = useCallback(() => {
    if (results.length > 0) {
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    }
  }, [results.length]);

  const selectResult = useCallback((result: SearchResult) => {
    onClose();
    router.push(result.url);
  }, [onClose, router]);

  return {
    input, setInput, results, activeIndex, commandOutput,
    handleSubmit, handleArrowUp, handleArrowDown, selectResult,
  };
}
