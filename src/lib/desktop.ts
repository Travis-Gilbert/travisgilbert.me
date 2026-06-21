'use client';

/**
 * Dependency-free Tauri bridge for CommonPlace desktop mode (SPEC-9 D4/D5).
 *
 * Avoids the `@tauri-apps/api` dependency by calling the runtime-injected
 * `window.__TAURI_INTERNALS__.invoke` directly, so the web bundle stays clean
 * and nothing here runs outside the desktop shell. `isTauri()` gates the
 * desktop-only panels (co-browser / coordination / receiver) so they never
 * render or dial in a plain browser tab.
 *
 * The typed wrappers mirror the shell's `#[tauri::command]` surface
 * (apps/desktop/src-tauri/src/lib.rs, contract in apps/desktop/src/lib/commands.ts).
 */

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

interface TauriInternals {
  invoke(cmd: string, args?: Record<string, unknown>): Promise<unknown>;
}

function internals(): TauriInternals | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { __TAURI_INTERNALS__?: TauriInternals };
  return w.__TAURI_INTERNALS__ ?? null;
}

/** Invoke a desktop command. Throws when called outside the Tauri runtime. */
export async function invoke<T>(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const bridge = internals();
  if (!bridge) {
    throw new Error(`Tauri command "${cmd}" called outside the desktop runtime`);
  }
  return bridge.invoke(cmd, args) as Promise<T>;
}

/* ── Receiver (local agent execution) ───────────────────────────── */

export interface ReceiverStatus {
  enabled: boolean;
  state: string;
  lanes: string[];
  lastClaimTime?: string | null;
  lastJobResult?: string | null;
}

export interface ReceiverSettings {
  enabled: boolean;
  claimIntervalSecs: number;
  worktrees: Record<string, string>;
}

export const receiverStatus = () => invoke<ReceiverStatus>('receiver_status');
export const receiverSettingsGet = () => invoke<ReceiverSettings>('receiver_settings_get');
export const receiverSettingsSet = (settings: ReceiverSettings) =>
  invoke<void>('receiver_settings_set', { settings });

/* ── Coordination room ──────────────────────────────────────────── */

export interface RoomFeedItem {
  id: string;
  actor: string;
  text: string;
  createdAt?: string | null;
  kind?: string | null;
}
export interface RoomParticipant {
  actor: string;
  status: string;
  lastSeen?: string | null;
}
export interface RoomIntentItem {
  actor: string;
  status: string;
  summary: string;
  footprint: string[];
  updatedAt?: string | null;
}
export interface RoomRecordItem {
  id: string;
  kind: string;
  actor?: string | null;
  title?: string | null;
  summary: string;
  refs: string[];
  createdAt?: string | null;
}
export interface RoomContext {
  feed: RoomFeedItem[];
  participants: RoomParticipant[];
  intents: RoomIntentItem[];
  records: RoomRecordItem[];
}

export const roomContext = (roomId: string) =>
  invoke<RoomContext>('room_context', { roomId });
export const roomPostMessage = (roomId: string, message: string) =>
  invoke<void>('room_post_message', { input: { roomId, message } });

/* ── Co-browser (human + agent shared browsing) ─────────────────── */

export interface PageContext {
  url: string;
  title: string;
  text: string;
}
export interface AgentIngestionReceipt {
  id: string;
  status: string;
  url: string;
  title?: string | null;
  message: string;
}

export const tabCreate = (tabId: string, url?: string) =>
  invoke<void>('tab_create', { tabId, url: url ?? null });
export const tabNavigate = (tabId: string, url: string) =>
  invoke<void>('tab_navigate', { tabId, url });
export const tabSetActive = (tabId: string | null) =>
  invoke<void>('tab_set_active', { tabId });
export const extractVisibleText = (tabId: string) =>
  invoke<PageContext>('extract_visible_text', { tabId });
export const agentTabIngest = (input: {
  tabId: string;
  url: string;
  title?: string;
  text: string;
}) => invoke<AgentIngestionReceipt>('agent_tab_ingest', { input });
