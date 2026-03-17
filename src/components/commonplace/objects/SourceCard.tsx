'use client';

import type { ObjectCardProps } from './ObjectRenderer';
export default function SourceCard({ object, compact, onClick, onContextMenu }: ObjectCardProps) {
  const domain = object.og_site_name ?? (object.url ? extractDomain(object.url) : null);
  const title = object.og_title ?? object.display_title ?? object.title;
  const desc = object.og_description;
  const img = object.og_image;

  return (
    <button
      type="button"
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, object) : undefined}
      onClick={onClick ? () => onClick(object) : undefined}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'var(--cp-card)',
        border: 'none',
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 120ms ease',
      }}
      className="cp-object-card cp-object-source"
    >
      {!compact && img && (
        <div style={{
          height: 80,
          background: `url(${img}) center/cover no-repeat`,
          borderBottom: '1px solid var(--cp-border-faint)',
        }} />
      )}
      <div style={{ padding: compact ? '8px 10px' : '10px 12px' }}>
        <div style={{
          fontFamily: 'var(--cp-font-title)',
          fontSize: compact ? 13 : 15,
          fontWeight: 500,
          color: 'var(--cp-text)',
          lineHeight: 1.3,
          fontFeatureSettings: 'var(--cp-kern-title)',
          marginBottom: desc && !compact ? 5 : 4,
        }}>
          {title}
        </div>
        {!compact && desc && (
          <div style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-muted)',
            lineHeight: 1.5,
            fontFeatureSettings: 'var(--cp-kern-body)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            marginBottom: 8,
          }}>
            {desc}
          </div>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {object.url && (
            <div style={{
              width: 14,
              height: 14,
              borderRadius: 2,
              background: 'var(--cp-surface-hover)',
              backgroundImage: `url(https://www.google.com/s2/favicons?domain=${encodeURIComponent(object.url)}&sz=16)`,
              backgroundSize: 'cover',
              flexShrink: 0,
            }} />
          )}
          {domain && (
            <span style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-text-faint)',
              fontFeatureSettings: 'var(--cp-kern-mono)',
            }}>
              {domain}
            </span>
          )}
          {(object.edge_count ?? 0) > 0 && (
            <span style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 10,
              color: 'var(--cp-text-faint)',
              marginLeft: 'auto',
            }}>
              {object.edge_count} links
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}
