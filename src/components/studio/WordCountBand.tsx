'use client';

import type { Editor } from '@tiptap/react';
import { useSessionTimer, formatSessionTime } from '@/lib/studio-session';

/**
 * Word count band fixed to the bottom of the editor.
 *
 * Shows word count as the primary stat (large JetBrains Mono),
 * plus character count, reading time, paragraph count,
 * and session focus analytics (active time + words written).
 */
export default function WordCountBand({
  editor,
}: {
  editor: Editor | null;
}) {
  const editorEl = editor?.view?.dom ?? null;
  const currentWords = editor?.storage.characterCount?.words() ?? 0;
  const session = useSessionTimer(editorEl, currentWords);

  if (!editor) return null;

  const chars = editor.storage.characterCount?.characters() ?? 0;
  const words = editor.storage.characterCount?.words() ?? 0;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  /* Count paragraphs, contain blocks, and wiki-links by traversing the doc */
  let paragraphs = 0;
  let containBlocks = 0;
  const wikiLinkSet = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'paragraph' && node.textContent.length > 0) {
      paragraphs++;
    }
    if (node.type.name === 'containBlock') {
      containBlocks++;
    }
    if (node.isTextblock) {
      const matches = node.textContent.match(/\[\[([^\]]+)\]\]/g);
      if (matches) {
        for (const m of matches) wikiLinkSet.add(m.slice(2, -2));
      }
    }
  });
  const wikiLinks = wikiLinkSet.size;

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

      {wikiLinks > 0 && (
        <Stat label="links" value={String(wikiLinks)} color="#3A8A9A" />
      )}
      {containBlocks > 0 && (
        <Stat label="contained" value={String(containBlocks)} color="#C49A4A" />
      )}

      {/* Session focus analytics (right-aligned) */}
      {session.activeSeconds > 0 && (
        <>
          <span style={{ flex: 1 }} />
          <span
            style={{
              width: '1px',
              height: '14px',
              backgroundColor: 'var(--studio-border)',
              alignSelf: 'center',
            }}
          />
          <Stat
            label="session"
            value={formatSessionTime(session.activeSeconds)}
            color={session.isActive ? 'var(--studio-tc)' : undefined}
          />
          {session.wordsWritten > 0 && (
            <Stat
              label="written"
              value={`+${session.wordsWritten}`}
              color="var(--studio-tc)"
            />
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
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
          color: color ?? 'var(--studio-text-2)',
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
