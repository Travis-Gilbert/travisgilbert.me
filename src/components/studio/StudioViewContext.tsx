'use client';

import { createContext, useContext } from 'react';

export type StudioThemeMode = 'dark' | 'light';

export interface StudioViewState {
  zenMode: boolean;
  setZenMode: (enabled: boolean) => void;
  toggleZenMode: () => void;
  themeMode: StudioThemeMode;
  setThemeMode: (mode: StudioThemeMode) => void;
  toggleThemeMode: () => void;
}

const StudioViewContext = createContext<StudioViewState | null>(null);

export function StudioViewProvider({
  value,
  children,
}: {
  value: StudioViewState;
  children: React.ReactNode;
}) {
  return (
    <StudioViewContext.Provider value={value}>
      {children}
    </StudioViewContext.Provider>
  );
}

export function useStudioView(): StudioViewState {
  const context = useContext(StudioViewContext);
  if (!context) {
    throw new Error('useStudioView must be used within StudioViewProvider');
  }
  return context;
}
