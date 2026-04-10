'use client';

import { Suspense, useCallback } from 'react';
import { AskExperience } from '@/components/theseus/AskExperience';
import TheseusDotGrid from '@/components/theseus/TheseusDotGrid';
import GalaxyController from '@/components/theseus/GalaxyController';
import { useGalaxy } from '@/components/theseus/TheseusShell';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import ExplorerLayout from '@/components/theseus/explorer/ExplorerLayout';
import IdleGraph from '@/components/theseus/explorer/IdleGraph';

const STARTER_QUERIES = [
  'What connects Shannon to Hamming?',
  'What unresolved tensions are active?',
  'What am I missing about GNNs?',
  'What new clusters formed this week?',
];

/**
 * Chrome overlay rendered while the engine is IDLE. Shows the THESEUS
 * title and starter query pills. Fades out when a query starts.
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
        top: '22vh',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(720px, calc(100vw - 32px))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: isIdle ? 1 : 0,
        pointerEvents: isIdle ? 'auto' : 'none',
        transition: prefersReducedMotion ? 'none' : 'opacity 500ms ease',
        zIndex: 11,
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-vollkorn-sc), Georgia, serif',
          fontSize: 28,
          fontWeight: 600,
          color: '#3D8A96',
          margin: 0,
          lineHeight: 1.1,
          letterSpacing: '0.08em',
          textAlign: 'center',
        }}
      >
        THESEUS
      </h1>
      <p
        style={{
          margin: '10px 0 0',
          fontFamily: 'var(--vie-font-body)',
          fontSize: 14,
          color: 'var(--vie-text-dim)',
          textAlign: 'center',
        }}
      >
        What are you curious about?
      </p>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          marginTop: 22,
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
 * Explorer page: three-panel progressive reveal layout wrapping
 * the galaxy dot field and AskExperience.
 *
 * Graph canvas fills the center. Structure panel slides in from
 * left. Context panel slides in from right on node selection.
 */
export default function ExplorerPage() {
  const galaxy = useGalaxy();
  const isIdle = galaxy.askState === 'IDLE';

  const handleIdleNodeSelect = useCallback((nodeId: string) => {
    window.dispatchEvent(
      new CustomEvent('explorer:select-node', { detail: { nodeId } }),
    );
  }, []);

  return (
    <ExplorerLayout>
      {/* Idle graph: interactive cluster visualization before any query */}
      {isIdle && <IdleGraph onSelectNode={handleIdleNodeSelect} />}

      {/* Galaxy background: dot grid + controller */}
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
