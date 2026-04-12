'use client';

import { useCallback, useEffect, useState } from 'react';
import { getClusters } from '@/lib/theseus-api';
import type { ClusterSummary } from '@/lib/theseus-types';

type StructureTab = 'clusters' | 'types' | 'tensions';

interface StructurePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onFocusCluster?: (clusterId: number) => void;
  onFocusType?: (objectType: string) => void;
  onFocusTension?: (objectIds: string[]) => void;
}

const OBJECT_TYPES = [
  { type: 'source', label: 'Sources', color: 'var(--vie-type-source)' },
  { type: 'concept', label: 'Concepts', color: 'var(--vie-type-concept)' },
  { type: 'person', label: 'People', color: 'var(--vie-type-person)' },
  { type: 'hunch', label: 'Hunches', color: 'var(--vie-type-hunch)' },
  { type: 'note', label: 'Notes', color: 'var(--vie-type-note)' },
];

/**
 * StructurePanel: left slide-in panel showing corpus structure.
 *
 * Three tabs: Clusters, Types, Tensions. Selecting an item
 * can focus the graph on that neighborhood (via callbacks).
 */
export default function StructurePanel({
  isOpen,
  onClose,
  onFocusCluster,
  onFocusType,
  onFocusTension,
}: StructurePanelProps) {
  const [tab, setTab] = useState<StructureTab>('clusters');
  const [clusters, setClusters] = useState<ClusterSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getClusters().then((result) => {
      if (result.ok) {
        setClusters(result.clusters);
      }
      setLoading(false);
    });
  }, [isOpen]);

  const handleClusterClick = useCallback((clusterId: number) => {
    onFocusCluster?.(clusterId);
  }, [onFocusCluster]);

  return (
    <div className={`explorer-structure-panel${isOpen ? ' is-open' : ''}`}>
      {/* Header */}
      <div className="explorer-panel-header">
        <span className="explorer-panel-title">Structure</span>
        <button
          type="button"
          className="explorer-panel-close"
          onClick={onClose}
          aria-label="Close structure panel"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="explorer-panel-tabs">
        {(['clusters', 'types', 'tensions'] as const).map((t) => (
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
        {tab === 'clusters' && (
          <div className="explorer-panel-list">
            {loading && <p className="explorer-panel-loading">Loading clusters\u2026</p>}
            {!loading && clusters.length === 0 && (
              <p className="explorer-panel-empty">No clusters found</p>
            )}
            {clusters.map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                className="explorer-panel-item"
                onClick={() => handleClusterClick(cluster.id)}
              >
                <span className="explorer-panel-item-label">{cluster.label}</span>
                <span className="explorer-panel-item-count">{cluster.member_count}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'types' && (
          <div className="explorer-panel-list">
            {OBJECT_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                className="explorer-panel-item"
                onClick={() => onFocusType?.(t.type)}
              >
                <span
                  className="explorer-panel-type-dot"
                  style={{ background: t.color }}
                />
                <span className="explorer-panel-item-label">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === 'tensions' && (
          <div className="explorer-panel-list">
            <p className="explorer-panel-empty">
              Select a node to see its tensions in the context panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
