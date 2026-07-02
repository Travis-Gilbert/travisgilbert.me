'use client';

/**
 * Shared state for the CommonPlace code surface (HANDOFF-CODE-SURFACE-UI).
 * One zustand store; the shell, conversation column, transcript, diff cards,
 * environment panel, editor tabs, terminal drawer, omnibox, and browser slot
 * all read from and write to this shape. Plumbing (binding ids, worktree
 * paths, bridge state) lives here and only renders behind the dev toggle.
 */

import { create } from 'zustand';
import type {
  CommonPlaceCodeAccessLevel,
  CommonPlaceCodeMode,
  CommonPlaceCodeRunRecord,
  CommonPlaceCodeStatus,
} from '@/lib/commonplace-code';
import { newCommonPlaceCodeConversationId } from '@/lib/commonplace-code';

export type CenterTabKind = 'conversation' | 'file' | 'browser';

export interface CenterTab {
  id: string; // 'conversation', 'browser', or the file path
  kind: CenterTabKind;
  label: string;
  /** file tabs: unsaved buffer state */
  dirty?: boolean;
}

export interface CodeChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  runId?: string;
}

export interface CodeSurfaceState {
  conversationId: string;
  status: CommonPlaceCodeStatus | null;
  statusError: string | null;
  messages: CodeChatMessage[];
  runs: CommonPlaceCodeRunRecord[];
  /** composer controls (D3): all three attach to the dispatched run */
  mode: CommonPlaceCodeMode;
  accessLevel: CommonPlaceCodeAccessLevel;
  head: string;
  /** layout (D2): open regions; sizes persist via react-resizable-panels autoSaveId */
  rightPanelOpen: boolean;
  terminalOpen: boolean;
  devToggle: boolean;
  centerTabs: CenterTab[];
  activeCenterTab: string;
  /** bridge state (plumbing; dev toggle only) */
  runtimeAvailable: boolean | null;
  omniboxOpen: boolean;

  setStatus: (status: CommonPlaceCodeStatus | null, error?: string | null) => void;
  addMessage: (message: CodeChatMessage) => void;
  upsertRun: (run: CommonPlaceCodeRunRecord) => void;
  setComposerControl: (patch: Partial<Pick<CodeSurfaceState, 'mode' | 'accessLevel' | 'head'>>) => void;
  setRightPanelOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
  setDevToggle: (on: boolean) => void;
  setRuntimeAvailable: (available: boolean | null) => void;
  setOmniboxOpen: (open: boolean) => void;
  openTab: (tab: CenterTab) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  markTabDirty: (id: string, dirty: boolean) => void;
}

const CONVERSATION_TAB: CenterTab = { id: 'conversation', kind: 'conversation', label: 'Conversation' };

export const useCodeSurfaceStore = create<CodeSurfaceState>((set) => ({
  conversationId: newCommonPlaceCodeConversationId(),
  status: null,
  statusError: null,
  messages: [],
  runs: [],
  mode: 'plan',
  accessLevel: 'read',
  head: 'composed',
  rightPanelOpen: true,
  terminalOpen: false,
  devToggle: false,
  centerTabs: [CONVERSATION_TAB],
  activeCenterTab: 'conversation',
  runtimeAvailable: null,
  omniboxOpen: false,

  setStatus: (status, error = null) => set({ status, statusError: error }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  upsertRun: (run) =>
    set((s) => {
      const index = s.runs.findIndex((r) => r.id === run.id);
      if (index < 0) return { runs: [...s.runs, run] };
      const runs = s.runs.slice();
      runs[index] = run;
      return { runs };
    }),
  setComposerControl: (patch) => set(patch),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  setTerminalOpen: (terminalOpen) => set({ terminalOpen }),
  setDevToggle: (devToggle) => set({ devToggle }),
  setRuntimeAvailable: (runtimeAvailable) => set({ runtimeAvailable }),
  setOmniboxOpen: (omniboxOpen) => set({ omniboxOpen }),
  openTab: (tab) =>
    set((s) => {
      const exists = s.centerTabs.some((t) => t.id === tab.id);
      return {
        centerTabs: exists ? s.centerTabs : [...s.centerTabs, tab],
        activeCenterTab: tab.id,
      };
    }),
  closeTab: (id) =>
    set((s) => {
      if (id === 'conversation') return s; // the primary column does not close
      const centerTabs = s.centerTabs.filter((t) => t.id !== id);
      const activeCenterTab =
        s.activeCenterTab === id ? centerTabs[centerTabs.length - 1]?.id ?? 'conversation' : s.activeCenterTab;
      return { centerTabs, activeCenterTab };
    }),
  activateTab: (activeCenterTab) => set({ activeCenterTab }),
  markTabDirty: (id, dirty) =>
    set((s) => ({
      centerTabs: s.centerTabs.map((t) => (t.id === id ? { ...t, dirty } : t)),
    })),
}));
