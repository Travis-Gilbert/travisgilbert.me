'use client';

import type { Editor } from '@tiptap/react';

/**
 * Word count band fixed to the bottom of the editor.
 *
 * Shows word count as the primary stat (large JetBrains Mono),
 * plus character count, reading time, and paragraph count.
 */
export default function WordCountBand({
  editor,
}: {
  editor: Editor | null;
}) {
  if (!editor) return null;

  const chars = editor.storage.characterCount?.characters() ?? 0;
  const words = editor.storage.characterCount?.words() ?? 0;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  /* Count paragraphs by traversing the doc */
  let paragraphs = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'paragraph' && node.textContent.length > 0) {
      paragraphs++;
    }
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '20px',
        padding: '8px 20px',
        borderTop: '1px solid var(--studio-border)',
        backgroundColor: 'var(--studio-surface)',
        flexShrink: 0,
      }}
    >
      {/* Primary: word count */}
      <span
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--studio-text-bright)',
          lineHeight: 1,
        }}
      >
        {words.toLocaleString()}
      </span>
      <span
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '11px',
          color: 'var(--studio-text-3)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
        }}
      >
        words
      </span>

      {/* Divider */}
      <span
        style={{
          width: '1px',
          height: '14px',
          backgroundColor: 'var(--studio-border)',
          alignSelf: 'center',
        }}
      />

      {/* Secondary stats */}
      <Stat label="chars" value={chars.toLocaleString()} />
      <Stat label="min read" value={String(readingTime)} />
      <Stat label="paragraphs" value={String(paragraphs)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: 'flex',
        gap: '4px',
        alignItems: 'baseline',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--studio-font-mono)',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--studio-text-2)',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: 'var(--studio-font-body)',
          fontSize: '10px',
          color: 'var(--studio-text-3)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </span>
    </span>
  );
}
