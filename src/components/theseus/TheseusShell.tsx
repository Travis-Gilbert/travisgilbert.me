'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import '@/components/theseus/capture/capture.css';
import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';
import type { VizPrediction } from '@/lib/theseus/sceneDirector/predictor';
import type { SourceTrailItem } from './SourceTrail';
import { useNavScreenState } from './useNavScreenState';
import {
  NAV_ACTIONS,
  initNavModel,
  predictNav,
  recordNavSignal,
  trainNavModel,
  type NavActionId,
} from '@/lib/theseus/navPredictor';
import { warmUpModels } from '@/lib/theseus/sceneDirector/predictor';
import TransmissionLine from '@/components/theseus/TransmissionLine';
import DotGrid from '@/components/DotGrid';
import TheseusErrorBoundary from '@/components/theseus/TheseusErrorBoundary';
import { useTheseusKeyboardShortcuts } from '@/components/theseus/useKeyboardShortcuts';

/**
 * Theseus runtime context. Panels read the cross-panel scene directive, the
 * three-class viz prediction, the source-trail accumulator, and the
 * file-drop hunting state from here.
 */
interface TheseusContextValue {
  directive: SceneDirective | null;
  setDirective: (d: SceneDirective | null) => void;

  prediction: VizPrediction | null;
  setPrediction: (p: VizPrediction | null) => void;

  sourceTrail: SourceTrailItem[];
  addToSourceTrail: (item: SourceTrailItem) => void;
  clearSourceTrail: () => void;

  isHunting: boolean;
  huntOrigin: { x: number; y: number } | null;
}

const TheseusContext = createContext<TheseusContextValue | null>(null);

export function useTheseus(): TheseusContextValue {
  const ctx = useContext(TheseusContext);
  if (!ctx) throw new Error('useTheseus must be used within TheseusShell');
  return ctx;
}

/** @deprecated prefer useTheseus. Retained as an alias for legacy imports. */
export const useGalaxy = useTheseus;

