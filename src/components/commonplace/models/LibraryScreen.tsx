'use client';

import { useState } from 'react';
import LibraryView from '../views/LibraryView';
import ObjectDetailView from '../views/ObjectDetailView';

/**
 * LibraryScreen: full-screen Library with an inline detail panel.
 *
 * Clicking an object in the library opens a detail view in a right panel
 * (45/55 split). The detail panel can be closed to return to full-width
 * browsing. Connected objects clicked inside the detail panel navigate
 * within the same panel.
 */
export default function LibraryScreen() {
  const [selectedRef, setSelectedRef] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Library panel */}
      <div
        style={{
          flex: selectedRef ? 0.45 : 1,
          transition: 'flex 200ms ease',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <LibraryView onOpenObject={(ref) => setSelectedRef(ref)} />
      </div>

      {/* Inline detail panel */}
      {selectedRef !== null && (
        <div
          style={{
            flex: 0.55,
            borderLeft: '1px solid var(--cp-chrome-line)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            title="Close detail"
            onClick={() => setSelectedRef(null)}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 10,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--cp-text-dim)',
              cursor: 'pointer',
              fontSize: 14,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--cp-chrome-raise)';
              e.currentTarget.style.color = 'var(--cp-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--cp-text-dim)';
            }}
          >
            ×
          </button>

          <ObjectDetailView
            objectRef={selectedRef}
            onOpenObject={(ref) => setSelectedRef(ref)}
          />
        </div>
      )}
    </div>
  );
}
