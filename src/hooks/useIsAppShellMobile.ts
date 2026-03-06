'use client';

import { useMediaQuery } from '@/hooks/useMediaQuery';

const APP_SHELL_MOBILE_QUERY = '(max-width: 1023px)';

export function useIsAppShellMobile(): boolean {
  return useMediaQuery(APP_SHELL_MOBILE_QUERY);
}
