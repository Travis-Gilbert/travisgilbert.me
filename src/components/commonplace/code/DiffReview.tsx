'use client';

/**
 * DiffReview (HANDOFF-CODE-SURFACE-UI D5): a large Radix dialog showing one
 * file's diff. Desktop (fine pointer, wide viewport) renders the Monaco
 * DiffEditor side by side (client-only via next/dynamic per the handoff
 * verify note); mobile renders a @codemirror/merge unified view. Content
 * comes from GET /api/commonplace/code/diff. Unsupported (binary or absent)
 * content collapses to one quiet line.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { unifiedMergeView } from '@codemirror/merge';

const MonacoDiffEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.DiffEditor),
  { ssr: false },
);

// Handoff-specified desktop breakpoint for the review dialog: pointer fine
// and width >= 760. A JS layout fork, not a style literal.
const DESKTOP_REVIEW_MIN_WIDTH = 760;

interface DiffPayload {
  supported: boolean;
  path?: string;
  original?: string;
  modified?: string;
  reason?: string;
  error?: string;
}

export function DiffReview({
  path,
  open,
  onOpenChange,
}: {
  path: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [payload, setPayload] = useState<DiffPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    if (!open || !path) {
      setPayload(null);
      return undefined;
    }
    setIsDesktop(
      window.matchMedia('(pointer: fine)').matches &&
        window.innerWidth >= DESKTOP_REVIEW_MIN_WIDTH,
    );
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/commonplace/code/diff?path=${encodeURIComponent(path)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => (await res.json()) as DiffPayload)
      .then((data) => setPayload(data))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setPayload({
          supported: false,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, path]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'var(--surface-translucent)' }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(96vw, calc(var(--space-13) * 14))',
            height: 'min(86vh, calc(var(--space-13) * 10))',
            background: 'var(--surface-1)',
            border: 'var(--hairline)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2) var(--space-3)',
              borderBottom: 'var(--hairline)',
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text--1)',
                fontWeight: 'normal',
                color: 'var(--text-dim)',
              }}
            >
              {path ?? 'diff'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close diff review" style={closeButtonStyle}>
                <X aria-hidden style={{ width: 'var(--space-4)', height: 'var(--space-4)' }} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            {loading && <QuietLine text="Loading diff" />}
            {!loading && payload && !payload.supported && (
              <QuietLine
                text={payload.reason ?? payload.error ?? 'No text diff is available for this file.'}
              />
            )}
            {!loading && payload?.supported && isDesktop && (
              <MonacoDiffEditor
                height="100%"
                original={payload.original ?? ''}
                modified={payload.modified ?? ''}
                options={{
                  readOnly: true,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                }}
              />
            )}
            {!loading && payload?.supported && !isDesktop && (
              <UnifiedMerge original={payload.original ?? ''} modified={payload.modified ?? ''} />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function UnifiedMerge({ original, modified }: { original: string; modified: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const view = new EditorView({
      parent: host,
      doc: modified,
      extensions: [
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.lineWrapping,
        unifiedMergeView({ original, mergeControls: false }),
      ],
    });
    return () => view.destroy();
  }, [original, modified]);

  return (
    <div
      ref={hostRef}
      aria-label="Unified diff"
      style={{
        height: '100%',
        overflow: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text--2)',
      }}
    />
  );
}

function QuietLine({ text }: { text: string }) {
  return (
    <p
      style={{
        margin: 0,
        padding: 'var(--space-3)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text--1)',
        color: 'var(--text-faint)',
      }}
    >
      {text}
    </p>
  );
}

const closeButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'none',
  border: 'none',
  padding: 'var(--space-1)',
  cursor: 'pointer',
  color: 'var(--text-dim)',
};
