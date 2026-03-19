'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, extractDomain, formatDate } from './shared';

export default function SourceCard({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const title = readString(object.og_title) ?? object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const summary = readString(object.body) ?? readString(object.og_description) ?? readString(object.explanation);
  const domain = readString(object.source_label) ?? readString(object.og_site_name) ?? (object.url ? extractDomain(object.url) : null);
  const sourceFormat = readString(object.source_format);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-source" data-type="source" data-compact={compact || undefined} {...handler}>
        <div className="cp-obj-source-gradient" />
        {(domain || sourceFormat || score) && (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, paddingTop: compact ? 0 : 24, flexWrap: 'wrap' }}>
            {domain && <span className="cp-obj-source-domain">{domain}</span>}
            {sourceFormat && <span className="cp-obj-source-format">{sourceFormat}</span>}
            {score && <span className="cp-obj-edges" style={{ marginLeft: 'auto' }}>{score}</span>}
          </div>
        )}
        <div className="cp-obj-title">{title}</div>
        {summary && <div className="cp-obj-body" style={{ marginTop: 4 }}>{summary}</div>}
        {(timestamp || edgeCount > 0) && (
          <div className="cp-obj-meta" style={{ marginTop: 6 }}>
            {timestamp && <span className="cp-obj-timestamp" style={{ color: 'var(--cp-text-faint)' }}>{timestamp}</span>}
            {edgeCount > 0 && <span className="cp-obj-edges" style={{ marginLeft: 'auto', color: 'var(--cp-text-faint)' }}>{edgeCount} links</span>}
          </div>
        )}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-source" data-type="source" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-source" data-type="source" {...handler}>
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
      <button type="button" className="cp-obj cp-obj--dock cp-obj-source" data-type="source" {...handler}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <span className="cp-obj-type-badge"><span className="cp-obj-dot" />{identity.label}</span>
          {score && <span className="cp-obj-edges" style={{ color: 'var(--cp-text-faint)', fontSize: 10 }}>{score}</span>}
        </div>
        <div className="cp-obj-title">{title}</div>
        {signalLabel && <div className="cp-obj-signal">{signalLabel}</div>}
        {summary && <div className="cp-obj-body">{summary}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {supportingSignals.slice(0, 2).map((s) => (
            <span key={`${object.slug}-${s}`} className="cp-obj-supporting-signal">{s}</span>
          ))}
          {edgeCount > 0 && <span className="cp-obj-edges" style={{ marginLeft: 'auto', color: 'var(--cp-text-faint)', fontSize: 10 }}>{edgeCount} links</span>}
        </div>
      </button>
    );
  }

  /* Default variant */
  const domainDefault = object.og_site_name ?? (object.url ? extractDomain(object.url) : null);
  const desc = object.og_description;
  const img = object.og_image;
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'block', width: '100%', textAlign: 'left', background: 'var(--cp-card)', border: 'none',
        borderRadius: 6, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 120ms ease',
      }}
      className="cp-object-card cp-object-source"
    >
      {!compact && img && (
        <div style={{ height: 80, background: `url(${img}) center/cover no-repeat`, borderBottom: '1px solid var(--cp-border-faint)' }} />
      )}
      <div style={{ padding: compact ? '8px 10px' : '10px 12px' }}>
        <div style={{ fontFamily: 'var(--cp-font-title)', fontSize: compact ? 13 : 15, fontWeight: 500, color: 'var(--cp-text)', lineHeight: 1.3, fontFeatureSettings: 'var(--cp-kern-title)', marginBottom: desc && !compact ? 5 : 4 }}>{title}</div>
        {!compact && desc && (
          <div style={{ fontFamily: 'var(--cp-font-body)', fontSize: 12, color: 'var(--cp-text-muted)', lineHeight: 1.5, fontFeatureSettings: 'var(--cp-kern-body)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 }}>{desc}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {object.url && (
            <div style={{ width: 14, height: 14, borderRadius: 2, background: 'var(--cp-surface-hover)', backgroundImage: `url(https://www.google.com/s2/favicons?domain=${encodeURIComponent(object.url)}&sz=16)`, backgroundSize: 'cover', flexShrink: 0 }} />
          )}
          {domainDefault && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', fontFeatureSettings: 'var(--cp-kern-mono)' }}>{domainDefault}</span>}
          {edgeCount > 0 && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', marginLeft: 'auto' }}>{edgeCount} links</span>}
        </div>
      </div>
    </button>
  );
}