export default function TheseusShell({ children }: { children: React.ReactNode }) {
  useTheseusKeyboardShortcuts();
  const [directive, setDirective] = useState<SceneDirective | null>(null);
  const [prediction, setPrediction] = useState<VizPrediction | null>(null);
  const [sourceTrail, setSourceTrail] = useState<SourceTrailItem[]>([]);

  const addToSourceTrail = useCallback((item: SourceTrailItem) => {
    setSourceTrail((prev) => {
      if (prev.some((p) => p.objectId === item.objectId)) return prev;
      const next = [item, ...prev];
      return next.length > 20 ? next.slice(0, 20) : next;
    });
  }, []);

  const clearSourceTrail = useCallback(() => setSourceTrail([]), []);

  useEffect(() => {
    warmUpModels().catch(() => {});
  }, []);

  // Adaptive nav predictor: still accumulates training signals. Button
  // rendering waits on a DOM-based attractor UI.
  const navScreenState = useNavScreenState({
    engineState: 'idle',
    hasActiveQuery: false,
  });
  const signalCountRef = useRef(0);
  const ignoreTimersRef = useRef<Map<string, number>>(new Map());
  const lastShownButtonsRef = useRef<Set<string>>(new Set());
  const predictTimerRef = useRef<number | null>(null);

  useEffect(() => {
    initNavModel().catch(() => {});
  }, []);

  const maybeTrainAndSave = useCallback(async () => {
    if (signalCountRef.current % 10 !== 0) return;
    try {
      await trainNavModel();
    } catch {
      // non-fatal: training is best-effort
    }
  }, []);

  useEffect(() => {
    if (predictTimerRef.current !== null) {
      window.clearTimeout(predictTimerRef.current);
    }

    let cancelled = false;
    predictTimerRef.current = window.setTimeout(() => {
      predictNav(navScreenState).then((p) => {
        if (cancelled) return;
        const buttons = p.actions.map((a) => {
          const action = NAV_ACTIONS.find((x) => x.id === a.id);
          return { id: a.id, label: a.label, icon: action?.icon };
        });
        if (buttons.length === 0) return;

        const newIds = new Set<string>(buttons.map((b) => b.id));
        for (const [id, timerId] of ignoreTimersRef.current) {
          if (!newIds.has(id)) {
            window.clearTimeout(timerId);
            ignoreTimersRef.current.delete(id);
          }
        }
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
      }).catch(() => {
        // non-fatal: predictor falls back to cold-start priors
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

  useEffect(() => () => {
    for (const timerId of ignoreTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    ignoreTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string }>).detail ?? {};
      if (detail.action !== 'focusInput') return;
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ query?: string }>).detail;
      if (!detail?.query) return;
      window.dispatchEvent(
        new CustomEvent('theseus:switch-panel', { detail: { panel: 'ask' } }),
      );
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('theseus:prefill-ask', { detail: { query: detail.query } }),
        );
      });
    };
    window.addEventListener('theseus:navigate-ask', handler);
    return () => window.removeEventListener('theseus:navigate-ask', handler);
  }, []);

  // Global file-drop hunt overlay. huntOrigin is stored in a ref and
  // synced to state via rAF to avoid a 60 Hz state update during drag.
  const [globalDragOver, setGlobalDragOver] = useState(false);
  const [isHunting, setIsHunting] = useState(false);
  const [huntOrigin, setHuntOrigin] = useState<{ x: number; y: number } | null>(null);
  const dragCounterRef = useRef(0);
  const huntOriginRef = useRef<{ x: number; y: number } | null>(null);
  const huntRafRef = useRef<number | null>(null);

  const scheduleHuntOriginFlush = useCallback(() => {
    if (huntRafRef.current !== null) return;
    huntRafRef.current = window.requestAnimationFrame(() => {
      huntRafRef.current = null;
      setHuntOrigin(huntOriginRef.current);
    });
  }, []);

  const handleGlobalDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setGlobalDragOver(true);
      setIsHunting(true);
      huntOriginRef.current = { x: e.clientX, y: e.clientY };
      scheduleHuntOriginFlush();
    }
  }, [scheduleHuntOriginFlush]);

  const handleGlobalDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      huntOriginRef.current = { x: e.clientX, y: e.clientY };
      scheduleHuntOriginFlush();
    }
  }, [scheduleHuntOriginFlush]);

  const handleGlobalDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setGlobalDragOver(false);
      setIsHunting(false);
      huntOriginRef.current = null;
      setHuntOrigin(null);
    }
  }, []);

  const handleGlobalDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setGlobalDragOver(false);
    setIsHunting(false);
    huntOriginRef.current = null;
    setHuntOrigin(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      window.dispatchEvent(
        new CustomEvent('theseus:switch-panel', { detail: { panel: 'library' } }),
      );
      requestAnimationFrame(() => {
        window.dispatchEvent(
          new CustomEvent('theseus:capture-open', { detail: { files } }),
        );
      });
    }
  }, []);

  useEffect(() => () => {
    if (huntRafRef.current !== null) {
      window.cancelAnimationFrame(huntRafRef.current);
      huntRafRef.current = null;
    }
  }, []);

  const contextValue = useMemo<TheseusContextValue>(() => ({
    directive,
    setDirective,
    prediction,
    setPrediction,
    sourceTrail,
    addToSourceTrail,
    clearSourceTrail,
    isHunting,
    huntOrigin,
  }), [directive, prediction, sourceTrail, addToSourceTrail, clearSourceTrail, isHunting, huntOrigin]);

  return (
    <TheseusContext.Provider value={contextValue}>
      <div className="theseus-dotgrid-bg" aria-hidden="true">
        <DotGrid />
      </div>

      <div
        className="theseus-content"
        onDragEnter={handleGlobalDragEnter}
        onDragOver={handleGlobalDragOver}
        onDragLeave={handleGlobalDragLeave}
        onDrop={handleGlobalDrop}
      >
        <TheseusErrorBoundary label="theseus-shell">
          {children}
        </TheseusErrorBoundary>

        {globalDragOver && (
          <div className="capture-drop-overlay">
            <div className="capture-drop-overlay-inner">
              <span className="capture-drop-overlay-text">Drop to add to your graph</span>
            </div>
          </div>
        )}

        <TransmissionLine />
      </div>
    </TheseusContext.Provider>
  );
}
