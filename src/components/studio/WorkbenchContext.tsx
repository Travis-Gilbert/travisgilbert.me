'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import type { Editor as TiptapEditorType } from '@tiptap/react';
import type { StudioContentItem } from '@/lib/studio';

export type WorkbenchSaveState = 'idle' | 'saving' | 'success' | 'error';
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
