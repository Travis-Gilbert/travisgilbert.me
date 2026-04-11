'use client';

import { useMemo } from 'react';
import { getFileIcon, formatFileSize } from './fileTypes';
import type { CaptureResult } from './captureApi';

type FileStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'error';

interface FilePreviewProps {
  file: File;
  result?: CaptureResult;
  status: FileStatus;
  error?: string;
  onRemove: () => void;
}

/**
 * Basic markdown to safe JSX transform.
 * Handles: **bold**, *italic*, # headings (capped at h3),
 * `inline code`, and newlines to <br />.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings (capped at h3)
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      nodes.push(
        <strong key={`h-${i}`} style={{ display: 'block', marginTop: 8, marginBottom: 4 }}>
          {headingMatch[1]}
        </strong>,
      );
      continue;
    }

    // Process inline formatting
    const parts = processInline(line, i);
    nodes.push(...parts);
    if (i < lines.length - 1) {
      nodes.push(<br key={`br-${i}`} />);
    }
  }

  return nodes;
}

function processInline(text: string, lineIdx: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Split by formatting markers: **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      nodes.push(<strong key={`b-${lineIdx}-${partIdx++}`}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      nodes.push(<em key={`i-${lineIdx}-${partIdx++}`}>{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      nodes.push(
        <code
          key={`c-${lineIdx}-${partIdx++}`}
          style={{ fontFamily: 'var(--vie-font-mono)', fontSize: '0.9em', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}
        >
          {match[4]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export default function FilePreview({
  file,
  result,
  status,
  error,
  onRemove,
}: FilePreviewProps) {
  const icon = useMemo(() => getFileIcon(file.name), [file.name]);
  const size = useMemo(() => formatFileSize(file.size), [file.size]);
  const bodyPreview = result?.object?.body_preview?.slice(0, 300);

  return (
    <div style={{
      background: 'rgba(15,16,18,0.76)',
      backdropFilter: 'blur(18px)',
      border: '1px solid rgba(244,243,240,0.08)',
      borderRadius: 10,
      padding: '14px 16px',
      position: 'relative',
    }}>
      {/* Header: icon, filename, size, remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{
          fontFamily: 'var(--vie-font-body)',
          fontSize: 14,
          color: 'var(--vie-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 240,
          flex: 1,
        }}>
          {file.name}
        </span>
        <span style={{
          fontFamily: 'var(--vie-font-mono)',
          fontSize: 11,
          color: 'var(--vie-text-dim)',
          flexShrink: 0,
        }}>
          {size}
        </span>
        <button
          type="button"
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: 'var(--vie-text-muted)',
            fontSize: 16,
            lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label={`Remove ${file.name}`}
        >
          &times;
        </button>
      </div>

      {/* Status indicator */}
      {status === 'pending' && (
        <span style={{ fontFamily: 'var(--vie-font-mono)', fontSize: 11, color: 'var(--vie-text-dim)' }}>
          Waiting...
        </span>
      )}

      {status === 'uploading' && (
        <div style={{
          height: 3,
          borderRadius: 2,
          background: 'rgba(80,75,70,0.2)',
          overflow: 'hidden',
        }}>
          <div className="capture-shimmer-bar" />
        </div>
      )}

      {status === 'processing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="capture-pulse-dot" />
          <span style={{ fontFamily: 'var(--vie-font-mono)', fontSize: 11, color: 'var(--vie-text-dim)' }}>
            Engine processing...
          </span>
        </div>
      )}

      {status === 'error' && (
        <span style={{ fontFamily: 'var(--vie-font-mono)', fontSize: 12, color: 'var(--vie-terra-light)' }}>
          {error ?? 'Upload failed'}
        </span>
      )}

      {status === 'complete' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {/* Type badge */}
          <span style={{
            display: 'inline-block',
            alignSelf: 'flex-start',
            padding: '2px 8px',
            borderRadius: 999,
            background: 'rgba(74,138,150,0.15)',
            color: 'var(--vie-teal-light)',
            fontFamily: 'var(--vie-font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {result.inferred_type}
          </span>

          {/* Title */}
          <span style={{
            fontFamily: 'var(--vie-font-title)',
            fontSize: 16,
            color: 'var(--vie-text)',
            fontWeight: 400,
          }}>
            {result.object.title}
          </span>

          {/* Body preview (rendered markdown) */}
          {bodyPreview && (
            <div style={{
              fontFamily: 'var(--vie-font-body)',
              fontSize: 13,
              color: 'var(--vie-text-muted)',
              lineHeight: 1.6,
            }}>
              {renderMarkdown(bodyPreview)}
            </div>
          )}

          {/* Success indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20 6L9 17l-5-5"
                stroke="#5BA87A"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 11,
              color: '#5BA87A',
            }}>
              Added to graph
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
