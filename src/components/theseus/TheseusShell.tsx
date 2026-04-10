'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

  // Shell-level listener for the contextual nav action that needs to
  // work from any Theseus subpage (not just /theseus where
  // AskExperience is mounted). focusInput must navigate to /theseus
  // first if the user is currently on /theseus/library, /theseus/
  // artifacts, etc. Once there, AskExperience reads ?focus=1 from
  // the URL and focuses its input on mount.
  //
  // The other contextual actions (openTensions, openSources,
  // triggerInvestigation) are handled inside AskExperience because
  // they need access to the most recent ask response. They are
  // intentionally no-ops on subpages.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail ?? {};
      if (detail.action !== 'focusInput') return;
      if (pathname === '/theseus/explorer') {
        // Already on the page that owns AskExperience: forward to
        // its dedicated focus event so it can synchronously focus.
        window.dispatchEvent(new CustomEvent('theseus:focus-ask-input'));
      } else {
        router.push('/theseus/explorer?focus=1');
      }
    };
    window.addEventListener('theseus:nav-action', handler);
    return () => window.removeEventListener('theseus:nav-action', handler);
  }, [pathname, router]);

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
  }), [gridRef, askState, response, directive, dataStatus, vizPrediction, argumentView, sourceTrail, setAskState, setResponse, setDirective, setDataStatus, setVizPrediction, setArgumentView, addToSourceTrail, clearSourceTrail, mouthOpenRef]);

  return (
    <GalaxyContext.Provider value={contextValue}>
      {/* Sidebar + mobile nav are rendered by layout.tsx.
          Galaxy (TheseusDotGrid + GalaxyController) is rendered by
          the Explorer page, not the shell. The shell is now a pure
          context provider + adaptive-nav predictor. */}
      <div className="theseus-content">
        {children}
      </div>
    </GalaxyContext.Provider>
  );
}
