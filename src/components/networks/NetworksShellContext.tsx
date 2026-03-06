'use client';

import { createContext, useContext } from 'react';

export type NetworksMobileTab = 'list' | 'graph' | 'search';

interface NetworksShellContextValue {
  isMobile: boolean;
  activeTab: NetworksMobileTab;
  setActiveTab: (tab: NetworksMobileTab) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const NetworksShellContext = createContext<NetworksShellContextValue>({
  isMobile: false,
  activeTab: 'list',
  setActiveTab: () => {},
  openDrawer: () => {},
  closeDrawer: () => {},
});

export function NetworksShellProvider({
  value,
  children,
}: {
  value: NetworksShellContextValue;
  children: React.ReactNode;
}) {
  return (
    <NetworksShellContext.Provider value={value}>
      {children}
    </NetworksShellContext.Provider>
  );
}

export function useNetworksShell() {
  return useContext(NetworksShellContext);
}
