import { Mark, mergeAttributes } from '@tiptap/core';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, string>;
}

const WikiLink = Mark.create<WikiLinkOptions>({
  name: 'wikiLink',
  inclusive: false,
  excludes: '_',

  addAttributes() {
    return {
      title: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-wiki-title'),
        renderHTML: (attrs) => ({ 'data-wiki-title': attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-wiki-link': 'true',
        class: 'studio-wiki-link',
      }),
      0,
    ];
  },
});

export default WikiLink;
