'use client';

import { useEffect, useState } from 'react';
import { getObject } from '@/lib/theseus-api';
import type { TheseusObject } from '@/lib/theseus-types';

type ContextTab = 'overview' | 'evidence' | 'tensions' | 'claims';

interface ContextPanelProps {
  nodeId: string | null;
  onClose: () => void;
}

function typeColor(objectType: string): string {
  switch (objectType) {
    case 'source': return 'var(--vie-type-source)';
    case 'concept': return 'var(--vie-type-concept)';
    case 'person': return 'var(--vie-type-person)';
    case 'hunch': return 'var(--vie-type-hunch)';
    default: return 'var(--vie-type-note)';
  }
}

/**
 * ContextPanel: right slide-in panel showing explanation for a selected node.
 *
 * Tabs: Overview, Evidence, Tensions, Claims.
 * Opens automatically when a node is selected, closes on deselect.
 */
export default function ContextPanel({ nodeId, onClose }: ContextPanelProps) {
  const [tab, setTab] = useState<ContextTab>('overview');
  const [object, setObject] = useState<TheseusObject | null>(null);
  const [loading, setLoading] = useState(false);
  const isOpen = nodeId !== null;

  useEffect(() => {
    if (!nodeId) {
      setObject(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTab('overview');
    getObject(nodeId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setObject(result);
      }
    });
    return () => { cancelled = true; };
  }, [nodeId]);

  return (
    <div className={`explorer-context-panel${isOpen ? ' is-open' : ''}`}>
      {/* Header */}
      <div className="explorer-panel-header">
        <div className="explorer-context-title-row">
          {object && (
            <span
              className="explorer-panel-type-dot"
              style={{ background: typeColor(object.object_type ?? 'note') }}
            />
          )}
          <span className="explorer-panel-title">
            {loading ? 'Loading\u2026' : (object?.title ?? 'Select a node')}
          </span>
        </div>
        <button
          type="button"
          className="explorer-panel-close"
          onClick={onClose}
          aria-label="Close context panel"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="explorer-panel-tabs">
        {(['overview', 'evidence', 'tensions', 'claims'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`explorer-panel-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="explorer-panel-body">
        {tab === 'overview' && object && (
          <div className="explorer-context-overview">
            {/* Type badge */}
            <div className="explorer-context-meta">
              <span className="explorer-context-type" style={{ color: typeColor(object.object_type ?? 'note') }}>
                {object.object_type ?? 'note'}
              </span>
              {object.created_at && (
                <span className="explorer-context-date">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(object.created_at))}
                </span>
              )}
            </div>

            {/* Summary text */}
            {object.summary && (
              <p className="explorer-context-body">{object.summary}</p>
            )}
          </div>
        )}

        {tab === 'overview' && !object && !loading && (
          <p className="explorer-panel-empty">Select a node in the graph to inspect it.</p>
        )}

        {tab === 'evidence' && (
          <p className="explorer-panel-empty">Evidence paths will be populated from the response data.</p>
        )}

        {tab === 'tensions' && (
          <p className="explorer-panel-empty">Tensions involving this object will appear here.</p>
        )}

        {tab === 'claims' && (
          <p className="explorer-panel-empty">Extracted claims will appear here.</p>
        )}
      </div>
    </div>
  );
}
