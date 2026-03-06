import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { NodeSelection } from '@tiptap/pm/state';
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
                handle.textContent = '\u2630';

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
          handleDOMEvents: {
            mousedown(view, event) {
              const target = event.target as HTMLElement;
              if (!target.classList.contains('studio-drag-handle')) return false;

              const parent = target.parentElement;
              if (!parent) return false;

              const pos = view.posAtDOM(parent, 0);
              if (pos == null) return false;

              const $pos = view.state.doc.resolve(pos);
              const nodePos = $pos.before($pos.depth);
              const node = view.state.doc.nodeAt(nodePos);
              if (!node) return false;

              const selection = NodeSelection.create(view.state.doc, nodePos);
              view.dispatch(view.state.tr.setSelection(selection));

              return false;
            },
          },
        },
      }),
    ];
  },
});

export default DragHandle;
