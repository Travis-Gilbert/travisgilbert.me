import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import IframeEmbedView from './IframeEmbedView';

export interface IframeEmbedOptions {
  allowFullscreen: boolean;
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    iframe: {
      setIframe: (options: { src: string; height?: number }) => ReturnType;
    };
  }
}

const IframeEmbed = Node.create<IframeEmbedOptions>({
  name: 'iframe',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      allowFullscreen: true,
      HTMLAttributes: { class: 'studio-iframe-wrapper' },
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      height: { default: 480 },
      frameborder: { default: 0 },
      allowfullscreen: {
        default: true,
        parseHTML: () => this.options.allowFullscreen,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-iframe-embed] iframe' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, { 'data-iframe-embed': 'true' }),
      [
        'iframe',
        mergeAttributes(HTMLAttributes, {
          style: `width: 100%; height: ${HTMLAttributes.height || 480}px; border: none; border-radius: 8px;`,
          loading: 'lazy',
          sandbox: 'allow-scripts allow-same-origin allow-popups',
        }),
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(IframeEmbedView);
  },

  addCommands() {
    return {
      setIframe:
        (options) =>
        ({ tr, dispatch }) => {
          const { selection } = tr;
          const node = this.type.create(options);
          if (dispatch) {
            tr.replaceRangeWith(selection.from, selection.to, node);
          }
          return true;
        },
    };
  },
});

export default IframeEmbed;
