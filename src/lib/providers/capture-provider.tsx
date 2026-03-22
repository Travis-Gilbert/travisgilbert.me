'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

export interface CaptureContextValue {
  captureVersion: number;
  notifyCaptured: () => void;
}

const NOOP = () => {};

const CaptureContext = createContext<CaptureContextValue>({
  captureVersion: 0,
  notifyCaptured: NOOP,
});

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [captureVersion, setCaptureVersion] = useState(0);

  const notifyCaptured = useCallback(() => {
    setCaptureVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({ captureVersion, notifyCaptured }),
    [captureVersion, notifyCaptured],
  );

  return (
    <CaptureContext.Provider value={value}>
      {children}
    </CaptureContext.Provider>
  );
}

export function useCapture(): CaptureContextValue {
  return useContext(CaptureContext);
}
