import { getNodeTypeIdentity } from '@/lib/networks';
import type { NodeListItem } from '@/lib/networks';

/**
 * NodeCard: a single knowledge node in the inbox feed.
 *
 * Shows type-colored left accent, title or URL domain, body excerpt,
 * and OG preview when available. Server Component (no client state needed
 * for the card itself; interactivity lives in the parent).
 */
export default function NodeCard({ node }: { node: NodeListItem }) {
  const typeInfo = getNodeTypeIdentity(node.node_type_slug);
  const title = node.display_title || node.title || extractDomain(node.url);
  const hasUrl = Boolean(node.url);

  return (
    <div className="nw-node-card" style={{ position: 'relative' }}>
      {/* Type color accent: left border */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: 2,
          backgroundColor: typeInfo.color,
          opacity: 0.6,
        }}
      />

      <div style={{ paddingLeft: 8 }}>
        {/* Header row: type label + timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--nw-font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: typeInfo.color,
              opacity: 0.8,
            }}
          >
            {typeInfo.label}
          </span>
          <span
            style={{
              fontFamily: 'var(--nw-font-mono)',
              fontSize: 10,
              color: 'var(--nw-text-faint)',
            }}
          >
            {formatTimestamp(node.captured_at)}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: 'var(--nw-font-title)',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--nw-text)',
            lineHeight: 1.35,
            marginBottom: hasUrl ? 4 : 0,
          }}
        >
          {title}
        </div>

        {/* URL domain hint */}
        {hasUrl && (
          <div
            style={{
              fontFamily: 'var(--nw-font-mono)',
              fontSize: 11,
              color: 'var(--nw-text-faint)',
              marginBottom: 4,
            }}
          >
            {extractDomain(node.url)}
          </div>
        )}

        {/* Status indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
          }}
        >
          {node.is_starred && (
            <span
              style={{ fontSize: 12, color: 'var(--nw-gold)' }}
              title="Starred"
            >
              &#9733;
            </span>
          )}
          {node.is_pinned && (
            <span
              style={{
                fontFamily: 'var(--nw-font-mono)',
                fontSize: 9,
                color: 'var(--nw-terracotta)',
                letterSpacing: '0.05em',
              }}
            >
              PINNED
            </span>
          )}
          {node.edge_count > 0 && (
            <span
              style={{
                fontFamily: 'var(--nw-font-mono)',
                fontSize: 10,
                color: 'var(--nw-text-faint)',
              }}
            >
              {node.edge_count} connection{node.edge_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────── */

function extractDomain(url: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function formatTimestamp(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}
