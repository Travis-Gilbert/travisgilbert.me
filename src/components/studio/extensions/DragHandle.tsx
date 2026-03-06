import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const dragHandlePluginKey = new PluginKey('dragHandle');

const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: dragHandlePluginKey,
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.forEach((node, pos) => {
              if (node.isBlock) {
                const handle = document.createElement('div');
                handle.className = 'studio-drag-handle';
                handle.contentEditable = 'false';
                handle.draggable = true;
                handle.textContent = '\u2630'; // trigram icon

                handle.addEventListener('mousedown', () => {
                  const wrapper = handle.closest('[data-node-view-wrapper]');
                  if (wrapper) {
                    wrapper.setAttribute('draggable', 'true');
                  }
                });

                decorations.push(
                  Decoration.widget(pos, handle, {
                    side: -1,
                    key: `drag-${pos}`,
                  }),
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

export default DragHandle;
