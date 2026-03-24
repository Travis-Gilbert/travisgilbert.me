'use client';

import type { NotebookObjectCompact } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';

export function getDomain(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function assignTier(
  edgeCount: number,
  maxEdges: number,
): 1 | 2 | 3 {
  if (maxEdges === 0) return 3;
  const ratio = edgeCount / maxEdges;
  if (ratio >= 0.5) return 1;
  if (ratio >= 0.1) return 2;
  return 3;
}

export default function ObjectRow({
  obj,
  tier,
  onOpen,
}: {
  obj: NotebookObjectCompact;
  tier: 1 | 2 | 3;
  onOpen?: (id: number, title?: string) => void;
}) {
  const type = getObjectTypeIdentity(obj.object_type);
  const domain = getDomain(obj.url);
  const isQuote = obj.object_type === 'quote';

  if (tier === 1) return <Tier1 obj={obj} type={type} domain={domain} isQuote={isQuote} onOpen={onOpen} />;
  if (tier === 2) return <Tier2 obj={obj} type={type} domain={domain} isQuote={isQuote} onOpen={onOpen} />;
  return <Tier3 obj={obj} type={type} domain={domain} isQuote={isQuote} onOpen={onOpen} />;
}

/* ── Tier 1: title + body preview + full metadata ── */

function Tier1({
  obj,
  type,
  domain,
  isQuote,
  onOpen,
}: {
  obj: NotebookObjectCompact;
  type: { label: string; color: string };
  domain: string | null;
  isQuote: boolean;
  onOpen?: (id: number, title?: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(obj.id, obj.title)}
      style={{
        display: 'block',
        width: '100%',
        padding: '12px 4px',
        borderBottom: '1px solid var(--cp-border-faint)',
        background: 'none',
        border: 'none',
        borderBlockEnd: '1px solid var(--cp-border-faint)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          'rgba(42, 37, 32, 0.03)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: type.color,
            flexShrink: 0,
            marginTop: 5,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: isQuote
                ? 'var(--cp-font-title)'
                : 'var(--cp-font-title)',
              fontSize: 14.5,
              fontWeight: isQuote ? 400 : 600,
              fontStyle: isQuote ? 'italic' : 'normal',
              color: 'var(--cp-text)',
              lineHeight: 1.35,
              marginBottom: 4,
            }}
          >
            {obj.title}
          </div>
          {obj.body_preview && !isQuote && (
            <div
              style={{
                fontFamily: 'var(--font-body, IBM Plex Sans, sans-serif)',
                fontSize: 11.5,
                fontWeight: 300,
                color: 'var(--cp-text-muted)',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
                marginBottom: 6,
              }}
            >
              {obj.body_preview}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9.5,
                fontWeight: 500,
                color: '#4A7A5A',
                background: 'rgba(74, 122, 90, 0.08)',
                padding: '2px 7px',
                borderRadius: 3,
              }}
            >
              {obj.edge_count} connections
            </span>
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: type.color,
                opacity: 0.7,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.06em',
              }}
            >
              {type.label}
            </span>
            {domain && (
              <span
                style={{
                  fontFamily: 'var(--cp-font-mono)',
                  fontSize: 9,
                  color: 'var(--cp-text-faint)',
                }}
              >
                {domain}
              </span>
            )}
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: 'var(--cp-text-ghost)',
                marginLeft: 'auto',
              }}
            >
              {timeAgo(obj.captured_at)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

/* ── Tier 2: title + connections + time ── */

function Tier2({
  obj,
  type,
  domain,
  isQuote,
  onOpen,
}: {
  obj: NotebookObjectCompact;
  type: { label: string; color: string };
  domain: string | null;
  isQuote: boolean;
  onOpen?: (id: number, title?: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(obj.id, obj.title)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 4px',
        width: '100%',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          'rgba(42, 37, 32, 0.03)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: type.color,
          flexShrink: 0,
          marginTop: 6,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-body, IBM Plex Sans, sans-serif)',
            fontSize: 13,
            fontWeight: 500,
            fontStyle: isQuote ? 'italic' : 'normal',
            color: 'var(--cp-text)',
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {obj.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 2,
          }}
        >
          {obj.edge_count > 0 && (
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: 'var(--cp-text-faint)',
              }}
            >
              {obj.edge_count} conn
            </span>
          )}
          {domain && (
            <span
              style={{
                fontFamily: 'var(--cp-font-mono)',
                fontSize: 9,
                color: 'var(--cp-text-ghost)',
              }}
            >
              {domain}
            </span>
          )}
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 9,
              color: 'var(--cp-text-ghost)',
              marginLeft: 'auto',
            }}
          >
            {timeAgo(obj.captured_at)}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── Tier 3: compact single line ── */

function Tier3({
  obj,
  type,
  domain,
  isQuote,
  onOpen,
}: {
  obj: NotebookObjectCompact;
  type: { label: string; color: string };
  domain: string | null;
  isQuote: boolean;
  onOpen?: (id: number, title?: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(obj.id, obj.title)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'background 120ms ease',
        width: '100%',
        background: 'none',
        border: 'none',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          'rgba(42, 37, 32, 0.04)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: type.color,
          flexShrink: 0,
          opacity: 0.8,
        }}
      />
      <span
        style={{
          fontFamily: isQuote
            ? 'var(--cp-font-title)'
            : 'var(--font-body, IBM Plex Sans, sans-serif)',
          fontSize: 12.5,
          fontWeight: 400,
          fontStyle: isQuote ? 'italic' : 'normal',
          color: 'var(--cp-text-muted)',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}
      >
        {obj.title}
      </span>
      {domain && (
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'var(--cp-text-ghost)',
            flexShrink: 0,
          }}
        >
          {domain}
        </span>
      )}
      {obj.edge_count > 0 && (
        <span
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 9,
            color: 'var(--cp-text-faint)',
            flexShrink: 0,
            minWidth: 16,
            textAlign: 'right',
          }}
        >
          {obj.edge_count}
        </span>
      )}
    </button>
  );
}
