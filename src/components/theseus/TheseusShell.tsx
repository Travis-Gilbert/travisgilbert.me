'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import TheseusDotGrid from './TheseusDotGrid';
import GalaxyController from './GalaxyController';
import TheseusNav from './TheseusNav';
import type { DotGridHandle } from './TheseusDotGrid';
import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import type { AskState } from '@/app/theseus/ask/page';
import type { VizPrediction } from '@/lib/theseus-viz/vizPlanner';

interface GalaxyContextValue {
  gridRef: React.RefObject<DotGridHandle | null>;
  setAskState: (state: AskState) => void;
  setResponse: (response: TheseusResponse | null) => void;
  setDirective: (directive: SceneDirective | null) => void;
  setDataStatus: (status: DataProcessingStatus | null) => void;
  setVizPrediction: (prediction: VizPrediction | null) => void;
  /** Toggle argument structure view ("Show me why") */
  argumentView: boolean;
  setArgumentView: (active: boolean) => void;
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
  const [askState, setAskState] = useState<AskState>('IDLE');
  const [response, setResponse] = useState<TheseusResponse | null>(null);
  const [directive, setDirective] = useState<SceneDirective | null>(null);
  const [dataStatus, setDataStatus] = useState<DataProcessingStatus | null>(null);
  const [vizPrediction, setVizPrediction] = useState<VizPrediction | null>(null);
  const [argumentView, setArgumentView] = useState(false);

  useEffect(() => {
    import('@/lib/theseus-viz/vizPlanner').then(({ warmUpModels }) => {
      warmUpModels().catch(() => {});
    });
  }, []);

  const contextValue = useMemo(() => ({
    gridRef,
    setAskState,
    setResponse,
    setDirective,
    setDataStatus,
    setVizPrediction,
    argumentView,
    setArgumentView,
  }), [gridRef, argumentView, setAskState, setResponse, setDirective, setDataStatus, setVizPrediction, setArgumentView]);

  return (
    <GalaxyContext.Provider value={contextValue}>
      <TheseusDotGrid ref={gridRef} engineState={askState} />
      <GalaxyController
        gridRef={gridRef}
        state={askState}
        response={response}
        directive={directive}
        dataStatus={dataStatus}
        vizPrediction={vizPrediction}
        argumentView={argumentView}
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
