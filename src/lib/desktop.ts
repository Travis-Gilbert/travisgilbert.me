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
    throw new Error(
      `Tauri command "${cmd}" called outside the desktop runtime`,
    );
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
export const receiverSettingsGet = () =>
  invoke<ReceiverSettings>('receiver_settings_get');
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

/**
 * Agent-collaborative browsing (SPEC-9 D5): the engine's pair co-browsing route
 * on the local rustyred-thg node (:17888), control mode `pair`. This is an HTTP
 * call (not invoke), so the node must allow the desktop origin (CORS) — see the
 * note in CoBrowserView. Returns the raw perception/action bundle.
 */
export async function browseWithMe(input: {
  url?: string;
  nextAction?: string;
  confirm?: boolean;
  tenant?: string;
}): Promise<unknown> {
  const tenant = input.tenant ?? 'Travis-Gilbert';
  const res = await fetch(
    `${LOCAL_NODE_URL}/v1/tenants/${tenant}/browser/browse-with-me`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        control_mode: 'pair',
        url: input.url,
        next_action: input.nextAction,
        confirm: input.confirm ?? false,
      }),
    },
  );
  if (!res.ok) throw new Error(`browse-with-me ${res.status}`);
  return res.json();
}

/* ── Native status / keychain / harness / sync (full D4 client) ─────────── */

// ponytail: these ports must match the desktop shell consts (apps/desktop/src-tauri/src/lib.rs).
const LOCAL_NODE_URL =
  process.env.NEXT_PUBLIC_LOCAL_NODE_URL ?? 'http://127.0.0.1:17888';

export type HarnessTarget = 'local' | 'hosted';

export interface HarnessSettings {
  endpoint: string;
  localEndpoint: string;
  activeTarget: HarnessTarget;
  tenant: string;
  bearerPresent: boolean;
}

export interface LocalNodeStatus {
  nodeUp: boolean;
  endpoint: string;
  port: number;
  storePath: string;
  activeTarget: HarnessTarget;
  toolsMatchHosted: boolean;
}

export interface CommonplaceStatusInfo {
  nodeUp: boolean;
  endpoint: string;
  port: number;
  storePath: string;
}

export interface HostedConnectionStatus {
  endpoint: string;
  tenant: string;
  bearerPresent: boolean;
  reachable: boolean;
  documentCount?: number | null;
  message: string;
}

export interface ModelStatus {
  enabled: boolean;
  endpoint: string;
  model: string;
  reachable: boolean;
  message: string;
}

export interface ModelMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ModelChatInput {
  model: 'local' | 'ollama' | 'agent' | string;
  messages: ModelMessage[];
  ollamaEndpoint?: string;
  ollamaModel?: string;
  localEndpoint?: string;
  localModel?: string;
  localProtocol?: 'openai' | 'ollama';
}

export interface ModelChatResult {
  content: string;
  usage?: {
    provider: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    estimatedUsd: number;
  };
}

export interface SyncReceipt {
  id: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  mergedNodes?: number | null;
  mergedEdges?: number | null;
  conflicts?: number | null;
  message: string;
}

export const localNodeStatus = () =>
  invoke<LocalNodeStatus>('local_node_status');
export const commonplaceStatus = () =>
  invoke<CommonplaceStatusInfo>('commonplace_status');
export const hostedConnectionStatus = () =>
  invoke<HostedConnectionStatus>('hosted_connection_status');
export const modelStatus = () => invoke<ModelStatus>('model_status');
export const modelChat = (input: ModelChatInput) =>
  invoke<ModelChatResult>('model_chat', { input });

export const harnessSettingsGet = () =>
  invoke<HarnessSettings | null>('harness_settings_get');
export const harnessSettingsSet = (settings: HarnessSettings) =>
  invoke<void>('harness_settings_set', { settings });
export const harnessBearerSet = (token: string) =>
  invoke<void>('harness_bearer_set', { token });
export const harnessBearerClear = () => invoke<void>('harness_bearer_clear');

export const keychainSet = (provider: string, key: string) =>
  invoke<void>('keychain_set', { provider, key });
export const keychainHas = (provider: string) =>
  invoke<boolean>('keychain_has', { provider });
export const keychainDelete = (provider: string) =>
  invoke<void>('keychain_delete', { provider });

export const syncRun = () => invoke<SyncReceipt>('sync_run');
