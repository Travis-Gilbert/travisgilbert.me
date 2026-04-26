// Theseus cross-panel event bus contract.
//
// All panel-to-panel coordination goes through these window-level CustomEvents.
// Emitters call `dispatchTheseusEvent`; listeners register through
// `addEventListener` with the typed event map below. Never mutate a sibling
// panel's context, ref, or module-level state directly.
//
// The canonical payload shapes live here so every emitter and listener agrees
// before any wiring is written.

import type { SceneDirective } from '@/lib/theseus-viz/SceneDirective';

export type TheseusView =
  | 'ask'
  | 'explorer'
  | 'intelligence'
  | 'notebook'
  | 'connections'
  | 'plugins'
  | 'code';

export type TheseusStage =
  | 'retrieving'
  | 'ranking'
  | 'composing'
  | 'rendering'
  | 'complete'
  | 'error';

export interface SwitchPanelDetail {
  /** Primary key. Matches PanelManager's listener shape. */
  panel: TheseusView;
  source?: 'sidebar' | 'chat-directive' | 'keyboard' | 'url' | 'node-action';
}

export interface ApplyDirectiveDetail {
  directive: SceneDirective;
  source: 'chat' | 'deeplink' | 'notebook';
}

export interface StageEventDetail {
  stage: TheseusStage;
  label?: string;
  messageId?: string;
}

export interface PrefillAskDetail {
  text: string;
  submit?: boolean;
  context?: { nodeId?: string; modelId?: string; sourceId?: string };
}

export interface ChatFollowupDetail {
  originalMessageId: string;
  text: string;
}

export interface ExplorerIngestCompleteDetail {
  /** Increments on every successful ingest run. Listeners can key effects
   *  on this number to force a re-probe when DuckDB tables have been
   *  rebuilt with fresh data. */
  generation: number;
  nodeCount: number;
  edgeCount: number;
}

export interface CaptureOpenDetail {
  /** Either a file drop or a URL reference from an ingest bar. */
  files?: File[];
  url?: string;
  /** Where the capture came from; used by CaptureModal for UX copy. */
  source?: string;
}

export interface CaptureCompleteDetail {
  /** Terminal status of a single capture attempt. */
  status: 'ok' | 'error';
  /** Matches the ``source`` field dispatched on the matching
   *  ``theseus:capture-open`` when present. Consumers like the Atlas
   *  ingest bar filter on this so they only react to their own
   *  submissions, not every capture across the app. */
  source?: string;
  /** Display label: for URL captures this is the URL, for file
   *  captures the filename. Optional. */
  label?: string;
  /** Error message when ``status === 'error'``. */
  error?: string;
}

export interface TheseusEventMap {
  'theseus:switch-panel':        SwitchPanelDetail;
  'theseus:capture-open':        CaptureOpenDetail;
  'theseus:capture-complete':    CaptureCompleteDetail;
  'explorer:apply-directive':    ApplyDirectiveDetail;
  'explorer:ingest-complete':    ExplorerIngestCompleteDetail;
  'theseus:stage-event':         StageEventDetail;
  'theseus:prefill-ask':         PrefillAskDetail;
  'theseus:chat-followup':       ChatFollowupDetail;
}

export type TheseusEventName = keyof TheseusEventMap;

export function dispatchTheseusEvent<N extends TheseusEventName>(
  name: N,
  detail: TheseusEventMap[N],
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<TheseusEventMap[N]>(name, { detail }));
}

/** Typed addEventListener wrapper. Returns an unsubscribe function. */
export function onTheseusEvent<N extends TheseusEventName>(
  name: N,
  handler: (detail: TheseusEventMap[N], event: CustomEvent<TheseusEventMap[N]>) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const wrapped = (e: Event) => {
    const ev = e as CustomEvent<TheseusEventMap[N]>;
    handler(ev.detail, ev);
  };
  window.addEventListener(name, wrapped as EventListener);
  return () => window.removeEventListener(name, wrapped as EventListener);
}
