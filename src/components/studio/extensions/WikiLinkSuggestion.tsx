'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface WikiSuggestionItem {
  id: string;
  title: string;
  source: string;
  text: string;
}

export interface WikiLinkSuggestionOptions {
  onOpen: (query: string, from: number, to: number) => void;
  onClose: () => void;
  onUpdate: (query: string) => void;
}

const pluginKey = new PluginKey('wikiLinkSuggestion');

const WikiLinkSuggestion = Extension.create<WikiLinkSuggestionOptions>({
  name: 'wikiLinkSuggestion',

  addOptions() {
    return {
      onOpen: () => {},
      onClose: () => {},
      onUpdate: () => {},
    };
  },

  addProseMirrorPlugins() {
    const { onOpen, onClose, onUpdate } = this.options;
    let isOpen = false;
    let triggerFrom = 0;

    return [
      new Plugin({
        key: pluginKey,

        state: {
          init() {
            return { active: false, query: '', from: 0 };
          },
          apply(tr, prev) {
            const meta = tr.getMeta(pluginKey);
            if (meta) return meta;
            if (!prev.active) return prev;
            const { from } = tr.selection;
            if (from < prev.from) return { active: false, query: '', from: 0 };
            return prev;
          },
        },

        props: {
          handleTextInput(view, from, _to, text) {
            const state = pluginKey.getState(view.state);

            if (state?.active) {
              setTimeout(() => {
                const newState = view.state;
                const $pos = newState.selection.$from;
                const textBefore = $pos.parent.textBetween(
                  0,
                  $pos.parentOffset,
                  undefined,
                  '\uFFFC',
                );
                const match = textBefore.match(/\[\[([^\]]*?)$/);
                if (match) {
                  onUpdate(match[1]);
                } else {
                  isOpen = false;
                  onClose();
                  view.dispatch(
                    view.state.tr.setMeta(pluginKey, {
                      active: false,
                      query: '',
                      from: 0,
                    }),
                  );
                }
              }, 0);
              return false;
            }

            if (text === '[') {
              const doc = view.state.doc;
              const charBefore =
                from > 0 ? doc.textBetween(from - 1, from) : '';
              if (charBefore === '[') {
                isOpen = true;
                triggerFrom = from - 1;
                onOpen('', triggerFrom, from + 1);
                setTimeout(() => {
                  view.dispatch(
                    view.state.tr.setMeta(pluginKey, {
                      active: true,
                      query: '',
                      from: triggerFrom,
                    }),
                  );
                }, 0);
              }
            }

            return false;
          },

          handleKeyDown(view, event) {
            const state = pluginKey.getState(view.state);
            if (!state?.active) return false;

            if (event.key === 'Escape') {
              isOpen = false;
              onClose();
              view.dispatch(
                view.state.tr.setMeta(pluginKey, {
                  active: false,
                  query: '',
                  from: 0,
                }),
              );
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});

export default WikiLinkSuggestion;
