'use client';

import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { tags } from '@lezer/highlight';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import type { StreamingEdit, AgentId } from './agents';

interface CodeEditorProps {
  code: string;
  onCodeChange?: (code: string) => void;
  language: string;
  streamingEdits?: StreamingEdit[];
  editProgress?: number;
  activeAgents?: AgentId[];
}

// Theseus dark theme matching --cw-* palette
const theseusTheme = EditorView.theme({
  '&': {
    backgroundColor: '#131517',
    color: '#e8e4df',
    height: '100%',
    fontSize: '13px',
  },
  '.cm-content': {
    fontFamily: "'JetBrains Mono', monospace",
    fontFeatureSettings: "'liga' 1, 'calt' 1",
    lineHeight: '22px',
    caretColor: '#5fb3a1',
    padding: '12px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: '#5fb3a1',
    borderLeftWidth: '2px',
  },
  '.cm-gutters': {
    backgroundColor: '#131517',
    color: '#5a555033',
    border: 'none',
    paddingRight: '8px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: '#5a555066',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(95, 179, 161, 0.04)',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(95, 179, 161, 0.2) !important',
  },
  '.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(95, 179, 161, 0.2) !important',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'rgba(95, 179, 161, 0.15)',
    outline: '1px solid rgba(95, 179, 161, 0.3)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(212, 165, 74, 0.2)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(212, 165, 74, 0.35)',
  },
  '.cm-scroller': {
    scrollbarWidth: 'none',
  },
  '.cm-scroller::-webkit-scrollbar': {
    display: 'none',
  },
  // Streaming insert lines
  '.cm-theseus-insert': {
    backgroundColor: 'rgba(107, 212, 155, 0.03)',
    borderLeft: '2px solid #3a8a5a',
  },
}, { dark: true });

// Syntax colors matching the code workshop palette
const theseusHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#c4704b' },
  { tag: tags.controlKeyword, color: '#c4704b' },
  { tag: tags.operatorKeyword, color: '#c4704b' },
  { tag: tags.definitionKeyword, color: '#c4704b' },
  { tag: tags.moduleKeyword, color: '#c4704b' },
  { tag: tags.self, color: '#c4704b' },
  { tag: tags.bool, color: '#c4704b' },
  { tag: tags.null, color: '#c4704b' },
  { tag: tags.string, color: '#6bd49b' },
  { tag: tags.regexp, color: '#6bd49b' },
  { tag: tags.comment, color: '#4a4540' },
  { tag: tags.lineComment, color: '#4a4540' },
  { tag: tags.blockComment, color: '#4a4540' },
  { tag: tags.docComment, color: '#4a4540' },
  { tag: tags.function(tags.definition(tags.variableName)), color: '#5fb3a1' },
  { tag: tags.function(tags.variableName), color: '#5fb3a1' },
  { tag: tags.definition(tags.className), color: '#d4a54a' },
  { tag: tags.className, color: '#d4a54a' },
  { tag: tags.typeName, color: '#d4a54a' },
  { tag: tags.number, color: '#9b7abf' },
  { tag: tags.integer, color: '#9b7abf' },
  { tag: tags.float, color: '#9b7abf' },
  { tag: tags.meta, color: '#6b9fd4' },
  { tag: tags.attributeName, color: '#6b9fd4' },
  { tag: tags.operator, color: '#7a7570' },
  { tag: tags.punctuation, color: '#7a7570' },
  { tag: tags.bracket, color: '#7a7570' },
  { tag: tags.variableName, color: '#e8e4df' },
  { tag: tags.propertyName, color: '#e8e4df' },
]);

function languageExtension(lang: string): Extension {
  switch (lang) {
    case 'python': return python();
    case 'javascript':
    case 'typescript':
    case 'jsx':
    case 'tsx': return javascript({ jsx: true, typescript: lang.includes('ts') });
    case 'json': return json();
    case 'markdown': return markdown();
    default: return python();
  }
}

export default function CodeEditor({
  code,
  onCodeChange,
  language,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onCodeChange);
  onChangeRef.current = onCodeChange;

  // Stable update listener
  const updateListener = useCallback(() => {
    return EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current?.(update.state.doc.toString());
      }
    });
  }, []);

  // Create editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        indentOnInput(),
        bracketMatching(),
        highlightSelectionMatches(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        languageExtension(language),
        syntaxHighlighting(theseusHighlight),
        theseusTheme,
        updateListener(),
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only create once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Sync external code changes (e.g. from streaming edits or file switching)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== code) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: code,
        },
      });
    }
  }, [code]);

  return (
    <div
      ref={containerRef}
      className="cw-editor"
      role="tabpanel"
    />
  );
}
