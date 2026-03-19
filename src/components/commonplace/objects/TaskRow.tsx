'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

export default function TaskRow({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const done = object.status === 'done' || object.status === 'complete' || object.status === 'completed';
  const title = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-task" data-type="task" data-done={done || undefined} data-compact={compact || undefined} {...handler}>
        <span className="cp-obj-task-checkbox" />
        <span className="cp-obj-title">{title}</span>
        {timestamp && <span className="cp-obj-timestamp" style={{ color: 'var(--cp-text-faint)' }}>{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-task" data-type="task" data-done={done || undefined} {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-task" data-type="task" data-done={done || undefined} {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
    const summary = readString(object.body) ?? readString(object.explanation);
    const supportingSignals = readStringArray(object.supporting_signal_labels);
    return (
      <button type="button" className="cp-obj cp-obj--dock cp-obj-task" data-type="task" data-done={done || undefined} {...handler}>
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
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
        background: 'var(--cp-card)', border: 'none', borderRadius: 6,
        padding: compact ? '7px 10px' : '10px 12px', cursor: 'pointer', opacity: done ? 0.6 : 1,
      }}
      className="cp-object-card cp-object-task"
    >
      <div style={{
        width: 15, height: 15, borderRadius: 3,
        border: `1.5px solid ${done ? 'var(--cp-accent)' : 'var(--cp-border-faint)'}`,
        background: done ? 'var(--cp-accent)' : 'transparent', flexShrink: 0, marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {done && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--cp-font-body)', fontSize: compact ? 13 : 14, fontWeight: 400, color: 'var(--cp-text)',
          lineHeight: 1.35, fontFeatureSettings: 'var(--cp-kern-body)', textDecoration: done ? 'line-through' : 'none',
          textDecorationColor: 'var(--cp-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: compact ? 'nowrap' : 'normal',
        }}>{title}</div>
        {!compact && object.body && (
          <div style={{
            fontFamily: 'var(--cp-font-body)', fontSize: 12, color: 'var(--cp-text-muted)', lineHeight: 1.5,
            fontFeatureSettings: 'var(--cp-kern-body)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{object.body}</div>
        )}
      </div>
    </button>
  );
}
