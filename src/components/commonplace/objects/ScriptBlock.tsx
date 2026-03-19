'use client';

import type { ObjectCardProps } from './ObjectRenderer';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import { readString, readStringArray, formatDate } from './shared';
import TerminalBlock from '../TerminalBlock';
import RoughBorder from '../RoughBorder';

const STATUS_COLORS: Record<string, string> = {
  active: '#4ADE80', running: '#4ADE80', idle: '#94A3B8',
  error: '#F87171', failed: '#F87171', complete: '#60A5FA', done: '#60A5FA',
};
const STEEL = '#94A3B8';

export default function ScriptBlock({ object, compact, variant = 'default', onClick, onContextMenu }: ObjectCardProps) {
  const title = object.display_title ?? object.title;
  const status = object.status ?? 'idle';
  const identity = getObjectTypeIdentity(object.object_type_slug);
  const edgeCount = object.edge_count ?? 0;
  const summary = readString(object.body) ?? readString(object.explanation);
  const score = typeof object.score === 'number' ? `${Math.round(object.score * 100)}%` : null;
  const timestamp = object.captured_at ? formatDate(object.captured_at) : null;
  const handler = {
    onClick: onClick ? () => onClick(object) : undefined,
    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(e, object) : undefined,
  };

  if (variant === 'module' || variant === 'timeline') {
    return (
      <button type="button" className="cp-obj cp-obj--module cp-obj-script" data-type="script" data-compact={compact || undefined} {...handler}>
        {!compact && <div className="cp-obj-script-glow" />}
        <div className="cp-obj-script-header">
          <span className="cp-obj-script-status-dot" />
          <span className="cp-obj-title">{title}</span>
        </div>
        <pre className="cp-obj-script-body">{summary ?? object.body}</pre>
        {!compact && edgeCount > 0 && <div className="cp-obj-edges">{edgeCount} connections</div>}
      </button>
    );
  }

  if (variant === 'chip') {
    return (
      <button type="button" className="cp-obj cp-obj--chip cp-obj-script" data-type="script" {...handler}>
        <span className="cp-obj-dot" />
        <span className="cp-obj-title">{title}</span>
        {edgeCount > 0 && <span className="cp-obj-edges">{edgeCount}</span>}
      </button>
    );
  }

  if (variant === 'chain') {
    return (
      <button type="button" className="cp-obj cp-obj--chain cp-obj-script" data-type="script" {...handler}>
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
      <button type="button" className="cp-obj cp-obj--dock cp-obj-script" data-type="script" {...handler}>
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

  /* Default variant (TerminalBlock) */
  return (
    <RoughBorder seed={object.slug} glow glowColor={STEEL}>
      <button
        type="button"
        {...handler}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer' }}
        className="cp-object-card cp-object-script"
      >
        <TerminalBlock
          title={title}
          status={status in STATUS_COLORS ? (status as 'idle' | 'running' | 'complete' | 'error' | 'degraded') : 'idle'}
          compact={compact}
        >
          {!compact && object.body ? object.body : title}
        </TerminalBlock>
      </button>
    </RoughBorder>
  );
}
