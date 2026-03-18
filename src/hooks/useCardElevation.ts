import { useMemo } from 'react';

interface ElevationResult {
  shadow: string;
  tier: 'flat' | 'raised' | 'elevated';
}

export function useCardElevation(connectionCount: number): ElevationResult {
  return useMemo(() => {
    if (connectionCount >= 8) {
      return {
        shadow:
          '0 4px 12px rgba(42, 36, 32, 0.09), 0 2px 4px rgba(42, 36, 32, 0.05)',
        tier: 'elevated' as const,
      };
    }
    if (connectionCount >= 3) {
      return {
        shadow:
          '0 2px 6px rgba(42, 36, 32, 0.07), 0 1px 2px rgba(42, 36, 32, 0.04)',
        tier: 'raised' as const,
      };
    }
    return {
      shadow: '0 1px 2px rgba(42, 36, 32, 0.04)',
      tier: 'flat' as const,
    };
  }, [connectionCount]);
}
