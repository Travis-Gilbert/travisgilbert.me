'use client';

import { Suspense, useEffect, useRef } from 'react';
import { AskExperience } from '@/components/theseus/AskExperience';
import TheseusDotGrid from '@/components/theseus/TheseusDotGrid';
import GalaxyController from '@/components/theseus/GalaxyController';
import { useGalaxy } from '@/components/theseus/TheseusShell';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import ExplorerLayout from '@/components/theseus/explorer/ExplorerLayout';

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
 * ExplorerPanel: graph explorer wrapper for PanelManager.
 *
 * Pause/resume: when the panel is hidden (data-active=false),
 * the galaxy controller and dot grid animations are suppressed
 * via a MutationObserver on the parent panel element.
 */
export default function ExplorerPanel() {
  const galaxy = useGalaxy();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Suppress canvas-drawn attractor buttons (Explorer has its own ControlDock)
  useEffect(() => {
    const timer = setTimeout(() => {
      galaxy.gridRef.current?.setNavButtons([]);
    }, 100);
    return () => clearTimeout(timer);
  }, [galaxy.gridRef]);

  // Pause/resume: observe the parent panel's data-active attribute
  useEffect(() => {
    const panel = document.querySelector('[data-panel="explorer"]');
    if (!panel) return;

    const observer = new MutationObserver(() => {
      const isActive = panel.getAttribute('data-active') === 'true';
      // TheseusDotGrid and GalaxyController use requestAnimationFrame
      // internally. When hidden via display:none, rAF naturally pauses
      // because the element isn't painted. No explicit pause needed.
      // For future R3F: set frameloop="demand" when hidden.
      if (isActive) {
        galaxy.gridRef.current?.setNavButtons([]);
      }
    });

    observer.observe(panel, { attributes: true, attributeFilter: ['data-active'] });
    return () => observer.disconnect();
  }, [galaxy.gridRef]);

  return (
    <ExplorerLayout>
      <TheseusDotGrid
        ref={galaxy.gridRef}
        engineState={galaxy.askState}
        spacing={14}
        onNavButtonClick={() => {}}
        huntMode={galaxy.isHunting}
        huntOrigin={galaxy.huntOrigin}
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
