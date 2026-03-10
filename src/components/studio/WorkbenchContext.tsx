'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { Editor as TiptapEditorType } from '@tiptap/react';
import type { StudioContentItem } from '@/lib/studio';
import type { Sheet } from '@/lib/studio-api';

export type WorkbenchSaveState = 'idle' | 'saving' | 'success' | 'error' | 'retrying';
export type WorkbenchAutosaveState = 'idle' | 'saved';

export interface StashItem {
  id: string;
  text: string;
  savedAt: string;
}

export interface StashTask {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  /** The content item this task is attached to */
  contentSlug: string;
  contentType: string;
}

export interface WorkbenchEditorState {
  editor: TiptapEditorType | null;
  contentItem: StudioContentItem | null;
  onSave?: () => void;
  lastSaved: string | null;
  saveState: WorkbenchSaveState;
  autosaveState: WorkbenchAutosaveState;
  stash: StashItem[];
  onRestoreStash?: (id: string) => void;
  onDeleteStash?: (id: string) => void;
  tasks: StashTask[];
  onAddTask?: (text: string) => void;
  onToggleTask?: (id: string) => void;
  onDeleteTask?: (id: string) => void;
  /** Ulysses-style sub-documents (Batch 16) */
  sheets: Sheet[];
  /** UUID of the currently active sheet, or null when sheets mode is off */
  activeSheetId: string | null;
  /** True when at least one sheet exists for this content item */
  isSheetsMode: boolean;
  onSetActiveSheet?: (id: string) => void;
  onAddSheet?: () => void;
  onDeleteSheet?: (id: string) => void;
  onReorderSheets?: (ids: string[]) => void;
  onSplitSheet?: (id: string, position: number) => void;
  onMergeWithNext?: (id: string) => void;
  onToggleMaterial?: (id: string) => void;
}

interface WorkbenchContextValue {
  editorState: WorkbenchEditorState;
  setEditorState: (state: WorkbenchEditorState) => void;
  resetEditorState: () => void;
}

const EMPTY_EDITOR_STATE: WorkbenchEditorState = {
  editor: null,
  contentItem: null,
  onSave: undefined,
  lastSaved: null,
  saveState: 'idle',
  autosaveState: 'idle',
  stash: [],
  onRestoreStash: undefined,
  onDeleteStash: undefined,
  tasks: [],
  onAddTask: undefined,
  onToggleTask: undefined,
  onDeleteTask: undefined,
  sheets: [],
  activeSheetId: null,
  isSheetsMode: false,
  onSetActiveSheet: undefined,
  onAddSheet: undefined,
  onDeleteSheet: undefined,
  onReorderSheets: undefined,
  onSplitSheet: undefined,
  onMergeWithNext: undefined,
  onToggleMaterial: undefined,
};

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function StudioWorkbenchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [editorState, setEditorStateValue] = useState<WorkbenchEditorState>(
    EMPTY_EDITOR_STATE,
  );

  const setEditorState = useCallback((state: WorkbenchEditorState) => {
    setEditorStateValue(state);
  }, []);

  const resetEditorState = useCallback(() => {
    setEditorStateValue(EMPTY_EDITOR_STATE);
  }, []);

  return (
    <WorkbenchContext.Provider
      value={{ editorState, setEditorState, resetEditorState }}
    >
      {children}
    </WorkbenchContext.Provider>
  );
}

export function useStudioWorkbench(): WorkbenchContextValue {
  const context = useContext(WorkbenchContext);
  if (!context) {
    throw new Error('useStudioWorkbench must be used within StudioWorkbenchProvider');
  }
  return context;
}
