'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import '@/components/theseus/capture/capture.css';
import { usePathname, useRouter } from 'next/navigation';
import type { GalaxyControllerHandle } from './GalaxyController';
import type { DotGridHandle } from './TheseusDotGrid';
import type { TheseusResponse } from '@/lib/theseus-types';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { DataProcessingStatus } from '@/lib/theseus-data/types';
import type { VizPrediction } from '@/lib/theseus-viz/vizPlanner';
import type { SourceTrailItem } from './SourceTrail';
import type { AskState } from './askExperienceState';
import { useNavScreenState } from './useNavScreenState';
import {
  NAV_ACTIONS,
  initNavModel,
  predictNav,
  recordNavSignal,
  trainNavModel,
  type NavActionId,
} from '@/lib/galaxy/navPredictor';
import TransmissionLine from '@/components/theseus/TransmissionLine';

interface GalaxyContextValue {
  gridRef: React.RefObject<DotGridHandle | null>;
  /** Phase B: imperative handle for ThinkingChoreographer (F9 consumer). */
  galaxyControllerRef: React.RefObject<GalaxyControllerHandle | null>;
  /** Current engine state. Read by HomepageChrome to fade out when
   *  the user submits a query and back in when state returns to IDLE. */
  askState: AskState;
  setAskState: (state: AskState) => void;
  /** Current response/directive state (readable by Explorer page). */
  response: TheseusResponse | null;
  setResponse: (response: TheseusResponse | null) => void;
  directive: SceneDirective | null;
  setDirective: (directive: SceneDirective | null) => void;
  dataStatus: DataProcessingStatus | null;
  setDataStatus: (status: DataProcessingStatus | null) => void;
  vizPrediction: VizPrediction | null;
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
  /** Hunting mode: true when dragging files over the workspace */
  isHunting: boolean;
  /** Cursor position during hunt (client coords) */
  huntOrigin: { x: number; y: number } | null;
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

  /* ─────────────────────────────────────────────────
     Adaptive nav: TF.js predictor → attractor buttons
     ───────────────────────────────────────────────── */
  const router = useRouter();
  const pathname = usePathname();
  const navScreenState = useNavScreenState({
    engineState:
      askState === 'CONSTRUCTING' ? 'constructing'
      : askState === 'THINKING' || askState === 'EXPLORING' ? 'reasoning'
      : 'idle',
    hasActiveQuery: askState !== 'IDLE',
  });
  const signalCountRef = useRef(0);
  const ignoreTimersRef = useRef<Map<string, number>>(new Map());
  const lastShownButtonsRef = useRef<Set<string>>(new Set());
  const predictTimerRef = useRef<number | null>(null);

  // Initialize the model once on mount.
  useEffect(() => {
    initNavModel().catch((err) => {
      console.warn('[nav] init failed:', err);
    });
  }, []);

  const maybeTrainAndSave = useCallback(async () => {
    if (signalCountRef.current % 10 !== 0) return;
    try {
      await trainNavModel();
    } catch (err) {
      console.warn('[nav] training failed:', err);
    }
  }, []);

  // Debounced prediction loop: re-predict whenever screen state changes,
  // but only after the screen state has been stable for 500ms. This avoids
  // racing route-change cascades that would otherwise wipe the nav between
  // a click and the next prediction landing.
  useEffect(() => {
    if (predictTimerRef.current !== null) {
      window.clearTimeout(predictTimerRef.current);
    }

    let cancelled = false;
    predictTimerRef.current = window.setTimeout(() => {
      predictNav(navScreenState).then((prediction) => {
        if (cancelled) return;

        // Explorer page has its own ControlDock with nav links;
        // suppress the canvas-drawn attractor buttons there.
        if (pathname === '/theseus/explorer') {
          gridRef.current?.setNavButtons([]);
          return;
        }

        const buttons = prediction.actions.map((a) => {
          const action = NAV_ACTIONS.find((x) => x.id === a.id);
          return {
            id: a.id,
            label: a.label,
            icon: action?.icon,
          };
        });
        // Defensive: never clear the existing nav with an empty list. If the
        // predictor has nothing to say (transient model state, etc.), keep
        // whatever buttons are already on screen.
        if (buttons.length === 0) return;
        gridRef.current?.setNavButtons(buttons);

        const newIds = new Set<string>(buttons.map((b) => b.id));
        // Clear ignore timers for buttons that disappeared.
        for (const [id, timerId] of ignoreTimersRef.current) {
          if (!newIds.has(id)) {
            window.clearTimeout(timerId);
            ignoreTimersRef.current.delete(id);
          }
        }
        // Start ignore timers for newly shown buttons.
        for (const id of newIds) {
          if (lastShownButtonsRef.current.has(id)) continue;
          const timerId = window.setTimeout(() => {
            recordNavSignal(id as NavActionId, 'ignore');
            signalCountRef.current += 1;
            void maybeTrainAndSave();
          }, 30_000);
          ignoreTimersRef.current.set(id, timerId);
        }
        lastShownButtonsRef.current = newIds;
      }).catch((err) => {
        console.warn('[nav] prediction failed:', err);
      });
    }, 500);

    return () => {
      cancelled = true;
      if (predictTimerRef.current !== null) {
        window.clearTimeout(predictTimerRef.current);
        predictTimerRef.current = null;
      }
    };
  }, [navScreenState, maybeTrainAndSave]);

