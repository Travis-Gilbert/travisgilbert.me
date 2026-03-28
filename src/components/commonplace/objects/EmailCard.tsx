'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

/**
 * EmailCard: two-part envelope container (header strip + body).
 * Header: blue tint wash with From/To/Subject/Thread fields.
 * Body: standard card below. Chip collapses to envelope icon + sender + title.
 */

export default function EmailCard({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const summary = readString(object.body) ?? readString(object.og_description) ?? readString(object.explanation);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const provenance = readString(object.source_label);

  const fromName = readString(object.email_from) ?? readString(object.og_site_name);
  const toName = readString(object.email_to);
  const threadCount = typeof object.thread === 'number' && object.thread > 1 ? object.thread : null;

  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-email" data-type="email" data-compact={compact || undefined} {...handler}>
        <div className="cp-obj-title">{title}</div>
        {fromName && <div style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', marginTop: 2 }}>{fromName}</div>}
        {!compact && summary && <div className="cp-obj-body">{summary}</div>}
        <div className="cp-obj-meta" style={{ marginTop: 4 }}>
          {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
          {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount} links</span>}
        </div>
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-email" data-type="email" {...handler}
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <EnvelopeIcon />
        {fromName && <span style={{ fontFamily: 'var(--cp-font-body)', fontSize: 12, color: 'var(--cp-text-muted)' }}>{fromName.split(' ')[0]}</span>}
        <span className="cp-obj-title">{title}</span>
        {provenance && <span className="cp-obj-provenance">{provenance}</span>}
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-email" data-type="email" {...handler}>
        <EnvelopeIcon />
        <span className="cp-obj-title">{title}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
    const supportingSignals = readStringArray(object.supporting_signal_labels);
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-email" data-type="email" {...handler}>
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

  /* Default (card) variant: two-part envelope */
  const headerBorder = 'var(--cp-email-border, rgba(74,122,154,0.2))';
  const headerBg = 'var(--cp-email-tint, rgba(74,122,154,0.08))';

  return (
    <button
      type="button"
      {...handler}
      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      className="cp-object-card cp-object-email"
    >
      {/* Header strip */}
      <div style={{
        background: headerBg,
        borderTop: `1px solid ${headerBorder}`,
        borderLeft: `1px solid ${headerBorder}`,
        borderRight: `1px solid ${headerBorder}`,
        borderRadius: '6px 6px 0 0',
        padding: compact ? '6px 10px' : '8px 12px',
      }}>
        {fromName && <HeaderField label="FROM" value={fromName} highlight />}
        {toName && <HeaderField label="TO" value={toName} />}
        <HeaderField label="SUBJ" value={title} />
        {threadCount && <HeaderField label="THREAD" value={`${threadCount} messages`} />}
      </div>
      {/* Body section */}
      <div style={{
        background: 'var(--cp-card)',
        borderBottom: `1px solid ${headerBorder}`,
        borderLeft: `1px solid ${headerBorder}`,
        borderRight: `1px solid ${headerBorder}`,
        borderRadius: '0 0 6px 6px',
        padding: compact ? '8px 10px' : '10px 12px',
      }}>
        {!compact && summary && (
          <div style={{
            fontFamily: 'var(--cp-font-body)', fontSize: 13, color: 'var(--cp-text-muted)',
            lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{summary}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: summary && !compact ? 8 : 0, flexWrap: 'wrap' }}>
          {provenance && (
            <span style={{
              fontFamily: 'var(--cp-font-mono)', fontSize: 9, color: 'var(--cp-text-dim)',
              background: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: 3,
            }}>{provenance}</span>
          )}
          {timestamp && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)' }}>{timestamp}</span>}
          {edgeCount > 0 && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)', marginLeft: 'auto' }}>{edgeCount} links</span>}
        </div>
      </div>
    </button>
  );
}

function HeaderField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
      <span style={{
        fontFamily: 'var(--cp-font-mono)', fontSize: 9, textTransform: 'uppercase',
        color: 'var(--cp-text-dim)', minWidth: 40, flexShrink: 0,
      }}>{label}</span>
      <span style={{
        fontFamily: 'var(--cp-font-body)', fontSize: 12,
        color: highlight ? 'var(--cp-text)' : 'var(--cp-text-muted)',
        fontWeight: highlight ? 500 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{value}</span>
    </div>
  );
}

/* CSS envelope icon: 16x12 div with triangle flap */
function EnvelopeIcon() {
  return (
    <div style={{
      width: 16, height: 12, border: '1.5px solid var(--cp-email-color, #4A7A9A)',
      borderRadius: 2, position: 'relative', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '5px solid var(--cp-email-color, #4A7A9A)',
      }} />
    </div>
  );
}
