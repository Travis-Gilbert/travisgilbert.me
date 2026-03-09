'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { CONTAIN_TYPES, type ContainType } from './extensions/ContainBlock';

interface ContextMenuProps {
  editor: Editor;
  onStash: (text: string) => void;
  onAddTask: (text: string) => void;
  onSendToCommonPlace?: (text: string) => void;
}

const CONTAIN_META: Record<ContainType, { label: string; color: string }> = {
  observation: { label: 'Observation', color: '#3A8A9A' },
  argument: { label: 'Argument', color: '#B45A2D' },
  evidence: { label: 'Evidence', color: '#D4AA4A' },
  question: { label: 'Question', color: '#8A6A9A' },
  aside: { label: 'Aside', color: '#6A9A5A' },
  raw: { label: 'Raw Material', color: '#7A7268' },
  scene: { label: 'Scene', color: '#B45A2D' },
};

export default function EditorContextMenu({ editor, onStash, onAddTask, onSendToCommonPlace }: ContextMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const hasSelection = useCallback(() => {
    if (!editor) return false;
    const { from, to } = editor.state.selection;
    return from !== to;
  }, [editor]);

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      if (!hasSelection()) return;

      const editorDom = editor.view.dom;
      if (!editorDom.contains(event.target as Node)) return;

      event.preventDefault();
      setPosition({ x: event.clientX, y: event.clientY });
      setVisible(true);
    },
    [editor, hasSelection],
  );

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [handleContextMenu]);

  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, handleClose]);

  const handleStash = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    editor.chain().focus().deleteSelection().run();
    onStash(selectedText);
    handleClose();
  };

  const handleAddTask = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    onAddTask(selectedText);
    handleClose();
  };

  const handleSendToCP = () => {
    if (!editor || !onSendToCommonPlace) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    onSendToCommonPlace(selectedText);
    handleClose();
  };

  const handleContain = (containType: ContainType) => {
    if (!editor) return;
    editor.chain().focus().setContainBlock({ containType }).run();
    handleClose();
  };

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="studio-context-menu"
      style={{ top: position.y, left: position.x }}
    >
      <button
        type="button"
        className="studio-context-item"
        onClick={handleStash}
      >
        <span className="studio-context-icon studio-context-icon-stash">
          &#x2691;
        </span>
        <div className="studio-context-label-group">
          <span className="studio-context-label">Stash for Later</span>
          <span className="studio-context-hint">Remove + save to sidebar</span>
        </div>
        <span className="studio-context-shortcut">&#x21E7;&#x2318;S</span>
      </button>

      <button
        type="button"
        className="studio-context-item"
        onClick={handleAddTask}
      >
        <span className="studio-context-icon" style={{ color: 'var(--studio-tc)' }}>
          &#x2610;
        </span>
        <div className="studio-context-label-group">
          <span className="studio-context-label">Add Task</span>
          <span className="studio-context-hint">Create task from selection</span>
        </div>
      </button>

      {onSendToCommonPlace && (
        <button
          type="button"
          className="studio-context-item"
          onClick={handleSendToCP}
        >
          <span className="studio-context-icon" style={{ color: '#B45A2D' }}>
            &#x25C7;
          </span>
          <div className="studio-context-label-group">
            <span className="studio-context-label">Send to CommonPlace</span>
            <span className="studio-context-hint">Capture as knowledge object</span>
          </div>
        </button>
      )}

      <div className="studio-context-divider" />

      <div className="studio-context-section-label">Contain as...</div>

      {CONTAIN_TYPES.map((type) => {
        const meta = CONTAIN_META[type];
        return (
          <button
            key={type}
            type="button"
            className="studio-context-item"
            onClick={() => handleContain(type)}
          >
            <span
              className="studio-context-color-dot"
              style={{
                borderColor: meta.color,
                backgroundColor: `${meta.color}22`,
              }}
            />
            <span className="studio-context-label">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
