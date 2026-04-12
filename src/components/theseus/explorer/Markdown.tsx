'use client';

import type { ReactNode } from 'react';

/**
 * Render inline markdown: bold, italic, inline code, links.
 * Order matters: bold (**) must match before italic (*).
 */
function renderInline(text: string): ReactNode[] | string {
  const parts: ReactNode[] = [];
  const re = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={k++}>{text.slice(last, match.index)}</span>);
    }
    if (match[2]) {
      parts.push(
        <strong key={k++} style={{ color: 'var(--vie-teal-ink)', fontWeight: 600 }}>
          {match[2]}
        </strong>,
      );
    } else if (match[4]) {
      parts.push(
        <em key={k++} style={{ fontStyle: 'italic', color: 'var(--vie-ink-1)' }}>
          {match[4]}
        </em>,
      );
    } else if (match[6]) {
      parts.push(
        <code
          key={k++}
          style={{
            fontFamily: 'var(--vie-font-mono)',
            fontSize: '0.88em',
            background: 'var(--vie-panel-card)',
            padding: '1px 5px',
            borderRadius: 3,
          }}
        >
          {match[6]}
        </code>,
      );
    } else if (match[8]) {
      parts.push(
        <a
          key={k++}
          href={match[9]}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--vie-teal-ink)',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            textDecorationThickness: 1,
          }}
        >
          {match[8]}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(<span key={k++}>{text.slice(last)}</span>);
  }

  return parts.length > 0 ? parts : text;
}

interface MarkdownProps {
  text: string;
}

export default function Markdown({ text }: MarkdownProps) {
  if (!text) return null;

  return text.split(/\n\n+/).map((block, bi) => {
    const t = block.trim();

    // H3: lines starting with ###
    if (/^### /.test(t)) {
      return (
        <h3
          key={bi}
          style={{
            fontFamily: 'var(--vie-font-title)',
            fontSize: 17,
            fontWeight: 500,
            color: 'var(--vie-ink-1)',
            margin: '28px 0 10px',
            lineHeight: 1.35,
          }}
        >
          {renderInline(t.slice(4))}
        </h3>
      );
    }

    // H2: lines starting with ##
    if (/^## /.test(t)) {
      return (
        <h2
          key={bi}
          style={{
            fontFamily: 'var(--vie-font-title)',
            fontSize: 19,
            fontWeight: 500,
            color: 'var(--vie-ink-1)',
            margin: '32px 0 12px',
            lineHeight: 1.3,
          }}
        >
          {renderInline(t.slice(3))}
        </h2>
      );
    }

    // Unordered list: lines starting with - or *
    if (/^[-*] /.test(t)) {
      const items = t.split(/\n/).filter((l) => /^\s*[-*] /.test(l));
      return (
        <ul
          key={bi}
          style={{
            margin: '4px 0 18px',
            paddingLeft: 22,
            color: 'var(--vie-ink-2)',
            fontSize: 15,
            lineHeight: 1.8,
          }}
        >
          {items.map((item, ii) => (
            <li key={ii} style={{ marginBottom: 6, paddingLeft: 2 }}>
              {renderInline(item.replace(/^\s*[-*] /, ''))}
            </li>
          ))}
        </ul>
      );
    }

    // Paragraph
    return (
      <p key={bi} style={{ marginBottom: 18 }}>
        {renderInline(t)}
      </p>
    );
  });
}
