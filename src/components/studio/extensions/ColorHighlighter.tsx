import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const hexColorRegex = /#([0-9a-fA-F]{3}){1,2}\b/g;

function findColors(doc: any): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text = node.text || '';
    let match;
    hexColorRegex.lastIndex = 0;
    while ((match = hexColorRegex.exec(text)) !== null) {
      const to = pos + match.index + match[0].length;
      const color = match[0];

      decorations.push(
        Decoration.widget(to, () => {
          const swatch = document.createElement('span');
          swatch.className = 'studio-color-swatch';
          swatch.style.backgroundColor = color;
          return swatch;
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

const ColorHighlighter = Extension.create({
  name: 'colorHighlighter',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('colorHighlighter'),
        state: {
          init(_, state) {
            return findColors(state.doc);
          },
          apply(tr, prev) {
            if (!tr.docChanged) return prev;
            return findColors(tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export default ColorHighlighter;
