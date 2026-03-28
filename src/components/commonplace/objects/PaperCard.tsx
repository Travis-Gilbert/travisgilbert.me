'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

/**
 * PaperCard: literal page on a desk. Near-zero border-radius, drop shadow,
 * corner fold, strict typographic hierarchy (Title, Authors, Venue, Abstract).
 */

export default function PaperCard({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const abstract = readString(object.body) ?? readString(object.og_description) ?? readString(object.explanation);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const provenance = readString(object.source_label);

  const authors = readString(object.authors) ?? readString(object.og_site_name);
  const venue = readString(object.venue);
  const doi = readString(object.doi);
  const citations = typeof object.citation_count === 'number' ? object.citation_count : null;
  const pages = typeof object.page_count === 'number' ? object.page_count : null;

  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-paper" data-type="paper" data-compact={compact || undefined} {...handler}>
        <div className="cp-obj-title">{title}</div>
        {authors && <div style={{ fontFamily: 'var(--cp-font-body)', fontSize: 12, fontStyle: 'italic', color: 'var(--cp-text-muted)', marginTop: 2 }}>{authors}</div>}
        {venue && <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)', marginTop: 2 }}>{venue}</div>}
        <div className="cp-obj-meta" style={{ marginTop: 4 }}>
          {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
          {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount} links</span>}
        </div>
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-paper" data-type="paper" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {citations !== null && <span className="cp-obj-edges">{citations} cit.</span>}
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-paper" data-type="paper" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
    const supportingSignals = readStringArray(object.supporting_signal_labels);
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-paper" data-type="paper" {...handler}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span className="cp-obj-type-badge"><span className="cp-obj-dot" />{identity.label}</span>
          {score && <span className="cp-obj-edges" style={{ color: 'var(--cp-text-faint)', fontSize: 10 }}>{score}</span>}
        </div>
        <div className="cp-obj-title">{title}</div>
        {signalLabel && <div className="cp-obj-signal">{signalLabel}</div>}
        {abstract && <div className="cp-obj-body">{abstract}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {supportingSignals.slice(0, 2).map((s) => (
            <span key={`${object.slug}-${s}`} className="cp-obj-supporting-signal">{s}</span>
          ))}
          {edgeCount > 0 && <span className="cp-obj-edges" style={{ marginLeft: 'auto', color: 'var(--cp-text-faint)', fontSize: 10 }}>{edgeCount} links</span>}
        </div>
      </button>
    );
  }

  /* Default (card) variant: page-on-desk with corner fold */
  const isExpanded = variant === 'default' && !compact;

  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'var(--cp-paper-surface, rgba(232,228,223,0.06))',
        border: '1px solid var(--cp-paper-border, rgba(232,228,223,0.1))',
        borderRadius: 1,
        padding: compact ? '8px 10px' : '14px 16px',
        cursor: 'pointer', position: 'relative',
        boxShadow: '2px 2px 8px rgba(0,0,0,0.3), -1px 0 0 rgba(232,228,223,0.04)',
      }}
      className="cp-object-card cp-object-paper"
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '2px 3px 12px rgba(0,0,0,0.4)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '2px 2px 8px rgba(0,0,0,0.3), -1px 0 0 rgba(232,228,223,0.04)'; }}
    >
      {/* Corner fold */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 20, height: 20,
        background: 'linear-gradient(225deg, var(--cp-bg, #F5F0E8) 50%, var(--cp-paper-fold, rgba(232,228,223,0.12)) 50%)',
      }} />

      {/* Title */}
      <div style={{
        fontFamily: 'var(--cp-font-title)', fontSize: compact ? 14 : 17, fontWeight: 700,
        color: 'var(--cp-text)', lineHeight: 1.3,
        paddingRight: 24, /* avoid corner fold */
      }}>{title}</div>

      {/* Authors */}
      {authors && (
        <div style={{
          fontFamily: 'var(--cp-font-body)', fontSize: 12, fontStyle: 'italic',
          color: 'var(--cp-text-muted)', marginTop: 4,
        }}>{authors}</div>
      )}

      {/* Venue */}
      {venue && (
        <div style={{
          fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)',
          marginTop: 3,
        }}>{venue}</div>
      )}

      {/* Horizontal rule */}
      {isExpanded && abstract && (
        <hr style={{
          border: 'none', borderTop: '1px solid var(--cp-paper-border, rgba(232,228,223,0.08))',
          margin: '10px 0 8px',
        }} />
      )}

      {/* Abstract */}
      {isExpanded && abstract && (
        <>
          <div style={{
            fontFamily: 'var(--cp-font-mono)', fontSize: 8, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--cp-text-dim)', marginBottom: 4,
          }}>Abstract</div>
          <div style={{
            fontFamily: 'var(--cp-font-body)', fontSize: 13, color: 'var(--cp-text-muted)',
            lineHeight: 1.55, textAlign: 'justify',
            display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{abstract}</div>
        </>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {doi && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)' }}>{doi}</span>}
        {pages !== null && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)' }}>{pages}pp</span>}
        {citations !== null && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)' }}>{citations} citations</span>}
        {provenance && (
          <span style={{
            fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)',
            background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3,
          }}>{provenance}</span>
        )}
        {edgeCount > 0 && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', marginLeft: 'auto' }}>{edgeCount} links</span>}
      </div>
    </button>
  );
}
