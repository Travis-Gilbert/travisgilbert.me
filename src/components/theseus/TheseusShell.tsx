'use client';

import { createContext, useContext, useRef } from 'react';
import TheseusDotGrid from './TheseusDotGrid';
import type { DotGridHandle } from './TheseusDotGrid';

const DotGridContext = createContext<React.RefObject<DotGridHandle | null> | null>(null);

export function useDotGrid(): React.RefObject<DotGridHandle | null> {
  const ctx = useContext(DotGridContext);
  if (!ctx) throw new Error('useDotGrid must be used within TheseusShell');
  return ctx;
}

export default function TheseusShell({ children }: { children: React.ReactNode }) {
  const gridRef = useRef<DotGridHandle>(null);

  return (
    <DotGridContext.Provider value={gridRef}>
      <TheseusDotGrid ref={gridRef} />
      <div style={{ position: 'relative', zIndex: 1, width: '100vw', height: '100vh' }}>
        {children}
      </div>
    </DotGridContext.Provider>
  );
}
