'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { toast } from 'sonner';
import {
  gqlEditItem,
  gqlSavePage,
  type ItemGql,
} from '@/lib/commonplace-graphql';
import styles from './FileItemViewer.module.css';

interface FileItemViewerProps {
  item: ItemGql | null;
  resolvedUrl?: string | null;
  onOpenObject?: (id: string) => void;
  onSaved?: () => void;
}

let blockSuiteEffectsReady = false;

function itemUrl(item: ItemGql | null, resolvedUrl?: string | null): string | null {
  if (resolvedUrl) return resolvedUrl;
  if (item?.source?.startsWith('http')) return item.source;
  if (item?.path?.startsWith('http')) return item.path;
  return null;
}

function isPdf(item: ItemGql | null, url: string | null) {
  return item?.mime === 'application/pdf' || url?.toLowerCase().includes('.pdf');
}

function isImage(item: ItemGql | null) {
  return item?.mime?.startsWith('image/') || item?.kind === 'image';
}

function isCanvas(item: ItemGql | null) {
  const marker = `${item?.kind ?? ''} ${item?.classification ?? ''}`.toLowerCase();
  return marker.includes('canvas') || marker.includes('whiteboard');
}

function metadataRows(item: ItemGql) {
  return [
    ['Kind', item.kind],
    ['Residency', item.residency],
    ['Mime', item.mime ?? ''],
    ['Source', item.source ?? ''],
    ['Tags', item.tags.join(', ')],
  ].filter(([, value]) => value);
}

export default function FileItemViewer({
  item,
  resolvedUrl,
  onOpenObject,
  onSaved,
}: FileItemViewerProps) {
  const url = itemUrl(item, resolvedUrl);

  if (!item) {
    return <div className={styles.empty}>Select an item to preview it.</div>;
  }

  let body = <MetadataViewer item={item} />;
  if (isCanvas(item)) body = <BlockSuiteCanvasViewer item={item} />;
  else if (isPdf(item, url)) body = <PdfViewer url={url} />;
  else if (isImage(item) && url) body = <ImageViewer url={url} />;
  else if (item.kind === 'link' && url) body = <LinkViewer item={item} url={url} />;
  else if (item.kind === 'doc' || item.kind === 'note') {
    body = <TiptapItemEditor key={item.id} item={item} onSaved={onSaved} />;
  }

  return (
    <>
      <header className={styles.previewHeader}>
        <div className={styles.previewHeaderText}>
          <strong>{item.title || 'Untitled'}</strong>
          <span>{item.kind}</span>
        </div>
        {url && (
          <a className={styles.button} href={url} target="_blank" rel="noreferrer">
            Open source
          </a>
        )}
        <button type="button" className={styles.button} onClick={() => onOpenObject?.(item.id)}>
          Open object
        </button>
      </header>
      <div className={styles.previewBody}>{body}</div>
    </>
  );
}

function TiptapItemEditor({
  item,
  onSaved,
}: {
  item: ItemGql;
  onSaved?: () => void;
}) {
  const canSaveBody = item.kind === 'doc';
  const [draftTitle, setDraftTitle] = useState(item.title);
  const [draftBody, setDraftBody] = useState(item.bodyText ?? '');
  const [saving, setSaving] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    editable: canSaveBody,
    extensions: [StarterKit],
    content: item.bodyText ?? '',
    onUpdate: ({ editor: nextEditor }) => {
      setDraftBody(nextEditor.getText({ blockSeparator: '\n' }));
    },
  });

  useEffect(() => {
    editor?.setEditable(canSaveBody);
  }, [canSaveBody, editor]);

  const dirty = draftTitle !== item.title || (canSaveBody && draftBody !== (item.bodyText ?? ''));

  async function save() {
    if (!draftTitle.trim()) return;
    setSaving(true);
    try {
      if (canSaveBody) {
        await gqlSavePage({ id: item.id, title: draftTitle.trim(), body: draftBody });
      } else {
        await gqlEditItem({ id: item.id, title: draftTitle.trim() });
      }
      onSaved?.();
      toast.success('Item saved');
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not save item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.editorShell}>
      <input
        className={styles.titleInput}
        value={draftTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        aria-label="Item title"
      />
      {!canSaveBody && (
        <div className={styles.readOnlyNotice}>
          This Item type opens in TipTap for reading. The current API only persists body edits for doc Items.
        </div>
      )}
      <div className={styles.tiptapFrame}>
        <EditorContent editor={editor} />
      </div>
      <button type="button" className={styles.button} disabled={!dirty || saving} onClick={() => void save()}>
        {saving ? 'Saving' : 'Save'}
      </button>
    </div>
  );
}

function BlockSuiteCanvasViewer({ item }: { item: ItemGql }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let disposeDoc: (() => void) | null = null;

    Promise.all([
      import('@blocksuite/presets'),
      import('@blocksuite/presets/effects'),
    ]).then(([presets, effectsModule]) => {
      if (disposed || !host) return;
      if (!blockSuiteEffectsReady && !customElements.get('page-editor')) {
        effectsModule.effects();
        blockSuiteEffectsReady = true;
      }
      const { init } = presets.createEmptyDoc();
      const initialized = init();
      const paragraph = initialized.getBlockByFlavour('affine:paragraph')[0];
      if (paragraph) {
        initialized.updateBlock(paragraph, {
          text: new initialized.Text(item.bodyText || item.title),
        });
      }
      const editorElement = document.createElement('page-editor') as HTMLElement & { doc?: unknown };
      editorElement.doc = initialized;
      editorElement.className = styles.blocksuiteHost;
      host.replaceChildren(editorElement);
      disposeDoc = () => {
        editorElement.remove();
        initialized.dispose();
      };
    });

    return () => {
      disposed = true;
      disposeDoc?.();
      host.replaceChildren();
    };
  }, [item.bodyText, item.id, item.title]);

  return <div ref={hostRef} className={styles.blocksuiteFrame} />;
}

function PdfViewer({ url }: { url: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return undefined;
    let cancelled = false;
    let cancelRender: (() => void) | null = null;

    import('pdfjs-dist')
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
        const loadingTask = pdfjs.getDocument({ url });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.35 });
        const context = canvas.getContext('2d');
        if (!context) return;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const renderTask = page.render({ canvas, canvasContext: context, viewport });
        cancelRender = () => renderTask.cancel();
        await renderTask.promise;
        await pdf.cleanup();
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not render PDF');
      });

    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [url]);

  if (!url) return <div className={styles.empty}>This PDF item does not have a reachable URL.</div>;

  return (
    <div className={styles.pdfFrame}>
      {error ? <div className={styles.empty}>{error}</div> : <canvas ref={canvasRef} className={styles.pdfCanvas} />}
    </div>
  );
}

function ImageViewer({ url }: { url: string }) {
  return <div className={styles.imageFrame} style={{ backgroundImage: `url("${url}")` }} aria-label="Image preview" />;
}

function LinkViewer({ item, url }: { item: ItemGql; url: string }) {
  return (
    <div className={styles.linkFrame}>
      <strong>{item.title || url}</strong>
      <span className={styles.readOnlyNotice}>{item.bodyText || item.source}</span>
      <a className={styles.button} href={url} target="_blank" rel="noreferrer">
        Open link
      </a>
    </div>
  );
}

function MetadataViewer({ item }: { item: ItemGql }) {
  const rows = useMemo(() => metadataRows(item), [item]);
  return (
    <dl className={styles.metaList}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
