'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import TheseusDotGrid from './TheseusDotGrid';
import GalaxyController from './GalaxyController';
import type { GalaxyControllerHandle } from './GalaxyController';
import TheseusNav from './TheseusNav';
import type { DotGridHandle } from './TheseusDotGrid';
import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import type { AskState } from '@/components/theseus/AskExperience';
import type { VizPrediction } from '@/lib/theseus-viz/vizPlanner';
import type { SourceTrailItem } from './SourceTrail';

interface GalaxyContextValue {
  gridRef: React.RefObject<DotGridHandle | null>;
  /** Phase B: imperative handle for ThinkingChoreographer (F9 consumer). */
  galaxyControllerRef: React.RefObject<GalaxyControllerHandle | null>;
  /** Current engine state. Read by HomepageChrome to fade out when
   *  the user submits a query and back in when state returns to IDLE. */
  askState: AskState;
  setAskState: (state: AskState) => void;
  setResponse: (response: TheseusResponse | null) => void;
  setDirective: (directive: SceneDirective | null) => void;
  setDataStatus: (status: DataProcessingStatus | null) => void;
  setVizPrediction: (prediction: VizPrediction | null) => void;
  /** Toggle argument structure view ("Show me why") */
  argumentView: boolean;
  setArgumentView: (active: boolean) => void;
  /** Source trail: accumulated explored sources */
  sourceTrail: SourceTrailItem[];
  addToSourceTrail: (item: SourceTrailItem) => void;
  clearSourceTrail: () => void;
  /** Mouth openness ref for voice animation (written by VoiceControls, read by GalaxyController) */
  mouthOpenRef: React.MutableRefObject<number>;
}

const GalaxyContext = createContext<GalaxyContextValue | null>(null);

export function useGalaxy(): GalaxyContextValue {
  const ctx = useContext(GalaxyContext);
  if (!ctx) throw new Error('useGalaxy must be used within TheseusShell');
  return ctx;
}

export function useDotGrid(): React.RefObject<DotGridHandle | null> {
  return useGalaxy().gridRef;
}

export default function TheseusShell({ children }: { children: React.ReactNode }) {
  const gridRef = useRef<DotGridHandle>(null);
  const galaxyControllerRef = useRef<GalaxyControllerHandle>(null);
  const [askState, setAskState] = useState<AskState>('IDLE');
  const [response, setResponse] = useState<TheseusResponse | null>(null);
  const [directive, setDirective] = useState<SceneDirective | null>(null);
  const [dataStatus, setDataStatus] = useState<DataProcessingStatus | null>(null);
  const [vizPrediction, setVizPrediction] = useState<VizPrediction | null>(null);
  const [argumentView, setArgumentView] = useState(false);
  const [sourceTrail, setSourceTrail] = useState<SourceTrailItem[]>([]);
  const mouthOpenRef = useRef(0);

  const addToSourceTrail = useCallback((item: SourceTrailItem) => {
    setSourceTrail((prev) => {
      if (prev.some((p) => p.objectId === item.objectId)) return prev;
      const next = [item, ...prev];
      return next.length > 20 ? next.slice(0, 20) : next;
    });
  }, []);

  const clearSourceTrail = useCallback(() => setSourceTrail([]), []);

  useEffect(() => {
    import('@/lib/theseus-viz/vizPlanner').then(({ warmUpModels }) => {
      warmUpModels().catch(() => {});
    });
  }, []);

  // TODO: BATCH 4 - replace with predictor wiring (navPredictor.predictNav
  // -> setNavButtons). For Batch 2 verification only: hardcode three nav
  // buttons one second after mount so we can see attractor formation.
  useEffect(() => {
    const t = setTimeout(() => {
      gridRef.current?.setNavButtons([
        { id: 'ask', label: 'Ask' },
        { id: 'library', label: 'Library' },
        { id: 'artifacts', label: 'Artifacts' },
      ]);
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  const contextValue = useMemo(() => ({
    gridRef,
    galaxyControllerRef,
    askState,
    setAskState,
    setResponse,
    setDirective,
    setDataStatus,
    setVizPrediction,
    argumentView,
    setArgumentView,
    sourceTrail,
    addToSourceTrail,
    clearSourceTrail,
    mouthOpenRef,
  }), [gridRef, askState, argumentView, sourceTrail, setAskState, setResponse, setDirective, setDataStatus, setVizPrediction, setArgumentView, addToSourceTrail, clearSourceTrail, mouthOpenRef]);

  return (
    <GalaxyContext.Provider value={contextValue}>
      <TheseusDotGrid ref={gridRef} engineState={askState} spacing={14} />
      <GalaxyController
        ref={galaxyControllerRef}
        gridRef={gridRef}
        state={askState}
        response={response}
        directive={directive}
        dataStatus={dataStatus}
        vizPrediction={vizPrediction}
        argumentView={argumentView}
        onSourceExplored={addToSourceTrail}
        mouthOpenRef={mouthOpenRef}
      />
      <TheseusNav />
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        paddingTop: 48,
        boxSizing: 'border-box',
      }}>
        {children}
      </div>
    </GalaxyContext.Provider>
  );
}
