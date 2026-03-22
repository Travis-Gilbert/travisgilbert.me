'use client';

import ModelView from './ModelView';

/**
 * ModelsScreen: full-screen Models workspace.
 * The top bar handles the "Models" label, so no screen header needed.
 */
export default function ModelsScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <ModelView />
      </div>
    </div>
  );
}
