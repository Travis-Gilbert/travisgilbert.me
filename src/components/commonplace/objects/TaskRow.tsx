'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';

/* Priority color map: no text labels, color only */
const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--cp-priority-high, #D85A30)',
  medium: 'var(--cp-priority-medium, #C49A4A)',
  low: 'var(--cp-priority-low, #5A7A4A)',
};

function getPriorityColor(object: Record<string, unknown>): string {
  const priority = typeof object.priority === 'string' ? object.priority.toLowerCase() : '';
  return PRIORITY_COLORS[priority] ?? 'var(--cp-border-faint)';
}

export default function TaskRow({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const done = object.status === 'done' || object.status === 'complete' || object.status === 'completed';
  const title = object.display_title ?? object.title;
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const summary = readString(object.body) ?? readString(object.explanation);
  const priorityColor = getPriorityColor(object);
  const provenance = readString(object.source_label);

  // Subtask data (if available from components)
  const subtasks = Array.isArray(object.subtasks) ? object.subtasks as { title: string; done: boolean }[] : [];
  const subtasksDone = subtasks.filter((s) => s.done).length;
  const subtaskTotal = subtasks.length;
  const progressPct = subtaskTotal > 0 ? (subtasksDone / subtaskTotal) * 100 : 0;

  // Due date (if available)
  const dueDate = readString(object.due_date);

  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-task" data-type="task" data-done={done || undefined} data-compact={compact || undefined} {...handler}>
        <Checkbox size={14} borderWidth={1.5} done={done} color={priorityColor} />
        <span className="cp-obj-title" style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1 }}>{title}</span>
        {timestamp && <span className="cp-obj-timestamp" style={{ color: 'var(--cp-text-faint)' }}>{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-task" data-type="task" data-done={done || undefined} {...handler}
        style={{ borderLeft: `3px solid ${priorityColor}`, borderRadius: '0 6px 6px 0' }}
      >
        <Checkbox size={14} borderWidth={1.5} done={done} color={priorityColor} />
        <span className="cp-obj-title" style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1 }}>{title}</span>
        {provenance && <span className="cp-obj-provenance">{provenance}</span>}
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-task" data-type="task" data-done={done || undefined} {...handler}>
        <Checkbox size={14} borderWidth={1.5} done={done} color={priorityColor} />
        <span className="cp-obj-title" style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1 }}>{title}</span>
        {timestamp && <span className="cp-obj-timestamp">{timestamp}</span>}
      </button>
    );
  }

  if (variant === 'dock') {
    const signalLabel = readString(object.signal_label);
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

  /* Default (card) variant */
  return (
    <button
      type="button"
      {...handler}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'var(--cp-card)', border: 'none', borderRadius: 6,
        padding: compact ? '8px 10px' : '10px 12px', cursor: 'pointer',
        opacity: done ? 0.6 : 1,
      }}
      className="cp-object-card cp-object-task"
    >
      {/* Header: checkbox + title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Checkbox size={18} borderWidth={2} done={done} color={priorityColor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--cp-font-body)', fontSize: compact ? 13 : 14, fontWeight: 400,
            color: 'var(--cp-text)', lineHeight: 1.35,
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: 'var(--cp-text-muted)',
          }}>{title}</div>
          {!compact && summary && (
            <div style={{
              fontFamily: 'var(--cp-font-body)', fontSize: 12, color: 'var(--cp-text-muted)',
              lineHeight: 1.5, marginTop: 3, paddingLeft: 0,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>{summary}</div>
          )}
        </div>
      </div>

      {/* Subtask list (expanded content) */}
      {!compact && subtasks.length > 0 && (
        <div style={{ marginTop: 8, paddingLeft: 28 }}>
          {subtasks.map((sub, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <Checkbox size={12} borderWidth={1.5} done={sub.done} color={priorityColor} />
              <span style={{
                fontFamily: 'var(--cp-font-body)', fontSize: 11, color: 'var(--cp-text-muted)',
                textDecoration: sub.done ? 'line-through' : 'none', opacity: sub.done ? 0.5 : 1,
              }}>{sub.title}</span>
            </div>
          ))}
          {/* Progress bar */}
          <div style={{
            marginTop: 6, height: 3, borderRadius: 2,
            background: 'var(--cp-border-faint)',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${progressPct}%`,
              background: priorityColor,
              transition: 'width 200ms ease',
            }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 28, flexWrap: 'wrap' }}>
        {dueDate && <span style={{ fontFamily: 'var(--cp-font-mono)', fontSize: 10, color: 'var(--cp-text-faint)' }}>{dueDate}</span>}
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

/* Reusable checkbox: color-only priority, no text labels */
function Checkbox({ size, borderWidth, done, color }: { size: number; borderWidth: number; done: boolean; color: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 3, flexShrink: 0, marginTop: 1,
      border: `${borderWidth}px solid ${done ? color : color}`,
      background: done ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {done && (
        <svg width={size * 0.6} height={size * 0.47} viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
