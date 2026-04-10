'use client';

import { Suspense, useEffect } from 'react';
import { AskExperience } from '@/components/theseus/AskExperience';
import TheseusDotGrid from '@/components/theseus/TheseusDotGrid';
import GalaxyController from '@/components/theseus/GalaxyController';
import { useGalaxy } from '@/components/theseus/TheseusShell';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import ExplorerLayout from '@/components/theseus/explorer/ExplorerLayout';

/**
 * Chrome overlay rendered while the engine is IDLE. Title sits above
 * the Theseus face; starter pills now live in AskDock so neither
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
        pointerEvents: 'none',
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

  // Explorer has its own ControlDock with nav links; suppress the
  // canvas-drawn attractor buttons that TheseusShell sets globally.
  useEffect(() => {
    // Small delay so the initial setNavButtons call from TheseusShell
    // finishes before we clear, preventing a flash.
    const timer = setTimeout(() => {
      galaxy.gridRef.current?.setNavButtons([]);
    }, 100);
    return () => clearTimeout(timer);
  }, [galaxy.gridRef]);

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
