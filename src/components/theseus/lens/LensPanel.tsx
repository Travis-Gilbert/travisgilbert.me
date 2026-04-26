'use client';

import { Suspense, lazy } from 'react';

const LensView = lazy(() => import('./LensView'));

export default function LensPanel() {
  return (
    <Suspense
      fallback={
        <div className="theseus-panel-loading">
          <span className="theseus-panel-loading-text">LOADING LENS</span>
        </div>
      }
    >
      <LensView />
    </Suspense>
  );
}
