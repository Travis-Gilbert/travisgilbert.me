'use client';

import ModelView from './ModelView';

/**
 * ModelsScreen: full-screen Models workspace with a header.
 *
 * Wraps the existing ModelView with a screen-level header
 * containing a title and creation action.
 */
export default function ModelsScreen() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Screen header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px 8px',
          borderBottom: '1px solid var(--cp-chrome-line)',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--cp-font-title)',
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--cp-text)',
            margin: 0,
          }}
        >
          Models
        </h2>
      </div>

      {/* ModelView workspace */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <ModelView />
      </div>
    </div>
  );
}
