'use client';

import { useState, useEffect, useCallback } from 'react';
import TerminalInput from './terminal/TerminalInput';
import TerminalOutput from './terminal/TerminalOutput';
import { useTerminal } from './terminal/useTerminal';

export default function Terminal() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);
  const {
    input, setInput, results, activeIndex, commandOutput,
    handleSubmit, handleArrowUp, handleArrowDown, selectResult,
  } = useTerminal(close);

  // Global Cmd+K / Ctrl+K listener + custom event from TopNav search button
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenTerminal() {
      setOpen(true);
    }
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('open-terminal', onOpenTerminal);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('open-terminal', onOpenTerminal);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center"
      style={{ backgroundColor: '#1A1816' }}
      role="dialog"
      aria-modal="true"
      aria-label="Site search terminal"
    >
      {/* Close button */}
      <button
        onClick={close}
        className="absolute top-4 right-4 font-mono text-xs bg-transparent border-none cursor-pointer"
        style={{ color: '#6A5E52' }}
        aria-label="Close search"
      >
        [x]
      </button>

      <div className="w-full max-w-[720px] px-6 pt-12">
        <TerminalInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onArrowUp={handleArrowUp}
          onArrowDown={handleArrowDown}
          onEscape={close}
        />
        <TerminalOutput
          results={results}
          activeIndex={activeIndex}
          onSelect={selectResult}
          helpVisible={false}
          commandOutput={commandOutput}
        />
        <p
          className="mt-6 text-xs"
          style={{ color: '#5A5652', fontFamily: 'var(--font-metadata)' }}
        >
          Type to search, or try: help, now, random, connections
        </p>
      </div>
    </div>
  );
}
