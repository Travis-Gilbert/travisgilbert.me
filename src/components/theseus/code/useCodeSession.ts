'use client';

import { useCallback, useState } from 'react';
import {
  type AgentId,
  type ChatMessage,
  type CodeFile,
  type Plugin,
  type StreamingEdit,
  type Suggestion,
  MOCK_FILES,
  MOCK_CODE,
  MOCK_EDITS,
  MOCK_SUGGESTIONS,
  DEFAULT_PLUGINS,
} from './agents';
import { useStreamingEdits } from './useStreamingEdits';

export interface CodeSession {
  files: CodeFile[];
  activeFile: string;
  openFiles: string[];
  code: string;
  setCode: (code: string) => void;
  isEditing: boolean;
  editProgress: number;
  streamingEdits: StreamingEdit[];
  activeAgents: AgentId[];
  messages: ChatMessage[];
  suggestions: Suggestion[];
  plugins: Plugin[];
  selectFile: (path: string) => void;
  sendMessage: (text: string) => void;
  togglePlugin: (id: string) => void;
  handleSuggestionAction: (suggestion: Suggestion) => void;
}

export function useCodeSession(): CodeSession {
  const [activeFile, setActiveFile] = useState(MOCK_FILES[1].path);
  const [openFiles, setOpenFiles] = useState([MOCK_FILES[1].path]);
  const [isEditing, setIsEditing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(MOCK_SUGGESTIONS);
  const [activeAgents, setActiveAgents] = useState<AgentId[]>([]);
  const [plugins, setPlugins] = useState<Plugin[]>(DEFAULT_PLUGINS);
  const [code, setCode] = useState(MOCK_CODE);
  const [pendingEdits, setPendingEdits] = useState<StreamingEdit[]>([]);

  // Called by useStreamingEdits via interval callback (not in effect body)
  const handleEditComplete = useCallback(() => {
    setIsEditing(false);
    setActiveAgents([]);
    setMessages((prev) => [
      ...prev,
      { type: 'system' as const, text: '9 lines added' },
      { type: 'theseus' as const, text: 'Done. Added code routing. Want me to wire the L1 retrieval boost in ask_pipeline.py next?' },
    ]);
    setSuggestions((prev) => [
      ...prev,
      {
        type: 'next' as const,
        title: 'Wire L1 retrieval boost',
        body: 'ask_pipeline.py needs a code_debug branch for code object boosting.',
        action: 'Do this next',
        color: 'var(--cw-teal)',
      },
    ]);
  }, []);

  const { editProgress } = useStreamingEdits(pendingEdits, isEditing, 280, handleEditComplete);

  const selectFile = useCallback((path: string) => {
    setActiveFile(path);
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }, []);

  const togglePlugin = useCallback((id: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
    );
  }, []);

  const sendMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { type: 'user', text }]);

    // Phase 1: Retrieval + Graph Walker activate
    setTimeout(() => {
      setActiveAgents(['retrieval', 'walker']);
      setMessages((prev) => [
        ...prev,
        { type: 'agents', agents: ['retrieval', 'walker'] },
        { type: 'system', text: 'Searching graph for answer_router context...' },
      ]);
    }, 300);

    // Phase 2: Evaluator joins
    setTimeout(() => {
      setActiveAgents(['retrieval', 'walker', 'evaluator']);
      setMessages((prev) => [
        ...prev,
        { type: 'system', text: 'Found 14 connected symbols, 3 processes' },
      ]);
    }, 1200);

    // Phase 3: Theseus responds, writer begins
    setTimeout(() => {
      setActiveAgents(['evaluator', 'writer']);
      setMessages((prev) => [
        ...prev,
        {
          type: 'theseus',
          text: "classify_answer_type handles 6 visual types but nothing for code. I'll add 'code' to the valid set and create _CODE_SIGNALS. This function has 8 callers so I'll keep the interface stable.",
        },
        { type: 'system', text: 'Editing answer_router.py' },
      ]);
      setSuggestions((prev) => prev.filter((s) => s.type !== 'tension'));
      setPendingEdits(MOCK_EDITS);
      setIsEditing(true);
    }, 2200);
  }, []);

  const handleSuggestionAction = useCallback(
    (s: Suggestion) => {
      if (s.action === 'Fix this') {
        sendMessage('Add code_debug routing to classify_answer_type');
      }
    },
    [sendMessage],
  );

  return {
    files: MOCK_FILES,
    activeFile,
    openFiles,
    code,
    setCode,
    isEditing,
    editProgress,
    streamingEdits: pendingEdits,
    activeAgents,
    messages,
    suggestions,
    plugins,
    selectFile,
    sendMessage,
    togglePlugin,
    handleSuggestionAction,
  };
}
