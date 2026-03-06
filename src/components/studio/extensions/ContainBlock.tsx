import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ContainBlockView from './ContainBlockView';

export const CONTAIN_TYPES = [
  'observation',
  'argument',
  'evidence',
  'question',
  'aside',
  'raw',
] as const;

export type ContainType = (typeof CONTAIN_TYPES)[number];

export interface ContainBlockOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    containBlock: {
      setContainBlock: (attrs: { containType: ContainType }) => ReturnType;
      unsetContainBlock: () => ReturnType;
    };
  }
}

const ContainBlock = Node.create<ContainBlockOptions>({
  name: 'containBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      containType: {
        default: 'observation',
        parseHTML: (el) => el.getAttribute('data-contain-type') || 'observation',
        renderHTML: (attrs) => ({ 'data-contain-type': attrs.containType }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-contain-type]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'studio-contain-block',
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ContainBlockView);
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { write: (s: string) => void; renderContent: (n: { content: unknown }) => void }, node: { attrs: { containType: string }; content: unknown }) {
          state.write(`:::${node.attrs.containType}\n`);
          state.renderContent(node as { content: unknown });
          state.write(':::\n');
        },
        parse: {
          /* Custom tokenizer for :::type fences is registered below via inputRules */
        },
      },
    };
  },

  addCommands() {
    return {
      setContainBlock:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs);
        },
      unsetContainBlock:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },
});

export default ContainBlock;
