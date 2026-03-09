import { Mark, markInputRule } from '@tiptap/core';

/**
 * InlineComment mark: wraps text in a purple italic annotation style.
 *
 * Input rule: ++text++ applies the mark on the closing ++
 * Keyboard:   Cmd+Shift+C (Mac) / Ctrl+Shift+C (Windows/Linux)
 * HTML:       <span data-inline-comment> ... </span>
 */
const InlineComment = Mark.create({
  name: 'inlineComment',

  parseHTML() {
    return [{ tag: 'span[data-inline-comment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      { 'data-inline-comment': '', class: 'studio-inline-comment', ...HTMLAttributes },
      0,
    ];
  },

  addInputRules() {
    return [
      markInputRule({
        find: /\+\+([^+]+)\+\+$/,
        type: this.type,
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleMark(this.type),
    };
  },
});

export default InlineComment;
