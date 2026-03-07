'use client';

import { useRef, useEffect } from 'react';

interface TerminalInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
  onEscape: () => void;
}

export default function TerminalInput({
  value,
  onChange,
  onSubmit,
  onArrowUp,
  onArrowDown,
  onEscape,
}: TerminalInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 font-mono text-sm">
      <span style={{ color: '#B45A2D' }}>$</span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          else if (e.key === 'ArrowUp') { e.preventDefault(); onArrowUp(); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); onArrowDown(); }
          else if (e.key === 'Escape') onEscape();
        }}
        className="flex-1 bg-transparent border-none outline-none caret-[#B45A2D]"
        style={{ color: '#D4CCC4', fontFamily: 'var(--font-metadata)', fontSize: 14 }}
        autoComplete="off"
        spellCheck={false}
        aria-label="Search or enter command"
      />
    </div>
  );
}
