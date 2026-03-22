'use client';

import TiptapEditor from '@/components/studio/TiptapEditor';
import type { TiptapUpdatePayload } from '@/components/studio/TiptapEditor';
import type { Editor } from '@tiptap/react';

/**
 * CommonPlace writing surface: wraps TiptapEditor with CP theming.
 *
 * Applies `.cp-editor-wrapper` class for scoped prose styles
 * (cream background, warm text, parchment feel). Does not fork
 * TiptapEditor; all extensions, slash commands, wiki links, and
 * mentions are inherited.
 */
export default function CommonPlaceEditor({
  initialContent,
  initialContentFormat = 'markdown',
  onUpdate,
  onEditorReady,
  placeholder = 'Begin writing. Use / for commands, [[ for links...',
  toolbar,
}: {
  initialContent?: string;
  initialContentFormat?: 'html' | 'markdown';
  onUpdate?: (payload: TiptapUpdatePayload) => void;
  onEditorReady?: (editor: Editor) => void;
  placeholder?: string;
  toolbar?: React.ReactNode;
}) {
  return (
    <div className="cp-editor-wrapper">
      <TiptapEditor
        initialContent={initialContent}
        initialContentFormat={initialContentFormat}
        onUpdate={onUpdate}
        onEditorReady={onEditorReady}
        typewriterMode={false}
        placeholder={placeholder}
        toolbar={toolbar}
      />
    </div>
  );
}
