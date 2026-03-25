'use client';

import { createContext, useContext } from 'react';

interface OwnerContextValue {
  isOwner: boolean;
}

const OwnerContext = createContext<OwnerContextValue>({ isOwner: false });

export function OwnerProvider({
  isOwner,
  children,
}: {
  isOwner: boolean;
  children: React.ReactNode;
}) {
  return (
    <OwnerContext.Provider value={{ isOwner }}>
      {children}
    </OwnerContext.Provider>
  );
}

export function useOwner(): OwnerContextValue {
  return useContext(OwnerContext);
}
