import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ResizableImageView from './ResizableImageView';

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('width') || el.style.width || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.width) return {};
          return { width: attrs.width, style: `width: ${attrs.width}px` };
        },
      },
      align: {
        default: 'center',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-align': attrs.align }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default ResizableImage;
