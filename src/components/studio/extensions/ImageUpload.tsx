import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { STUDIO_API_BASE } from '@/lib/studio';

async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch(`${STUDIO_API_BASE}/upload/image/`, {
      method: 'POST',
      body: formData,
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

const ImageUpload = Extension.create({
  name: 'imageUpload',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('imageUpload'),
        props: {
          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            const imageFiles = Array.from(files).filter((f) =>
              f.type.startsWith('image/'),
            );
            if (imageFiles.length === 0) return false;

            event.preventDefault();

            imageFiles.forEach(async (file) => {
              const url = await uploadImage(file);
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            });

            return true;
          },

          handlePaste(view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;

            const imageItems = Array.from(items).filter((item) =>
              item.type.startsWith('image/'),
            );
            if (imageItems.length === 0) return false;

            event.preventDefault();

            imageItems.forEach(async (item) => {
              const file = item.getAsFile();
              if (!file) return;
              const url = await uploadImage(file);
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            });

            return true;
          },
        },
      }),
    ];
  },
});

export default ImageUpload;
