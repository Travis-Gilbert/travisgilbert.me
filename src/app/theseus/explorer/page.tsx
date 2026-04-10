'use client';

import { Suspense } from 'react';
import { AskExperience } from '@/components/theseus/AskExperience';
import TheseusDotGrid from '@/components/theseus/TheseusDotGrid';
import GalaxyController from '@/components/theseus/GalaxyController';
import { useGalaxy } from '@/components/theseus/TheseusShell';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import ExplorerLayout from '@/components/theseus/explorer/ExplorerLayout';

const STARTER_QUERIES = [
  'What connects Shannon to Hamming?',
  'What unresolved tensions are active?',
  'What am I missing about GNNs?',
  'What new clusters formed this week?',
];

/**
 * Chrome overlay rendered while the engine is IDLE. Title sits above
 * the Theseus face, starter pills sit below the face area, so neither
 * overlaps the interactive dot field.
 */
function ExplorerChrome() {
  const { askState } = useGalaxy();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isIdle = askState === 'IDLE';

  return (
    <div
      aria-hidden={!isIdle}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6vh 24px 0',
        opacity: isIdle ? 1 : 0,
        pointerEvents: isIdle ? 'auto' : 'none',
        transition: prefersReducedMotion ? 'none' : 'opacity 500ms ease',
        zIndex: 11,
      }}
    >
      {/* Top: title + subtitle (above the face) */}
      <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
        <h1
          style={{
            fontFamily: 'var(--font-vollkorn-sc), Georgia, serif',
            fontSize: 28,
            fontWeight: 600,
            color: '#3D8A96',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '0.08em',
          }}
        >
          THESEUS
        </h1>
        <p
          style={{
            margin: '8px 0 0',
            fontFamily: 'var(--vie-font-body)',
            fontSize: 14,
            color: 'var(--vie-text-dim)',
          }}
        >
          Click a dot to explore. Ask a question to visualize.
        </p>
      </div>

      {/* Middle: empty space for the face (no elements here) */}
      <div style={{ flex: 1 }} />

      {/* Bottom: starter pills (below the face, above the input dock) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          maxWidth: 640,
          marginBottom: 80,
        }}
      >
        {STARTER_QUERIES.map((starter) => (
          <button
            key={starter}
            type="button"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('q', starter);
              window.history.replaceState({}, '', url.toString());
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--vie-text-muted)',
              fontFamily: 'var(--vie-font-body)',
              fontSize: 12,
              lineHeight: 1,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Explorer page: the galaxy dot field IS the interactive graph.
 *
 * Cluster-tagged dots are clickable in idle state (GalaxyController
 * handles click-to-object mapping). No separate graph overlay needed.
 * ExplorerChrome positions title above and pills below the face area.
 */
export default function ExplorerPage() {
  const galaxy = useGalaxy();

  return (
    <ExplorerLayout>
      {/* Galaxy background: dot grid + controller.
          The dots themselves are the interactive graph. Cluster dots
          are tagged on mount and clickable via GalaxyController's
          findNearestClusterDot + topObjects fallback. */}
      <TheseusDotGrid
        ref={galaxy.gridRef}
        engineState={galaxy.askState}
        spacing={14}
        onNavButtonClick={() => {}}
      />
      <GalaxyController
        ref={galaxy.galaxyControllerRef}
        gridRef={galaxy.gridRef}
        state={galaxy.askState}
        response={galaxy.response}
        directive={galaxy.directive}
        dataStatus={galaxy.dataStatus}
        vizPrediction={galaxy.vizPrediction}
        argumentView={galaxy.argumentView}
        onSourceExplored={galaxy.addToSourceTrail}
        mouthOpenRef={galaxy.mouthOpenRef}
      />

      {/* Interactive content layer */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0 }} aria-busy="true" />}>
          <ExplorerChrome />
          <AskExperience />
        </Suspense>
      </div>
    </ExplorerLayout>
  );
}
