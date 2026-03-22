/**
 * CommonPlace Reader: paragraph parsing, ToC extraction, and reading stats.
 *
 * Pure utility functions with no React dependencies.
 * Used by ReaderContent and ReaderOverlay.
 */

import type { ReaderParagraph } from './reader-data';

/* ─────────────────────────────────────────────────
   Paragraph parsing
   ───────────────────────────────────────────────── */

/**
 * Split a markdown body string into typed paragraphs.
 *
 * Headings (lines starting with ## or ###) become `type: 'heading'`.
 * Blockquotes (lines starting with >) become `type: 'quote'`.
 * Fenced code blocks become `type: 'code'`.
 * The first non-heading, non-quote paragraph becomes `type: 'lead'`.
 * Everything else is `type: 'body'`.
 */
export function parseBodyToParagraphs(body: string): ReaderParagraph[] {
  if (!body || !body.trim()) return [];

  const paragraphs: ReaderParagraph[] = [];
  let seenLead = false;
  let counter = 0;

  // Split on double newlines (paragraph boundaries) but preserve code blocks
  const blocks = splitIntoBlocks(body);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const id = `p${counter++}`;

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const codeContent = trimmed
        .replace(/^```[^\n]*\n?/, '')
        .replace(/\n?```$/, '');
      paragraphs.push({ id, type: 'code', text: codeContent });
      continue;
    }

    // Heading (## or ### level; # is title, handled separately)
    const headingMatch = trimmed.match(/^#{1,6}\s+(.+)$/m);
    if (headingMatch && !trimmed.includes('\n')) {
      paragraphs.push({ id, type: 'heading', text: headingMatch[1] });
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed
        .split('\n')
        .map((line) => line.replace(/^>\s?/, ''))
        .join(' ')
        .trim();
      paragraphs.push({ id, type: 'quote', text: quoteText });
      continue;
    }

    // First body paragraph is the lead
    if (!seenLead) {
      seenLead = true;
      paragraphs.push({ id, type: 'lead', text: trimmed });
      continue;
    }

    // Regular body paragraph
    paragraphs.push({ id, type: 'body', text: trimmed });
  }

  return paragraphs;
}

/**
 * Split markdown into blocks, keeping fenced code blocks intact.
 * Regular paragraphs are split on double newlines.
 */
function splitIntoBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  let inCode = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        // End of code block
        current.push(line);
        blocks.push(current.join('\n'));
        current = [];
        inCode = false;
      } else {
        // Start of code block; flush anything accumulated
        if (current.length > 0) {
          const text = current.join('\n').trim();
          if (text) {
            // Split accumulated text on double newlines
            for (const p of text.split(/\n\n+/)) {
              if (p.trim()) blocks.push(p);
            }
          }
          current = [];
        }
        current.push(line);
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      current.push(line);
      continue;
    }

    // Outside code: accumulate lines
    current.push(line);
  }

  // Flush remaining
  if (current.length > 0) {
    const remaining = current.join('\n').trim();
    if (remaining) {
      if (inCode) {
        // Unterminated code block: treat as code
        blocks.push(remaining);
      } else {
        for (const p of remaining.split(/\n\n+/)) {
          if (p.trim()) blocks.push(p);
        }
      }
    }
  }

  return blocks;
}

/* ─────────────────────────────────────────────────
   Table of Contents
   ───────────────────────────────────────────────── */

/**
 * Extract heading paragraphs for the ToC panel.
 */
export function extractToc(
  paragraphs: ReaderParagraph[],
): { id: string; text: string }[] {
  return paragraphs
    .filter((p) => p.type === 'heading')
    .map((p) => ({ id: p.id, text: p.text }));
}

/* ─────────────────────────────────────────────────
   Word count and reading time
   ───────────────────────────────────────────────── */

/**
 * Count words in a plain text string after stripping markdown syntax.
 */
export function wordCount(text: string): number {
  if (!text) return 0;
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_~`>\[\]()!|]/g, ' ');
  return stripped.split(/\s+/).filter(Boolean).length;
}

/**
 * Estimate reading time at 238 wpm, rounded up to the nearest minute.
 * Returns the number of minutes (minimum 1).
 */
export function readTime(words: number): number {
  return Math.max(1, Math.ceil(words / 238));
}

/**
 * Format reading time for display (e.g., "12 min").
 */
export function formatReadTime(words: number): string {
  return `${readTime(words)} min`;
}
