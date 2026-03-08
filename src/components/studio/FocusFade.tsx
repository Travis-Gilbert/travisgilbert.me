'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';

/**
 * Hook that manages focus fade mode: dims all paragraphs except the one
 * containing the cursor. Toggled via Cmd+Shift+F.
 */
export function useFocusFade(editor: Editor | null) {
  const [active, setActive] = useState(false);

  // Toggle keyboard shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setActive((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Track cursor position and update .focus-fade-current class
  useEffect(() => {
    if (!editor || !active) {
      // Remove all focus-fade-current classes when inactive
      editor?.view.dom
        .querySelectorAll('.focus-fade-current')
        .forEach((el) => {
          el.classList.remove('focus-fade-current');
        });
      return;
    }

    function updateFocus() {
      if (!editor) return;
      const { from } = editor.state.selection;
      const resolved = editor.state.doc.resolve(from);

      // Find the top-level block node (depth 1 from root)
      const depth = Math.min(resolved.depth, 1);
      let topPos = from;
      if (depth >= 1) {
        topPos = resolved.before(1);
      }

      // Remove old, add new
      editor.view.dom
        .querySelectorAll('.focus-fade-current')
        .forEach((el) => {
          el.classList.remove('focus-fade-current');
        });

      try {
        const domNode = editor.view.nodeDOM(topPos);
        if (domNode instanceof HTMLElement) {
          domNode.classList.add('focus-fade-current');
        }
      } catch {
        // Position may be out of sync during rapid edits
      }
    }

    updateFocus();
    editor.on('selectionUpdate', updateFocus);
    return () => {
      editor.off('selectionUpdate', updateFocus);
      editor.view.dom
        .querySelectorAll('.focus-fade-current')
        .forEach((el) => {
          el.classList.remove('focus-fade-current');
        });
    };
  }, [editor, active]);

  return { active, toggle: useCallback(() => setActive((p) => !p), []) };
}
