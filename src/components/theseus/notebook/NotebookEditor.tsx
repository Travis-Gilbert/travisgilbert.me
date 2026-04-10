'use client';

import { useCallback, useState } from 'react';
import NotebookTiptapEditor from './NotebookTiptapEditor';
import type { TiptapUpdatePayload } from './NotebookTiptapEditor';
import WordCountBand from '@/components/studio/WordCountBand';
import type { Editor } from '@tiptap/react';
import type { NotebookDocument } from './NotebookLayout';

interface NotebookEditorProps {
  document: NotebookDocument;
  onUpdate: (html: string) => void;
  onTitleChange: (title: string) => void;
}

/**
 * NotebookEditor: wraps the forked Studio TiptapEditor with all extensions.
 *
 * Provides the title input, TiptapEditor (with contain blocks, slash commands,
 * wiki links, drag handle, code highlighting, etc.), and word count band.
 *
 * The editor surface keeps its light paper aesthetic for readability.
 * Theseus epistemic slash commands (/claim, /tension, /ask, /capture, /connect)
 * are added via the forked slashCommandItems.
 */
export default function NotebookEditor({
  document: doc,
  onUpdate,
  onTitleChange,
}: NotebookEditorProps) {
  const [title, setTitle] = useState(doc.title);
  const [editor, setEditor] = useState<Editor | null>(null);

  const handleUpdate = useCallback(
    (payload: TiptapUpdatePayload) => {
      onUpdate(payload.html);
    },
    [onUpdate],
  );

  const handleEditorReady = useCallback((ed: Editor) => {
    setEditor(ed);
  }, []);

  const handleTitleBlur = useCallback(() => {
    const trimmed = title.trim() || 'Untitled';
    setTitle(trimmed);
    onTitleChange(trimmed);
  }, [title, onTitleChange]);

  return (
    <div className="notebook-editor">
      {/* Title input */}
      <input
        type="text"
        className="notebook-editor-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            editor?.commands.focus('start');
          }
        }}
        placeholder="Untitled"
        spellCheck={false}
      />

      {/* Full Studio TiptapEditor with all extensions + Theseus slash commands */}
      <NotebookTiptapEditor
        initialContent={doc.content}
        initialContentFormat="html"
        onUpdate={handleUpdate}
        onEditorReady={handleEditorReady}
        typewriterMode={false}
        placeholder="Start writing... Use / for commands"
      />

      {/* Word count band (imported directly from Studio) */}
      <WordCountBand editor={editor} />
    </div>
  );
}