  // Cleanup all pending ignore timers on unmount.
  useEffect(() => () => {
    for (const timerId of ignoreTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    ignoreTimersRef.current.clear();
  }, []);

  // Shell-level listener for the contextual nav action (focusInput).
  // In panel mode, switch to the ask panel and fire focus event.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail ?? {};
      if (detail.action !== 'focusInput') return;
      // Switch to ask panel and focus the input
      window.dispatchEvent(
        new CustomEvent('theseus:switch-panel', { detail: { panel: 'ask' } }),
      );
      requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('theseus:focus-ask-input'));
      });
    };
    window.addEventListener('theseus:nav-action', handler);
    return () => window.removeEventListener('theseus:nav-action', handler);
  }, []);

  // Listen for "Ask about this" bridge from ContextPanel.
  // In panel mode, switch to ask panel and prefill the query.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      if (!detail?.query) return;
      // Switch to ask panel
      window.dispatchEvent(
        new CustomEvent('theseus:switch-panel', { detail: { panel: 'ask' } }),
      );
      // Prefill the query after panel is visible
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('theseus:prefill-ask', { detail: { query: detail.query } }),
        );
      });
    };
    window.addEventListener('theseus:navigate-ask', handler);
    return () => window.removeEventListener('theseus:navigate-ask', handler);
  }, []);

  const handleNavButtonClick = useCallback((buttonId: string) => {
    // Cancel the ignore timer for this button: the user engaged with it.
    const timer = ignoreTimersRef.current.get(buttonId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      ignoreTimersRef.current.delete(buttonId);
    }

    recordNavSignal(buttonId as NavActionId, 'click');
    signalCountRef.current += 1;
    void maybeTrainAndSave();

    const action = NAV_ACTIONS.find((a) => a.id === buttonId);
    if (!action) return;
    if ('route' in action && action.route) {
      router.push(action.route);
    } else if ('action' in action && action.action) {
      // Contextual actions fire a DOM event for now. Future batches can wire
      // these to concrete handlers (openTensions, focusInput, etc.).
      window.dispatchEvent(
        new CustomEvent('theseus:nav-action', { detail: { action: action.action } }),
      );
    }
  }, [router, maybeTrainAndSave]);

  /* ─────────────────────────────────────────────────
     Global file drop overlay: show hint when dragging
     files over any part of Theseus, open capture modal on drop.
     ───────────────────────────────────────────────── */
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [isHunting, setIsHunting] = useState(false);
  const [huntOrigin, setHuntOrigin] = useState<{ x: number; y: number } | null>(null);
  const dragCounterRef = useRef(0);

  const handleGlobalDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    // Only respond to drags containing files
    if (e.dataTransfer.types.includes('Files')) {
      setGlobalDragOver(true);
      setIsHunting(true);
      setHuntOrigin({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleGlobalDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Update cursor position for hunting animation
    if (e.dataTransfer.types.includes('Files')) {
      setHuntOrigin({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleGlobalDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setGlobalDragOver(false);
      setIsHunting(false);
      setHuntOrigin(null);
    }
  }, []);

  const handleGlobalDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setGlobalDragOver(false);
    setIsHunting(false);
    setHuntOrigin(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      // Switch to library panel so CaptureModal can render
      window.dispatchEvent(
        new CustomEvent('theseus:switch-panel', { detail: { panel: 'library' } }),
      );
      // Dispatch capture event with pre-loaded files (LibraryPanel listens)
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('theseus:capture-open', { detail: { files } }),
        );
      });
    }
  }, []);

  const contextValue = useMemo(() => ({
    gridRef,
    galaxyControllerRef,
    askState,
    setAskState,
    response,
    setResponse,
    directive,
    setDirective,
    dataStatus,
    setDataStatus,
    vizPrediction,
    setVizPrediction,
    argumentView,
    setArgumentView,
    sourceTrail,
    addToSourceTrail,
    clearSourceTrail,
    mouthOpenRef,
    isHunting,
    huntOrigin,
  }), [gridRef, askState, response, directive, dataStatus, vizPrediction, argumentView, sourceTrail, setAskState, setResponse, setDirective, setDataStatus, setVizPrediction, setArgumentView, addToSourceTrail, clearSourceTrail, mouthOpenRef, isHunting, huntOrigin]);

  return (
    <GalaxyContext.Provider value={contextValue}>
      {/* Sidebar + mobile nav are rendered by layout.tsx.
          Galaxy (TheseusDotGrid + GalaxyController) is rendered by
          the Explorer page, not the shell. The shell is now a pure
          context provider + adaptive-nav predictor. */}
      <div
        className="theseus-content"
        onDragEnter={handleGlobalDragEnter}
        onDragOver={handleGlobalDragOver}
        onDragLeave={handleGlobalDragLeave}
        onDrop={handleGlobalDrop}
      >
        {children}

        {/* Global drop overlay hint */}
        {globalDragOver && (
          <div className="capture-drop-overlay">
            <div className="capture-drop-overlay-inner">
              <span className="capture-drop-overlay-text">Drop to add to your graph</span>
            </div>
          </div>
        )}

        {/* Ambient transmission line: one-line rolling readout of real
            backend signals (graph weather, hypotheses, recent activity).
            Always visible, always peripheral — the "eavesdropping on the
            machine" metaphor at its most distilled. */}
        <TransmissionLine />
      </div>
    </GalaxyContext.Provider>
  );
}
