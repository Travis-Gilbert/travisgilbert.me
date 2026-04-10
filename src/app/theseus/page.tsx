'use client';

import { Suspense } from 'react';
import PanelManager from '@/components/theseus/PanelManager';

/**
 * Theseus workspace: single page with panel-based navigation.
 *
 * All panels (Ask, Explorer, Notebook, Library, Settings) are
 * managed by PanelManager. The sidebar switches which panel is
 * visible. Panels mount lazily and persist after first access.
 * URL updates via searchParams for deep linking (?view=explorer).
 */
export default function TheseusPage() {
  return (
    <Suspense>
      <PanelManager />
    </Suspense>
  );
}
