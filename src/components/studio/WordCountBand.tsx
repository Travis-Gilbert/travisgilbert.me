'use client';

import type { Editor } from '@tiptap/react';
import { useSessionTimer, formatSessionTime } from '@/lib/studio-session';
import SprintTimer from './SprintTimer';

/**
 * Word count band fixed to the bottom of the editor paper.
 *
 * Shows word count as the primary stat (36px JetBrains Mono, colored by stage),
 * plus character count, reading time, paragraph count,
 * and session focus analytics (active time + words written).
 */
export default function WordCountBand({
  editor,
  stageColor,
}: {
  editor: Editor | null;
  stageColor?: string;
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
    <div className="studio-word-count-band">
      {/* Primary: word count */}
      <span
        className="studio-word-count-primary"
        style={{ color: stageColor ?? '#6A5E52' }}
      >
        {words.toLocaleString()}
      </span>
      <span className="studio-word-count-label">
        words
      </span>

      {/* Divider */}
      <span className="studio-word-count-divider" />

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
          <span className="studio-word-count-divider" />
          <Stat
            label="session"
            value={formatSessionTime(session.activeSeconds)}
            color={session.isActive ? '#B45A2D' : undefined}
          />
          {session.wordsWritten > 0 && (
            <Stat
              label="written"
              value={`+${session.wordsWritten}`}
              color="#B45A2D"
            />
          )}
        </>
      )}

      {/* Sprint timer (right edge) */}
      {session.activeSeconds === 0 && <span style={{ flex: 1 }} />}
      <SprintTimer editor={editor} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span className="studio-word-count-stat">
      <span
        className="studio-word-count-stat-value"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      <span className="studio-word-count-stat-label">
        {label}
      </span>
    </span>
  );
}
