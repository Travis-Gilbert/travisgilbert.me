import { Extension } from '@tiptap/core';

export const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.can().sinkListItem('listItem'))
          return editor.commands.sinkListItem('listItem');
        if (editor.can().sinkListItem('taskItem'))
          return editor.commands.sinkListItem('taskItem');
        editor.commands.insertContent('  ');
        return true;
      },
      'Shift-Tab': ({ editor }) => {
        if (editor.can().liftListItem('listItem'))
          return editor.commands.liftListItem('listItem');
        if (editor.can().liftListItem('taskItem'))
          return editor.commands.liftListItem('taskItem');
        return false;
      },
    };
  },
});

export default TabIndent;
