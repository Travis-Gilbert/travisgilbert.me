'use client';

import { useEffect } from 'react';
import { dispatchTheseusEvent, type TheseusView } from '@/lib/theseus/events';

/**
 * Global keyboard shortcuts for Theseus. Bound at the Shell level so
 * every panel participates. Shortcuts do not fire when focus is inside
 * a text-editing element (textarea, input, or contenteditable) unless
 * explicitly allow-listed.
 */
// Atlas Places ordering. ⌘1-6 jump across the sidebar.
const VIEW_BY_DIGIT: Record<string, TheseusView> = {
  '1': 'ask',
  '2': 'explorer',
  '3': 'connections',
  '4': 'plugins',
  '5': 'intelligence',
  '6': 'notebook',
};

function isEditingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'input' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useTheseusKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const editing = isEditingContext(e.target);

      // Cmd/Ctrl + <digit> switches panels.
      if (mod && VIEW_BY_DIGIT[e.key]) {
        e.preventDefault();
        dispatchTheseusEvent('theseus:switch-panel', {
          panel: VIEW_BY_DIGIT[e.key],
          source: 'keyboard',
        });
        return;
      }

      // Escape closes the topmost overlay via a global event any panel
      // can listen for.
      if (e.key === 'Escape' && !editing) {
        window.dispatchEvent(new CustomEvent('theseus:escape'));
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
