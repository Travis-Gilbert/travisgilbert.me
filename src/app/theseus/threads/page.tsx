'use client';

import { Suspense } from 'react';
import PanelManager from '@/components/theseus/PanelManager';

// Mobile Shell 2.0 (2026-04-28): the authenticated Theseus workspace
// lives here so /theseus can act as a public landing for everyone
// else. The default panel is still Threads ("ask"), so /theseus/threads
// resolves to the canonical chat surface.
export default function TheseusThreadsPage() {
  return (
    <Suspense>
      <PanelManager defaultPanel="ask" />
    </Suspense>
  );
}
